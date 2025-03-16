const API_BASE_URL = window.location.protocol + '//' + window.location.hostname + ':8000';

// API Yönetimi İçin Servis Sınıfı
class ApiService {
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
        this.token = null;
    }

    // Token ayarla
    setToken(token) {
        this.token = token;
    }

    // Token al
    getToken() {
        return this.token;
    }

    // Token temizle
    clearToken() {
        this.token = null;
    }

    // API isteği yap
    async request(endpoint, method = 'GET', body = null) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };
            
            if (this.token) {
                headers['Authorization'] = `Bearer ${this.token}`;
            }
            
            const options = {
                method,
                headers
            };
            
            if (body) {
                options.body = JSON.stringify(body);
            }
            
            const response = await fetch(`${this.baseUrl}${endpoint}`, options);
            const data = await response.json();
            
            // Yeni token kontrolü
            const newToken = response.headers.get('New-Token');
            if (newToken) {
                this.token = newToken;
            }
            
            return { 
                data, 
                status: response.status,
                newToken: newToken
            };
        } catch (error) {
            console.error('API request error:', error);
            throw error;
        }
    }
}

// ApiService örneği oluştur
const apiService = new ApiService(API_BASE_URL);
