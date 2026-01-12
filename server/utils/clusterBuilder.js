const db = require('../db');

// общая асимптотика: O(n*log(n) + e), n - кол-во мероприятий, e - кол-во пересечений мер (ребер в графе)
// лучший случай (события не пересекаются) - O(n*log(n))
// худший случай (все пересекаются) - O(n²)
async function buildClusters() {
  // 1. берем только текущие и будущие мероприятия - O(n)
  const { rows: events } = await db.query( // events - массив текущих и будущих мероприятий мероприятий
    `SELECT id, start_date_time AS start, end_date_time AS finish
       FROM event
      WHERE end_date_time >= now()`
  );

  const n = events.length;
  if (n === 0) return { updated: 0 };

  // 2. Построение графа пересечений (вершины - мероприятия, ребра - пересечения мероприятий по времени)
  
  // Алгоритм "sweep-line" (сканирующей линии)
  // Нужно определить, какие мероприятия пересекаются по времени, чтобы связать их ребрами в графе
  const points = []; // points - массив временных точек (для sweep-line)
  events.forEach((ev, idx) => { // каждое пероприятие добавляет две точки - O(n)
    points.push({ t: ev.start, type: +1, idx }); // старт (дата и время) мероприятия (+1), idx - id мерпориятия
    points.push({ t: ev.finish, type: -1, idx }); // конец (дата и время) мероприятия (-1)
  });
  points.sort((a, b) => a.t - b.t || a.type - b.type); // сортировка точек по времени, если у точек время одинаковое, то сначала старт (+1), затем конец (-1) - O(n log n)

  const active = new Set();
  // Вершины 0, ..., n-1, ссылаются на события в events
  const adj = Array.from({ length: n }, () => new Set()); // список смежности неориентированного графа пересечений (множество индексов событий, которые пересекаются с событием i)

  // Построение ребер - O(e), e - кол-во ребер (худший случай - e = n²)
  for (const p of points) { // обходим все временные точки слева-направо (по времени)
    if (p.type === +1) { // мероприятие p.idx началось -> связываем его со всем "активными"(начались и не закончились) мероприятиями
      for (const j of active) { // идем по всем активным мероприятиям
        adj[p.idx].add(j); // доб ребро между p.idx и j
        adj[j].add(p.idx); // и в другую сторону (неориентированный граф)
      }
      active.add(p.idx); // добавляем в список "активных"
    } else { // мероприятие закончилось
      active.delete(p.idx); // удаляем из "активных"
    }
  }

  // 3. Поиск компонент связности (тайм-кластеров) с помощью DFS - O(n + e), худший e = 0, лучший e = n².
  const clusterIdByIdx = Array(n).fill(null); // id кластера, к которому относится мероприятие i
  let clusterCounter = 0; // номер текущего кластера

  for (let i = 0; i < n; i++) { // обход всех мер
    if (clusterIdByIdx[i] !== null) continue; // если у мер уже определен кластер, пропускаем

    // начало новой компоненты (кластера)
    const cid = ++clusterCounter; // создание нового кластера
    const stack = [i]; // мер i помещаем в стек для обхода
    clusterIdByIdx[i] = cid; // i принадлежит новому кластеру

    // DFS через стек
    while (stack.length) { // пока есть вершины в стеке
      const v = stack.pop(); // берем вершину из стека
      for (const nb of adj[v]) { // обходим всех соседей вершины из списка смежности (которые пересекаются по времени)
        if (clusterIdByIdx[nb] === null) { // если у соседа нет кластера
          clusterIdByIdx[nb] = cid; // помечаем текущим кластером
          stack.push(nb); // в стек для последующего обхода
        }
      }
    }

  }

// 4. Обновление events - O(n)
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

// Автозапуск при вызове напрямую (node clusterBuilder.js)
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