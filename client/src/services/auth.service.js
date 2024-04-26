import { ApiService } from './api.service'

export class AuthService {
    apiService = new ApiService()
    checkSession() {
        return this.apiService.get('/checkSession')
    }
    login(userRecord) {
        return this.apiService.post('/login', userRecord)
    }
    register(userRecord) {
        return this.apiService.post('/register', userRecord)
    }
    logout() {
        return this.apiService.get('/logout')
    }
}