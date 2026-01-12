const { buildClusters } = require('../utils/clusterBuilder');
jest.mock('../db', () => ({ query: jest.fn() }));
const db = require('../db');

describe('clusterBuilder — алгоритм кластеризации мероприятий', () => {
  it('обрабатывает случай с пустым списком мероприятий', async () => {
    db.query.mockResolvedValueOnce({ rows: [] });
    const result = await buildClusters();
    expect(result).toEqual({ updated: 0 });
  });

  it('выделяет кластеры при пересечении событий по времени', async () => {
    db.query
      .mockResolvedValueOnce({
        rows: [
          { id: 1, start: new Date('2025-06-10'), finish: new Date('2025-06-11') },
          { id: 2, start: new Date('2025-06-11'), finish: new Date('2025-06-12') }
        ]
      })
      .mockResolvedValueOnce({}); // для UPDATE
    const result = await buildClusters();
    expect(result.updated).toBeGreaterThan(0);
  });
});