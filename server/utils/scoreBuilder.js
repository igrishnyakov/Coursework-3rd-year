const db = require('../db');

// 1. Весовые коэффициенты
const W_SKILL  = 0.45; // навыки
const W_HOURS  = 0.35; // часы волонтерства 
const W_HISTORY = 0.20; // опыт в похожих мероприятиях

// 2. Маппинг: категория  →  навык
// (ключи = name из таблицы category, values = массив названий skills)
const CATEGORY_SKILL = {
  'Ветераны и Историческая память': [
    'Проведение интервью','Организация памятных мероприятий','Работа с архивами'
  ],
  'Дети и молодежь': [
    'Организация развлекательных программ','Работа с детьми','Наставничество'
  ],
  'Животные': [
    'Уход за животными','Помощь приютам','Пристройство животных'
  ],
  'Здравоохранение и ЗОЖ': [
    'Навыки первой помощи','Проведение тренингов по ЗОЖ','Медицинская поддержка на мероприятиях'
  ],
  'Интеллектуальная помощь': [
    'Репетиторство','Оформление документов','Цифровая грамотность'
  ],
  'Культура и искусство': [
    'Организация выставок','Организация фестивалей','Проведение экскурсий','Создание креативного контента'
  ],
  'Люди с ОВЗ': [
    'Уход за больным','Сопровождение больных','Жестовый язык','Адаптация больного'
  ],
  'Наставничество': [
    'Коучинг','Выстраивание доверительных отношений','Построение личных траекторий','Построение карьерных траекторий'
  ],
  'Наука': [
    'Организация лекций','Участие в просветительских проектах','Участие в исследовательских проектах'
  ],
  'Образование': [
    'Навык преподавания','Разработка УМК','Проведение тренингов и вебинаров'
  ],
  'Поиск пропавших': [
    'Работа с навигацией','Координация поисковых групп','Участие в спасательных операциях','Ведение коммуникации'
  ],
  'Права человека': [
    'Знание основ права','Навыки медиации'
  ],
  'Спорт и события': [
    'Организация спортивных мероприятий','Организация массовых мероприятий','Логистика','Тайм-менеджмент','Работа с болельщиками'
  ],
  'Старшее поколение': [
    'Организация клубов по интересам','Помощь в быту','Проведение досуговых активностей'
  ],
  'Урбанистика': [
    'Благоустройство городской среды','Фасилитация общественных обсуждений','Создание креативных решений'
  ],
  'ЧС': [
    'Оказание первой помощи','Координация во время ЧС','Работа в условиях стресса'
  ],
  'Экология': [
    'Организация субботников','Организация экоакций','Знание сортировки отходов'
  ],
  'Другое': [
    'Проведение проектов','Организационные умения','Креативное мышление','Решение нестандартных задач'
  ]
};

function logistic(x) {
  // гладкая функция от 0 до 1; x = (v_hours - rec_hours)
  return 1 / (1 + Math.exp(-x / 20));
}

/*
  Асимптотика:
  Лучший (расчет для одного мероприятия/волонтера) = O(N × (C × D + S)), где N = min(E, V)
  Худший (расчет для всех волонтеров и мероприятий) = O(E × V × (C × D + S))
  Обозначения:
  E — число мероприятий
  V — число волонтёров
  C — категорий на мероприятие
  D — навыков на категорию
  S — навыков у одного волонтёра
*/

