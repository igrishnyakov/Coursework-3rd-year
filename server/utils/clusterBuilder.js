const db = require('../db');

async function buildClusters() {
  // 1. берём все события, которые ещё идут или впереди
  const { rows: events } = await db.query(
    `SELECT id, start_date_time AS start, end_date_time AS finish
       FROM event
      WHERE end_date_time >= now()`
  );

  const n = events.length;
  if (n === 0) return { updated: 0 };

  // 2. построение графа пересечений с помощью алгоритма sweep‑line
  // Каждое событие даёт две точки: (start,+1) и (finish,-1)
  const points = [];
  events.forEach((ev, idx) => {
    points.push({ t: ev.start, type: +1, idx });
    points.push({ t: ev.finish, type: -1, idx });
  });
  points.sort((a, b) => a.t - b.t || a.type - b.type);

  // 3. Построение графа смежности
  const active = new Set();
  const adj = Array.from({ length: n }, () => new Set());

  for (const p of points) {
    if (p.type === +1) {
      for (const j of active) {
        adj[p.idx].add(j);
        adj[j].add(p.idx);
      }
      active.add(p.idx);
    } else {
      active.delete(p.idx);
    }
  }

  // 4. Поиск компонент связности с помощью BFS
  const clusterIdByIdx = Array(n).fill(null);
  let clusterCounter = 0;
  for (let i = 0; i < n; i++) {
    if (clusterIdByIdx[i] !== null) continue;
    const cid = ++clusterCounter;
    const stack = [i];
    clusterIdByIdx[i] = cid;
    while (stack.length) {
      const v = stack.pop();
      for (const nb of adj[v]) {
        if (clusterIdByIdx[nb] === null) {
          clusterIdByIdx[nb] = cid;
          stack.push(nb);
        }
      }
    }
  }

// 5. Обновление events
const updates = events.map((ev, i) => ({ id: ev.id, cid: clusterIdByIdx[i] }));

const valuesSql = updates
  .map((_, k) => `($${k * 2 + 1}, $${k * 2 + 2}, now())`)
  .join(',');

const params = updates.flatMap(u => [u.id, u.cid]);

await db.query(
  `INSERT INTO event(id, cluster_id, ec_generated_at)
       VALUES ${valuesSql}
   ON CONFLICT (id) DO UPDATE
     SET cluster_id      = EXCLUDED.cluster_id,
         ec_generated_at = EXCLUDED.ec_generated_at
   WHERE event.cluster_id IS DISTINCT FROM EXCLUDED.cluster_id`,
  params
);
  return { updated: updates.length };
}

module.exports = { buildClusters };

// 6. Автозапуск при вызове напрямую (node clusterBuilder.js)
if (require.main === module) {
  buildClusters()
    .then(r => {
      console.log(`Clusters recalculated for ${r.updated} events.`);
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}