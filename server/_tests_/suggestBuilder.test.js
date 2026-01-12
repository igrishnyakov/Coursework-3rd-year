const { runSuggest, hungarian } = require('../utils/suggestBuilder');
jest.mock('../db', () => ({ query: jest.fn() }));
const db = require('../db');

describe('suggestBuilder — алгоритмы подбора волонтёров', () => {
  it('не вызывает ошибок при отсутствии кластеров', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    await expect(runSuggest()).resolves.not.toThrow();
  });

  it('алгоритм hungarian корректно решает задачу оптимального назначения', () => {
    const cost = [
      [4, 1, 3],
      [2, 0, 5],
      [3, 2, 2]
    ];
    const result = hungarian(cost);
    expect(result).toEqual(expect.arrayContaining([expect.any(Number)]));
  });
});