/*
  Пересчёт баллов подходимости
  options:
   – eventId        ▸ пересчитать ТОЛЬКО для этого мероприятия
   – volunteerId   ▸ пересчитать ТОЛЬКО для этого волонтёра
   – ничего         ▸ полный пересчёт
*/
async function buildScores(options = {}) {
  const { eventId = null, volunteerId = null } = options;
  try {
    // 1. берем текущие и будущие мероприятия, их категории и часы
    const evParams = [];
    let evSql =
      `SELECT e.id, e.rec_vol_hours, ce.category_id, c.category AS cat_name
         FROM event          e
         JOIN category_event ce ON ce.event_id = e.id
         JOIN category       c  ON c.id = ce.category_id
        WHERE e.end_date_time >= now()`;
    if (eventId) { evSql += ` AND e.id = $1`; evParams.push(eventId); } // если передали eventId, оставляем только для этого мер
    const eventsRes = await db.query(evSql, evParams);

    const eventsMap = new Map(); // event_id -> { recHours, cats[], catIds[] }
    const catNameToId = new Map(); // cat_name -> category_id

    // формирование eventsMap
    for (const row of eventsRes.rows) {
        const ev = eventsMap.get(row.id) || { recHours: row.rec_vol_hours || 0, cats: [], catIds: [] };
        ev.cats.push(row.cat_name);
        ev.catIds.push(row.category_id);
        catNameToId.set(row.cat_name, row.category_id);
        eventsMap.set(row.id, ev);
    }

    // 2. берем всех волонтеров, их навыки и часы
    const volParams = [];
    let volSql =
      `SELECT v.id, v.volunteer_hours, s.skill
         FROM volunteer v
         LEFT JOIN volunteer_skill vs ON vs.volunteer_id = v.id
         LEFT JOIN skill s            ON s.id = vs.skill_id`;
    if (volunteerId) { volSql += ` WHERE v.id = $1`; volParams.push(volunteerId); } // если передали volunteerId, оставляем только для этого вол
    const volsRes = await db.query(volSql, volParams);

    const volsMap = new Map(); // volunteer_id -> { hours, skills{} }
    for (const row of volsRes.rows) {
      const v = volsMap.get(row.id) || { hours: row.volunteer_hours || 0, skills: new Set() };
      if (row.skill) v.skills.add(row.skill);
      volsMap.set(row.id, v);
    }

    // 3. история заявок волонтеров на мероприятия (какие категории, как часто)
    const histParams = [];
    let histSql =
      `SELECT a.volunteer_id, ce.category_id
         FROM application a
         JOIN event          e  ON e.id = a.event_id
         JOIN category_event ce ON ce.event_id = e.id`;
    if (volunteerId) { histSql += ` WHERE a.volunteer_id = $1`; histParams.push(volunteerId); } // если передали volunteerId, оставляем только для этого вол
    const histRes = await db.query(histSql, histParams);

    const histMap = new Map(); // volunteer_id -> Map<category_id, count>
    for (const row of histRes.rows) {
      let catCount = histMap.get(row.volunteer_id);
      if (!catCount) { catCount = new Map(); histMap.set(row.volunteer_id, catCount); }
      catCount.set(row.category_id, (catCount.get(row.category_id) || 0) + 1);
    }

    // 4. расчет балла подходимости
    const evArr  = [];   // event_id[]
    const volArr = [];   // volunteer_id[]
    const scrArr = [];   // score[]

    for (const [evId, evObj] of eventsMap) { // обходим все меропрития

      // фиксируем навыки, релевантные категорям текущего мероприятия
      const catSkills = new Set();
      evObj.cats.forEach(name => (CATEGORY_SKILL[name] || []).forEach(s => catSkills.add(s)));

      for (const [volId, vObj] of volsMap) { // обходим всех волонтеров

        // 4.1 доля совпадения навыков (от 0 до 1)
        const overlap = [...catSkills].filter(s => vObj.skills.has(s)).length; // сколько навыков совпадают с нужными
        const skillSim = catSkills.size ? overlap / catSkills.size : 0; // делим на общее количество нужных

        // 4.2 расчет hoursScore
        const hoursScore = logistic(vObj.hours - evObj.recHours);

        // 4.3 история заявок
        let histScore = 0;
        const volHist = histMap.get(volId); // { category_id → сколько раз участвовал }

        // есть заявки с категорями, считаем долю релевантного опыта для текущего мероприятия
        if (volHist) {
            // 1) сколько раз волонтер подавал заявки с категориями текущего мероприятия
            let sum = 0;
            for (const cid of evObj.catIds) {
                sum += volHist.get(cid) || 0;
            }
            // 2) всего заявок волонтера
            let total = 0;
            volHist.forEach(cnt => (total += cnt));
            // 3) доля релевантного опыта для текущего мероприятия
            if (total > 0) histScore = sum / total;
        }
        // без категорий история = 0

        const score = (W_SKILL*skillSim + W_HOURS*hoursScore + W_HISTORY*histScore) * 100;
        evArr .push(evId)
        volArr.push(volId)
        scrArr.push(Math.round(score*100)/100)
      }
    }

    // 5. Запись в БД рассчитанных баллов
    const totalRows = evArr.length;
    if (!totalRows) return { updated: 0 };

    // удаляем старые строки, чтобы не остался мусор
    if (eventId && !volunteerId) {
      await db.query('DELETE FROM match_score WHERE event_id = $1', [eventId]);
    } else if (volunteerId && !eventId) {
      await db.query('DELETE FROM match_score WHERE volunteer_id = $1', [volunteerId]);
    }

    await db.query(
      `INSERT INTO match_score(event_id, volunteer_id, score)
      SELECT * FROM UNNEST($1::int[], $2::int[], $3::numeric[])
      ON CONFLICT (event_id, volunteer_id)
      DO UPDATE SET score = EXCLUDED.score, updated_at = now()`,
      [evArr, volArr, scrArr]);

    return { updated: totalRows };

  } catch (err) {
    throw err;
  }
}

if (require.main === module) {
  buildScores().then(r => {
    console.log('match_score rows updated:', r.updated);
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { buildScores };