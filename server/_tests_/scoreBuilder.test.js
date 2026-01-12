const { buildScores } = require('../utils/scoreBuilder');
jest.mock('../db', () => ({ query: jest.fn() }));
const db = require('../db');

describe('scoreBuilder — расчет баллов подходимости волонтёров', () => {
  it('возвращает 0, если нет мероприятий и волонтёров', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [] }) // events
      .mockResolvedValueOnce({ rows: [] }) // vols
      .mockResolvedValueOnce({ rows: [] }); // history
    const result = await buildScores();
    expect(result).toEqual({ updated: 0 });
  });

  it('рассчитывает баллы для заданных мероприятий и волонтёров', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [{ id: 1, rec_vol_hours: 10, category_id: 1, cat_name: 'Экология' }]
      })
      .mockResolvedValueOnce({
        rows: [{ id: 1, volunteer_hours: 15, skill: 'Организация экоакций' }]
      })
      .mockResolvedValueOnce({ rows: [] }) // history
      .mockResolvedValueOnce({}); // insert
    const result = await buildScores();
    expect(result.updated).toBeGreaterThan(0);
  });
});
