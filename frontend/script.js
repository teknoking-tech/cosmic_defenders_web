// API URL - Use relative path for better compatibility
const API_URL = '/api';  // Veya gerçek sunucu adresi

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
    const statsContent = document.getElementById('player-stats-content');
    statsContent.innerHTML = '<div class="stats-loader">Yükleniyor...</div>';

    try {
        const response = await fetchWithToken(`${API_URL}/player-stats`);
        const data = await response.json();
        
        if (data.success) {
            statsContent.innerHTML = `
                <div class="stats-panel">
                    <div class="stats-cards">
                        <div class="stats-card">
                            <h3>Oyuncu Bilgileri</h3>
                            <p>Username: <span class="highlight">${data.data.username}</span></p>
                            <p>Nickname: <span class="highlight">${data.data.nickname}</span></p>
                            <p>Level: <span class="highlight">${data.data.level}</span></p>
                            <p>Deneyim: <span class="highlight">${data.data.deneyim}</span></p>
                        </div>
                        <div class="stats-card">
                            <h3>Oyun İstatistikleri</h3>
                            <p>Toplam Oyun: <span class="highlight">${data.data.total_games}</span></p>
                            <p>Toplam Skor: <span class="highlight">${data.data.total_score}</span></p>
                            <p>En Yüksek Skor: <span class="highlight">${data.data.highest_score}</span></p>
                            <p>Yenilen Düşmanlar: <span class="highlight">${data.data.enemies_defeated}</span></p>
                            <p>Toplanan Kaynaklar: <span class="highlight">${data.data.resources_collected}</span></p>
                        </div>
                    </div>
                </div>
            `;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('İstatistikler alınırken hata oluştu:', error);
        statsContent.innerHTML = `
            <div class="error-message">
                <p>İstatistikler alınamadı: ${error.message}</p>
                <button onclick="location.reload()">Tekrar Dene</button>
            </div>
        `;
    }
}

