// API URL - Use relative path for better compatibility
const API_URL = 'http://localhost:8000';  // Veya gerçek sunucu adresi

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

// Status gösterici
let statusIndicator = document.createElement('div');
statusIndicator.className = 'status-indicator';
document.body.appendChild(statusIndicator);

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

function showNotification(message, type = 'info') {
    statusIndicator.textContent = message;
    statusIndicator.className = `status-indicator ${type}`;
    statusIndicator.style.display = 'block';
    
    setTimeout(() => {
        statusIndicator.style.display = 'none';
    }, 3000);
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
    headers['Content-Type'] = 'application/json';  // Content-Type ekleyin
    options.headers = headers;
    
    // Mode ekleyin
    options.mode = 'cors';
    
    try {
        // Fetch işlemi
        const response = await fetch(url, options);
        
        // Yanıt kontrolü
        if (!response.ok && response.status !== 401) {
            console.error('API yanıt hatası:', response.status);
            const errorData = await response.json().catch(() => ({}));
            console.error('Hata detayları:', errorData);
        }
        
        // Yeni token varsa güncelle
        const newToken = response.headers.get('New-Token');
        if (newToken) {
            localStorage.setItem('token', newToken);
            console.log('Token yenilendi');
        }
        
        // Token süresi dolmuşsa veya geçersizse çıkış yap
        if (response.status === 401) {
            const data = await response.json().catch(() => ({}));
            if (data.message && (data.message.includes('Token süresi dolmuş') || data.message.includes('Geçersiz token'))) {
                logoutUser('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
                return null;
            }
        }
        
        return response;
    } catch (error) {
        console.error('API isteği başarısız:', error);
        showNotification('Sunucu bağlantısında hata oluştu. Lütfen daha sonra tekrar deneyin.', 'error');
        return null;
    }
}

function logoutUser(message = null) {
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    updateUI();
    showSection(homeSection);
    if (message) {
        showNotification(message, 'warning');
    }
}

// Sunucu durumunu kontrol et
async function checkServerStatus() {
    try {
        const response = await fetch(`${API_URL}/`);
        if (response.ok) {
            console.log('Sunucu çalışıyor');
            showNotification('Sunucu bağlantısı başarılı', 'success');
        } else {
            console.error('Sunucu hatası:', response.status);
            showNotification('Sunucu bağlantısı başarısız: ' + response.status, 'error');
        }
    } catch (error) {
        console.error('Sunucu bağlantı hatası:', error);
        showNotification('Sunucu bağlantısı kurulamadı', 'error');
    }
}

// Oyuncu istatistiklerini getir
async function fetchPlayerStats() {
    try {
        console.log('Fetching player stats...');
        const response = await fetchWithToken(`${API_URL}/player-stats`);
        console.log('Player stats response:', response);
        
        if (!response || !response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Stats error details:', errorData);
            throw new Error('İstatistikler alınamadı: ' + (errorData.message || ''));
        }
        
        const data = await response.json();
        console.log('Player stats data:', data);
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
        if (!response || !response.ok) {
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
    // Sunucu durumunu kontrol et
    checkServerStatus();
    
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
                    <div class="stats-cards">
                        <div class="stats-card">
                            <h3>Oyun İstatistikleri</h3>
                            <p>Toplam Oyun: <span class="highlight">27</span></p>
                            <p>Kazanılan: <span class="highlight">18</span></p>
                            <p>Kaybedilen: <span class="highlight">9</span></p>
                        </div>
                        <div class="stats-card">
                            <h3>Skor</h3>
                            <p>Toplam Puan: <span class="highlight">1240</span></p>
                            <p>En Yüksek Skor: <span class="highlight">215</span></p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            statsContent.innerHTML = `
                <div class="stats-panel error">
                    <p>İstatistikler alınamadı. Lütfen tekrar giriş yapın.</p>
                    <button class="retry-button" onclick="window.location.reload()">Tekrar Dene</button>
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
                    <div class="admin-controls">
                        <div class="admin-card">
                            <h3>Kullanıcı Yönetimi</h3>
                            <button class="admin-button">Kullanıcıları Listele</button>
                            <button class="admin-button">Yeni Kullanıcı</button>
                        </div>
                        <div class="admin-card">
                            <h3>Sistem İstatistikleri</h3>
                            <p>Toplam Kullanıcı: <span class="highlight">425</span></p>
                            <p>Aktif Oturum: <span class="highlight">32</span></p>
                            <p>Günlük Yeni Kayıt: <span class="highlight">7</span></p>
                        </div>
                    </div>
                    <div class="admin-logs">
                        <h3>Son Aktiviteler</h3>
                        <ul class="log-list">
                            <li><span class="log-time">12:45</span> <span class="log-user">user123</span> giriş yaptı</li>
                            <li><span class="log-time">12:30</span> <span class="log-user">cosmicgamer</span> yeni kayıt</li>
                            <li><span class="log-time">12:15</span> <span class="log-user">admin1</span> kullanıcı düzenledi</li>
                        </ul>
                    </div>
                </div>
            `;
        } else {
            adminContent.innerHTML = `
                <div class="stats-panel error">
                    <p>Admin paneli alınamadı. Yetkiniz olmayabilir veya tekrar giriş yapmanız gerekebilir.</p>
                    <button class="retry-button" onclick="window.location.reload()">Tekrar Dene</button>
                </div>
            `;
        }
    });
    
    logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        logoutUser('Başarıyla çıkış yapıldı');
    });
    
    // Login form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        
        if (!username || !password) {
            showMessage(loginMessage, 'Kullanıcı adı ve şifre gerekli!', true);
            return;
        }
        
        try {
            showMessage(loginMessage, 'Giriş yapılıyor...');
            
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
                showNotification(`Hoş geldiniz, ${username}!`, 'success');
                
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
                showNotification('Giriş başarısız!', 'error');
            }
        } catch (error) {
            console.error('Giriş hatası:', error);
            showMessage(loginMessage, 'Bir hata oluştu. Lütfen tekrar deneyin.', true);
            showNotification('Sunucu hatası, lütfen daha sonra tekrar deneyin', 'error');
        }
    });
    
    // Register form
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('register-username').value;
        const email = document.getElementById('register-email').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm-password').value;
        
        // Form doğrulama
        if (!username || !email || !password || !confirmPassword) {
            showMessage(registerMessage, 'Tüm alanları doldurun!', true);
            return;
        }
        
        // Email doğrulama
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(email)) {
            showMessage(registerMessage, 'Geçerli bir e-posta adresi girin!', true);
            return;
        }
        
        // Şifre kontrolü
        if (password !== confirmPassword) {
            showMessage(registerMessage, 'Şifreler eşleşmiyor!', true);
            return;
        }
        
        // Şifre güçlü mü kontrolü
        if (password.length < 8) {
            showMessage(registerMessage, 'Şifre en az 8 karakter olmalıdır!', true);
            return;
        }
        
        try {
            showMessage(registerMessage, 'Kayıt yapılıyor...');
            
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
                showNotification('Kayıt başarılı! Şimdi giriş yapabilirsiniz.', 'success');
                
                // Formu temizle
                registerForm.reset();
                
                // 2 saniye sonra giriş sayfasına yönlendir
                setTimeout(() => {
                    showSection(loginSection);
                }, 2000);
            } else {
                showMessage(registerMessage, data.message || 'Kayıt başarısız!', true);
                showNotification('Kayıt işlemi başarısız oldu!', 'error');
            }
        } catch (error) {
            console.error('Kayıt hatası:', error);
            showMessage(registerMessage, 'Bir hata oluştu. Lütfen tekrar deneyin.', true);
            showNotification('Sunucu hatası, lütfen daha sonra tekrar deneyin', 'error');
        }
    });
});
// Arka plan yıldızlarını ve gezegenleri oluşturan kod
document.addEventListener('DOMContentLoaded', () => {
    // Container elementi
    const container = document.querySelector('.container');
    
    // Yıldızlar için bir div oluştur
    const starsContainer = document.createElement('div');
    starsContainer.className = 'stars';
    document.body.appendChild(starsContainer);
    
    // Rastgele 100 yıldız oluştur
    for (let i = 0; i < 100; i++) {
        createStar();
    }
    
    // Gezegenler ekle
    const planet1 = document.createElement('div');
    planet1.className = 'planet planet-1';
    container.appendChild(planet1);
    
    const planet2 = document.createElement('div');
    planet2.className = 'planet planet-2';
    container.appendChild(planet2);
    
    // Gezegenlerin hareketleri için izleyici
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        planet1.style.transform = `translate(${x * 20}px, ${y * 20}px)`;
        planet2.style.transform = `translate(${-x * 15}px, ${-y * 15}px)`;
    });
    
    // UI butonlarına glow efekti ekle
    const buttons = document.querySelectorAll('button');
    buttons.forEach(button => {
        button.classList.add('glow-button');
    });
    
    // Link elementlerine geçiş efekti ekle
    const navLinks = document.querySelectorAll('nav ul li a');
    navLinks.forEach(link => {
        link.classList.add('glow-button');
    });
});

// Yıldız oluşturma fonksiyonu
function createStar() {
    const star = document.createElement('div');
    star.className = 'star';
    
    // Rastgele boyut (1-3px)
    const size = Math.random() * 2 + 1;
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    
    // Rastgele konum
    const posX = Math.random() * window.innerWidth;
    const posY = Math.random() * window.innerHeight;
    star.style.left = `${posX}px`;
    star.style.top = `${posY}px`;
    
    // Rastgele parlama süresi (2-6 saniye)
    const duration = Math.random() * 4 + 2;
    star.style.animationDuration = `${duration}s`;
    
    // Rastgele gecikme (0-5 saniye)
    const delay = Math.random() * 5;
    star.style.animationDelay = `${delay}s`;
    
    // Yıldızı ekle
    document.querySelector('.stars').appendChild(star);
}