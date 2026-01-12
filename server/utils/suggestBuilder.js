const db = require('../db');

// Hungarian O(n³)
function hungarian(cost){
  const n = cost.length, // кол-во волонтеров и вакансий
        u = Array(n+1).fill(0), // потенциалы волонтеров
        v = Array(n+1).fill(0), // потенциалы вакансий
        p = Array(n+1).fill(0), // вакансия j занята волонтером i
        way = Array(n+1).fill(0); // путь к предыдущим вакансиям (из какой вакансии пришли к текущей)

  // minv[j] достигает 0 — значит, по этому ребру можно строить назначение
  for (let i = 1; i <= n; ++i) { // проходим по волонтерам
    p[0] = i;
    let j0 = 0; // стартовая вакансия
    const minv = Array(n+1).fill(Infinity), // minv[j] - стоимость, насколько хорошо текущий волонтер подходит к вакансии j (лучшая разница в цене)
    used = Array(n+1).fill(false); // была ли j‑я вакансия уже просмотрена в текущем проходе
    do {
      used[j0] = true; // просмотрели вакансию
      const i0 = p[j0]; // волонтер i0, занятый на вакансии j0

      // поиск самой выгодной вакансии, если занята - запомнить путь к ней
      let delta = Infinity, // насколько дешево можно перейти к вакансии
      j1 = 0; // следующая вакансия
      for (let j = 1; j <= n; ++j) { // перебор не просмотренных в проходе вакансий
        if (!used[j]) {
          const cur = cost[i0-1][j-1]-u[i0]-v[j]; // остаточная стоимость волонтёра i0 на вакансию j
          if (cur < minv[j]) { // если стоимость меньше, чем ранее найденная минимальная стоимость minv[j]
            minv[j] = cur; // сохраняем новую лучшую цену
            way[j] = j0; // запоминаем, откуда пришли на j (из j0)
          }
          if (minv[j] < delta) {
            delta = minv[j]; // стоимость наиболее дешевого шага
            j1 = j; // вакансия, к которой выгоднее всего двигаться
          }
        }
      }
      for (let j = 0; j <= n; ++j) { // обновление потенциалов
        if (used[j]) {
          u[p[j]] += delta; // увеличиваем потенциал волонтёра, назначенного на j
          v[j] -= delta;  // уменьшаем потенциал вакансии j
        }
        else
          minv[j] -= delta;
      }
      j0 = j1; // переход к следующей вакансии
    } while (p[j0] !== 0); // пока не нашли свободную вакансию

    // восстановление улучшающего пути и перестройка назначений
    do {
      const j1 = way[j0];
      p[j0] = p[j1]; // переназначение
      j0 = j1;
    } while (j0); // пока не достигли стартовой вакансии
  }
  const match = Array(n).fill(-1);
  for (let j = 1; j <= n; ++j) if (p[j]) match[p[j]-1] = j-1;
  return match; // event_i -> volunteer_j  (or -1)
}

/*
Асимптотика:
Худший (все вол подбираются на все мер) - O(n³), n - кол-во слотов (вакансий) для подбора
Лучший (нет вообще слотов для подбора) - O(1)
*/

// options = { clusterId? }  — если нет, пересчитываем все активные кластеры (в которых есть текущие и будущие мероприятия)
async function runSuggest({ clusterIds = null } = {}) {

  // 1. Выбор тайм‑кластеров
  if (!clusterIds) { // глобальный пересчёт
    const rows = await db.query(
      'SELECT DISTINCT cluster_id FROM event WHERE end_date_time >= now()');
    clusterIds = rows.rows.map(r => r.cluster_id);
  } else if (!Array.isArray(clusterIds)) {
    clusterIds = [clusterIds];
  }
  const clusters = clusterIds;

  for (const cid of clusters) {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock($1)', [cid]);   // блокировка кластера

    // 2. Находим кол-во свободных вакансий (слотов) каждого мероприятий
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

    // Формируем массив «слотов»: каждый slot это ID мероприятия
    const slots = [];
    evRes.rows.forEach(r=>{ for(let k=0;k<r.free_slots;k++) slots.push(r.id); });
    if (!slots.length) {
      await db.query('DELETE FROM suggested_assignment WHERE event_id = ANY($1)', [evRes.rows.map(r=>r.id)]);
      continue;
    }
    
    // 3. Получаем свободных в этом кластере волонтеров
    const freeVolsRes = await db.query(`
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

    let vols = freeVolsRes.rows.map(r => r.id);

    // Если волонтеров > слотов, оставляем top по максимальному score
    if (vols.length > slots.length) {
      const topRes = await db.query(`
        SELECT ms.volunteer_id, MAX(ms.score) AS best
        FROM   match_score ms
        WHERE  ms.event_id    = ANY($1) AND  ms.volunteer_id = ANY($2)
        GROUP  BY ms.volunteer_id
        ORDER  BY best DESC NULLS LAST
        LIMIT  $3`,
        [slots, vols, slots.length]);
      vols = topRes.rows.map(r => r.volunteer_id);
    }

    if (!vols.length) {
      await db.query('DELETE FROM suggested_assignment WHERE event_id = ANY($1)', [evRes.rows.map(r=>r.id)]);
      continue;
    }

    // 4. Строим матрицу стоимости (100 - score)
    const m = slots.length, n = vols.length;
    const N = Math.max(m, n); // квадратный размер (если m > n, то N = m, m < n быть не может, так как выше берем топ m волонтеров)
    const cost = Array.from({ length: N }, () => Array(N).fill(100)); // фиктивные волонтеры останутся 100 (невыгодные)
    // запрос: мероприятие — волонтер — балл
    const msRes = await db.query( 
      `SELECT event_id, volunteer_id, score
         FROM match_score
        WHERE event_id   = ANY($1)
          AND volunteer_id = ANY($2)`,
      [slots, vols]);
    // преобразуем в map: ключ -  строка "eventId_volunteerId", значение - score
    const S = new Map(msRes.rows.map(r => [`${r.event_id}_${r.volunteer_id}`, +r.score]));
    // заполняем матрицу стоимости (выше балл -> меньше стоимость)
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < n; j++) {
        cost[i][j] = 100 - (S.get(`${slots[i]}_${vols[j]}`) || 0);
      }
    } 

    // 5. Вызываем Венгерский алгоритм
    const match = hungarian(cost);

    // 6. Удаляем старых и сохраняем новых рекомендуемых волонтеров
    await db.query('DELETE FROM suggested_assignment WHERE event_id = ANY($1)', [slots]);

    const vals = [], params = [];
    let p = 1;
    for (let i = 0; i < m; i++) { // перебор всех слотов
      const j = match[i]; // рекомендуемый волонтер
      if (j < 0 || j >= n) continue; // пропускаем фиктивных
      vals.push(`($${p++},$${p++},now())`);
      params.push(slots[i], vols[j]);
    };
    if (vals.length)
      await db.query(
        `INSERT INTO suggested_assignment(event_id, volunteer_id, updated_at)
         VALUES ${vals.join(',')}
         ON CONFLICT (event_id, volunteer_id)
         DO UPDATE SET updated_at = now()`, params);

    await db.query('COMMIT'); // снимает lock
  }
}

module.exports = { runSuggest };
module.exports.hungarian = hungarian; // для бенча

if (require.main === module) {
  runSuggest().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
}