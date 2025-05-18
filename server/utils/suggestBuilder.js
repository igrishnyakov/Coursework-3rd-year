const db = require('../db');

// Hungarian O(n³)
function hungarian(cost){
  const n = cost.length, u = Array(n+1).fill(0), v = Array(n+1).fill(0),
        p = Array(n+1).fill(0), way = Array(n+1).fill(0);
  for (let i = 1; i <= n; ++i) {
    p[0] = i; let j0 = 0; const minv = Array(n+1).fill(Infinity), used = Array(n+1).fill(false);
    do {
      used[j0] = true; const i0 = p[j0]; let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; ++j) if (!used[j]) {
        const cur = cost[i0-1][j-1]-u[i0]-v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; ++j) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const match = Array(n).fill(-1);
  for (let j = 1; j <= n; ++j) if (p[j]) match[p[j]-1] = j-1;
  return match; // event_i -> volunteer_j  (or -1)
}


// options = { clusterId? }  — если нет, пересчитываем все активные
async function runSuggest({ clusterIds = null } = {}) {

  // 1. выбираем тайм‑слоты (кластеры)
  if (!clusterIds) {
    // глобальный пересчёт
    const rows = await db.query(
      'SELECT DISTINCT cluster_id FROM event WHERE end_date_time >= now()');
    clusterIds = rows.rows.map(r => r.cluster_id);
  } else if (!Array.isArray(clusterIds)) {
    clusterIds = [clusterIds];
  }
  const clusters = clusterIds;

  for (const cid of clusters) {
    // 2.  события + кол‑во свободных мест
    const evRes = await db.query(`
      SELECT e.id,
            GREATEST(
              e.num_volunteers -
              (SELECT COUNT(*) FROM (
                SELECT volunteer_id FROM designated_volunteer dv WHERE dv.event_id = e.id
                UNION
                SELECT volunteer_id FROM application a
                WHERE a.event_id = e.id AND a.status_id = 3
              ) AS uniq),
              0) AS free_slots
      FROM   event e
      WHERE  e.cluster_id = $1
        AND  e.end_date_time >= now()`, [cid]);

    // формируем массив «слотов»: каждый slot — это ссыл‑id события
    const slots = [];
    evRes.rows.forEach(r=>{ for(let k=0;k<r.free_slots;k++) slots.push(r.id); });
    if (!slots.length) {
      await db.query('DELETE FROM suggested_assignment WHERE event_id = ANY($1)', [evRes.rows.map(r=>r.id)]);
      continue;
    }

    // 3.  волонтёры, свободные в этом кластере
    const vRes = await db.query(`
      SELECT v.id
      FROM   volunteer v
      WHERE NOT EXISTS (   -- уже назначен
            SELECT 1
            FROM (
              SELECT volunteer_id, event_id FROM designated_volunteer
              UNION
              SELECT volunteer_id, event_id FROM application WHERE status_id = 3
            ) z
            JOIN event e ON e.id = z.event_id
            WHERE z.volunteer_id = v.id AND e.cluster_id = $1)`,
      [cid]);
    const vols = vRes.rows.map(r=>r.id);
    if (!vols.length) {
      await db.query('DELETE FROM suggested_assignment WHERE event_id = ANY($1)', [evRes.rows.map(r=>r.id)]);
      continue;
    }

    // 4.  строим матрицу стоимости  (100 - score)
    const m = slots.length, n = vols.length;
    const N = Math.max(m, n);                    // квадратный размер
    const cost = Array.from({ length: N }, () => Array(N).fill(100));
    const msRes = await db.query(
      `SELECT event_id, volunteer_id, score
         FROM match_score
        WHERE event_id   = ANY($1)
          AND volunteer_id = ANY($2)`,
      [slots, vols]);
    const S = new Map(msRes.rows.map(r => [`${r.event_id}_${r.volunteer_id}`, +r.score]));
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        cost[i][j] = 100 - (S.get(`${slots[i]}_${vols[j]}`) || 0);
      }
    }

    // 5.  вызываем Венгерский
    const match = hungarian(cost);         // slot_i → volunteer_j (длина = N)

    // 6.  сохраняем рекомендованных волонтеров (берём только реальные «строки» и «столбцы»)
    await db.query('DELETE FROM suggested_assignment WHERE event_id = ANY($1)', [slots]);

    const vals = [], params = [];
    let p = 1;
    for (let i = 0; i < m; i++) {          // только реальные слоты
      const j = match[i];
      if (j < 0 || j >= n) continue;       // фиктивный волонтёр
      vals.push(`($${p++},$${p++},now())`);
      params.push(slots[i], vols[j]);
    };
    if (vals.length)
      await db.query(
        `INSERT INTO suggested_assignment(event_id, volunteer_id, updated_at)
         VALUES ${vals.join(',')}
         ON CONFLICT (event_id, volunteer_id)
         DO UPDATE SET updated_at = now()`, params);
  }
}

module.exports = { runSuggest };

if (require.main === module) {
  runSuggest().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
}