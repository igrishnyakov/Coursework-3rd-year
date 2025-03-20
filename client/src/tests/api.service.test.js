import { ApiService } from '../services/api.service';

global.fetch = jest.fn(() =>
    Promise.resolve({
        json: () => Promise.resolve({ message: 'success' }),
    })
);

describe('ApiService', () => {
    let apiService;

    beforeEach(() => {
        apiService = new ApiService();
        fetch.mockClear();
    });

    it('метод get выполнил GET запрос, возвращающий JSON объект', async () => {
        const response = await apiService.get('/test');
        expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/test', {
            method: 'GET',
            credentials: 'include',
        });
        expect(response).toEqual({ message: 'success' });
    });

    it('метод delete выполнил DELETE запрос', async () => {
        const response = await apiService.delete('/test');
        expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/test', {
            method: 'DELETE',
            credentials: 'include',
        });
        expect(response).toEqual({ message: 'success' });
    });

    it('метод post выполнил POST запрос с JSON объектом', async () => {
        const postData = { key: 'value' };
        const response = await apiService.post('/test', postData);
        expect(fetch).toHaveBeenCalledWith('http://localhost:3001/api/test', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(postData),
        });
        expect(response).toEqual({ message: 'success' });
    });
});