// Admin panelini getir
async function fetchAdminPanel() {
    const adminContent = document.getElementById('admin-panel-content');
    adminContent.innerHTML = '<div class="admin-loader">Yükleniyor...</div>';

    try {
        const response = await fetchWithToken(`${API_URL}/admin-only`);
        const data = await response.json();
        
        if (data.success) {
            adminContent.innerHTML = `
                <div class="admin-panel">
                    <h3>Admin Paneli</h3>
                    ${data.data.map(user => `
                        <div class="admin-card">
                            <p>Username: <span class="highlight">${user.username}</span></p>
                            <p>Email: <span class="highlight">${user.email}</span></p>
                            <p>Role: <span class="highlight">${user.role}</span></p>
                            <p>Nickname: <span class="highlight">${user.nickname}</span></p>
                            <p>Level: <span class="highlight">${user.level}</span></p>
                            <p>Deneyim: <span class="highlight">${user.deneyim}</span></p>
                            <p>Toplam Oyun: <span class="highlight">${user.total_games}</span></p>
                            <p>Toplam Skor: <span class="highlight">${user.total_score}</span></p>
                            <p>En Yüksek Skor: <span class="highlight">${user.highest_score}</span></p>
                            <p>Yenilen Düşmanlar: <span class="highlight">${user.enemies_defeated}</span></p>
                            <p>Toplanan Kaynaklar: <span class="highlight">${user.resources_collected}</span></p>
                        </div>
                    `).join('')}
                </div>
            `;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Admin paneli alınırken hata oluştu:', error);
        adminContent.innerHTML = `
            <div class="error-message">
                <p>Admin paneli alınamadı: ${error.message}</p>
                <button onclick="location.reload()">Tekrar Dene</button>
            </div>
        `;
    }
}

async function fetchUserInfo() {
    const userInfoContent = document.getElementById('user-info-content');
    userInfoContent.innerHTML = '<div class="info-loader">Yükleniyor...</div>';

    try {
        const response = await fetchWithToken(`${API_URL}/user-info`);
        const data = await response.json();
        
        if (data.success) {
            userInfoContent.innerHTML = `
                <div class="info-panel">
                    <h3>Kullanıcı Bilgileri</h3>
                    <p>User ID: <span class="highlight">${data.data.user_id}</span></p>
                    <p>Username: <span class="highlight">${data.data.username}</span></p>
                    <p>Email: <span class="highlight">${data.data.email}</span></p>
                    <p>Role: <span class="highlight">${data.data.role}</span></p>
                    <p>Created At: <span class="highlight">${data.data.created_at}</span></p>
                    <p>Last Login: <span class="highlight">${data.data.last_login}</span></p>
                </div>
            `;
        } else {
            throw new Error(data.message);
        }
    } catch (error) {
        console.error('Kullanıcı bilgileri alınırken hata oluştu:', error);
        userInfoContent.innerHTML = `
            <div class="error-message">
                <p>Kullanıcı bilgileri alınamadı: ${error.message}</p>
                <button onclick="location.reload()">Tekrar Dene</button>
            </div>
        `;
    }
}

async function runSqlQuery() {
    const queryInput = document.getElementById('sql-query-input');
    const resultDiv = document.getElementById('sql-query-result');
    
    if (!queryInput.value.trim()) {
        resultDiv.innerHTML = '<div class="error-message">Lütfen bir sorgu girin</div>';
        return;
    }
    
    resultDiv.innerHTML = '<div class="query-loader">Sorgu çalıştırılıyor... Bu biraz zaman alabilir.</div>';
    
    try {
        const response = await fetchWithToken(`${API_URL}/admin/sql-query`, {
            method: 'POST',
            body: JSON.stringify({ query: queryInput.value })
        });
        
        if (!response) {
            throw new Error('Yanıt alınamadı');
        }
        
        const data = await response.json();
        
        if (data.success) {
            resultDiv.innerHTML = `
                <div class="query-success">
                    <h4>Sorgu Sonucu:</h4>
                    <div class="query-output">${formatQueryResult(data.result)}</div>
                </div>
            `;
        } else {
            throw new Error(data.message || 'Sorgu başarısız oldu');
        }
    } catch (error) {
        console.error('SQL sorgu hatası:', error);
        resultDiv.innerHTML = `
            <div class="error-message">
                <p>Sorgu çalıştırılırken hata: ${error.message}</p>
            </div>
        `;
    }
}

// Sorgu sonuçlarını formatlama yardımcı fonksiyonu
function formatQueryResult(result) {
    // Eğer sonuç bir string ise (LangChain'den)
    if (typeof result === 'string') {
        // Eğer tablo içeriyorsa, formatlamaya çalış
        if (result.includes('|')) {
            try {
                // Basit markdown tablosunu HTML'e dönüştürme
                const lines = result.split('\n').filter(line => line.trim());
                let html = '<table class="query-table">';
                
                lines.forEach((line, index) => {
                    const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                    
                    if (index === 0) {
                        // Başlık satırı
                        html += '<thead><tr>';
                        cells.forEach(cell => {
                            html += `<th>${cell}</th>`;
                        });
                        html += '</tr></thead><tbody>';
                    } else if (index === 1 && line.includes('---')) {
                        // Markdown'da ayırıcı satır, HTML'de atla
                    } else {
                        // Veri satırları
                        html += '<tr>';
                        cells.forEach(cell => {
                            html += `<td>${cell}</td>`;
                        });
                        html += '</tr>';
                    }
                });
                
                html += '</tbody></table>';
                return html;
            } catch (e) {
                console.error('Tablo formatlanırken hata:', e);
                return `<pre>${result}</pre>`;
            }
        } else {
            // Tablo tespit edilmediyse önceden formatlanmış metin olarak döndür
            return `<pre>${result}</pre>`;
        }
    } else if (Array.isArray(result)) {
        // Eğer obje dizisiyse, tablo oluştur
        if (result.length === 0) {
            return '<p>Sonuç bulunamadı</p>';
        }
        
        const keys = Object.keys(result[0]);
        let html = '<table class="query-table"><thead><tr>';
        
        keys.forEach(key => {
            html += `<th>${key}</th>`;
        });
        
        html += '</tr></thead><tbody>';
        
        result.forEach(row => {
            html += '<tr>';
            keys.forEach(key => {
                html += `<td>${row[key]}</td>`;
            });
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        return html;
    } else {
        // Diğer türler için JSON formatla
        return `<pre>${JSON.stringify(result, null, 2)}</pre>`;
    }
}

// Mevcut DOMContentLoaded event listener'ınıza ekleyin
document.addEventListener('DOMContentLoaded', () => {
    // ... mevcut kodlar ...
    
    // SQL Sorgu butonunu dinle
    const runQueryBtn = document.getElementById('run-sql-query-btn');
    if (runQueryBtn) {
        runQueryBtn.addEventListener('click', runSqlQuery);
        
        // Textarea'da Ctrl+Enter ile sorgu çalıştırma
        const queryInput = document.getElementById('sql-query-input');
        if (queryInput) {
            queryInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    runSqlQuery();
                }
            });
        }
    }
});

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Sunucu durumunu kontrol et
    checkServerStatus();
    
    // UI güncelle
    updateUI();
    
    // Kullanıcı bilgilerini getir
    fetchUserInfo();
    
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
        
        // API'den verileri çekmek için fonksiyonu çağır
        await fetchPlayerStats();
    });
    
    adminPanelLink.addEventListener('click', async (e) => {
        e.preventDefault();
        showSection(adminPanelSection);
        
        // API'den verileri çekmek için fonksiyonu çağır
        await fetchAdminPanel();
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