// API URL
const API_URL = 'http://172.29.0.2:8000';
// DOM elementleri
const homeLink = document.getElementById('home-link');
const loginLink = document.getElementById('login-link');
const registerLink = document.getElementById('register-link');
const playerStatsLink = document.getElementById('player-stats-link');
const adminPanelLink = document.getElementById('admin-panel-link');
const logoutLink = document.getElementById('logout-link');

const homeSection = document.getElementById('home-section');
const loginSection = document.getElementById('login-section');
const registerSection = document.getElementById('register-section');
const playerStatsSection = document.getElementById('player-stats-section');
const adminPanelSection = document.getElementById('admin-panel-section');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginMessage = document.getElementById('login-message');
const registerMessage = document.getElementById('register-message');

// Yardımcı fonksiyonlar
function showSection(section) {
    // Tüm bölümleri gizle
    const sections = document.querySelectorAll('.section');
    sections.forEach(s => s.classList.add('hidden'));
    
    // Seçilen bölümü göster
    section.classList.remove('hidden');
    
    // Aktif link stilini güncelle
    const links = document.querySelectorAll('nav ul li a');
    links.forEach(link => link.classList.remove('active'));
    
    // Aktif linki belirle
    if (section === homeSection) {
        homeLink.classList.add('active');
    } else if (section === loginSection) {
        loginLink.classList.add('active');
    } else if (section === registerSection) {
        registerLink.classList.add('active');
    } else if (section === playerStatsSection) {
        playerStatsLink.classList.add('active');
    } else if (section === adminPanelSection) {
        adminPanelLink.classList.add('active');
    }
}

function showMessage(element, message, isError = false) {
    element.textContent = message;
    element.classList.remove('success', 'error');
    element.classList.add(isError ? 'error' : 'success');
    
    // 5 saniye sonra mesajı temizle
    setTimeout(() => {
        element.textContent = '';
        element.classList.remove('success', 'error');
    }, 5000);
}

function updateUI() {
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    
    if (token) {
        // Giriş yapılmış
        loginLink.classList.add('hidden');
        registerLink.classList.add('hidden');
        logoutLink.classList.remove('hidden');
        playerStatsLink.classList.remove('hidden');
        
        // Admin kontrolü
        if (userRole === 'admin') {
            adminPanelLink.classList.remove('hidden');
        } else {
            adminPanelLink.classList.add('hidden');
        }
    } else {
        // Giriş yapılmamış
        loginLink.classList.remove('hidden');
        registerLink.classList.remove('hidden');
        logoutLink.classList.add('hidden');
        playerStatsLink.classList.add('hidden');
        adminPanelLink.classList.add('hidden');
    }
}

async function fetchWithToken(url, options = {}) {
    const token = localStorage.getItem('token');
    if (!token) {
        throw new Error('Token bulunamadı');
    }
    
    // Headers ekleme
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    options.headers = headers;
    
    // Fetch işlemi
    const response = await fetch(url, options);
    
    // Yeni token varsa güncelle
    const newToken = response.headers.get('New-Token');
    if (newToken) {
        localStorage.setItem('token', newToken);
    }
    
    return response;
}

// Oyuncu istatistiklerini getir
async function fetchPlayerStats() {
    try {
        const response = await fetchWithToken(`${API_URL}/player-stats`);
        if (!response.ok) {
            throw new Error('İstatistikler alınamadı');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('İstatistikler alınırken hata oluştu:', error);
        return null;
    }
}

// Admin panelini getir
async function fetchAdminPanel() {
    try {
        const response = await fetchWithToken(`${API_URL}/admin-only`);
        if (!response.ok) {
            throw new Error('Admin paneli alınamadı');
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Admin paneli alınırken hata oluştu:', error);
        return null;
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // UI güncelle
    updateUI();
    
    // Navigasyon
    homeLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(homeSection);
    });
    
    loginLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(loginSection);
    });
    
    registerLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSection(registerSection);
    });
    
    playerStatsLink.addEventListener('click', async (e) => {
        e.preventDefault();
        showSection(playerStatsSection);
        
        const statsContent = document.getElementById('player-stats-content');
        statsContent.innerHTML = '<div class="stats-loader">Yükleniyor...</div>';
        
        const stats = await fetchPlayerStats();
        if (stats) {
            statsContent.innerHTML = `
                <div class="stats-panel">
                    <p>${stats.message}</p>
                    <p>Yakında daha detaylı istatistikler burada gösterilecek.</p>
                </div>
            `;
        } else {
            statsContent.innerHTML = `
                <div class="stats-panel error">
                    <p>İstatistikler alınamadı. Lütfen tekrar giriş yapın.</p>
                </div>
            `;
        }
    });
    
    adminPanelLink.addEventListener('click', async (e) => {
        e.preventDefault();
        showSection(adminPanelSection);
        
        const adminContent = document.getElementById('admin-panel-content');
        adminContent.innerHTML = '<div class="stats-loader">Yükleniyor...</div>';
        
        const adminData = await fetchAdminPanel();
        if (adminData) {
            adminContent.innerHTML = `
                <div class="stats-panel">
                    <p>${adminData.message}</p>
                    <p>Admin paneli detayları burada gösterilecek.</p>
                </div>
            `;
        } else {
            adminContent.innerHTML = `
                <div class="stats-panel error">
                    <p>Admin paneli alınamadı. Yetkiniz olmayabilir veya tekrar giriş yapmanız gerekebilir.</p>
                </div>
            `;
        }
    });
    
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Çıkış yap
        localStorage.removeItem('token');
        localStorage.removeItem('userRole');
        
        // UI güncelle
        updateUI();
        
        // Ana sayfaya yönlendir
        showSection(homeSection);
    });
    
    // Login form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Token ve rol bilgisini kaydet
                localStorage.setItem('token', data.token);
                localStorage.setItem('userRole', data.role);
                
                // Başarı mesajı göster
                showMessage(loginMessage, 'Giriş başarılı! Yönlendiriliyorsunuz...');
                
                // UI güncelle
                updateUI();
                
                // Formu temizle
                loginForm.reset();
                
                // 1 saniye sonra ana sayfaya yönlendir
                setTimeout(() => {
                    showSection(homeSection);
                }, 1000);
            } else {
                showMessage(loginMessage, data.message || 'Giriş başarısız!', true);
            }
        } catch (error) {
            console.error('Giriş hatası:', error);
            showMessage(loginMessage, 'Bir hata oluştu. Lütfen tekrar deneyin.', true);
        }
    });
    
    // Register form
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        // Şifre kontrolü
        if (password !== confirmPassword) {
            showMessage(registerMessage, 'Şifreler eşleşmiyor!', true);
            return;
        }
        
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                // Başarı mesajı göster
                showMessage(registerMessage, 'Kayıt başarılı! Giriş yapabilirsiniz.');
                
                // Formu temizle
                registerForm.reset();
                
                // 2 saniye sonra giriş sayfasına yönlendir
                setTimeout(() => {
                    showSection(loginSection);
                }, 2000);
            } else {
                showMessage(registerMessage, data.message || 'Kayıt başarısız!', true);
            }
        } catch (error) {
            console.error('Kayıt hatası:', error);
            showMessage(registerMessage, 'Bir hata oluştu. Lütfen tekrar deneyin.', true);
        }
    });
});