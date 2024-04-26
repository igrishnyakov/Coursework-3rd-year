export class ApiService {
    #apiPath = 'http://localhost:3001/api'

    #makeRequest(url, options) {
        return fetch(this.#apiPath + url, {
            ...options,
            credentials: 'include'
        }).then(res => res.json())
    }

    get(url) {
        return this.#makeRequest(url, { method: 'GET' })
    }

    delete(url) {
        return this.#makeRequest(url, { method: 'DELETE' })
    }

    post(url, data) {
        return this.#makeRequest(url, {
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data),
            method: 'POST'
        })
    }
}