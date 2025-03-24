# Cosmic Defenders API

## Proje Hakkında

Cosmic Defenders API, online oyun platformu için kullanıcı yönetimi, yetkilendirme ve veritabanı sorgulamaları sağlayan güçlü bir backend API hizmetidir. Flask tabanlı bu API, OAuth2 token tabanlı kimlik doğrulama, rol tabanlı yetkilendirme, oyuncu istatistikleri ve LangChain entegrasyonu ile doğal dil SQL sorguları gibi özellikler sunmaktadır.

## Özellikler

- **Kullanıcı Yönetimi**: Kayıt, giriş, kullanıcı profili güncellemeleri
- **Token Tabanlı Kimlik Doğrulama**: JWT (JSON Web Token) kullanarak güvenli kimlik doğrulama
- **Rol Tabanlı Yetkilendirme**: Admin ve oyuncu rolleri için farklı erişim hakları
- **Oyuncu İstatistikleri**: Oyuncu performansını izleme ve raporlama
- **Doğal Dil SQL Sorguları**: LangChain ve GPT entegrasyonu ile insan dilinde SQL sorguları
- **Rate Limiting**: API isteklerini sınırlandırma
- **Oracle Veritabanı Entegrasyonu**: Güçlü ve ölçeklenebilir veritabanı desteği

## Kurulum

### Önkoşullar

- Python 3.8+
- Oracle veritabanı (XE sürümü yeterlidir)
- Docker ve Docker Compose (opsiyonel)
- OpenAI API anahtarı (LangChain için)

### Lokal Kurulum

1. Repo'yu klonlayın:
   ```bash
   git clone https://github.com/username/cosmic-defenders-api.git
   cd cosmic-defenders-api
   ```

2. Sanal ortam oluşturun ve bağımlılıkları yükleyin:
   ```bash
   python -m venv venv
   source venv/bin/activate   # Linux/Mac
   # veya
   venv\Scripts\activate      # Windows
   pip install -r requirements.txt
   ```

3. `.env` dosyasını oluşturun:
   ```
   SECRET_KEY=your_secret_key
   ORACLE_USER=C##COSMIC_DEFENDERS
   ORACLE_PASSWORD=MyPassword123
   ORACLE_HOST=localhost
   ORACLE_PORT=1521
   ORACLE_SID=XE
   OPENAI_API_KEY=your_openai_api_key
   ```

4. Uygulamayı çalıştırın:
   ```bash
   python app.py
   ```

### Docker ile Kurulum

1. Docker Compose dosyasıyla hizmetleri başlatın:
   ```bash
   docker-compose up -d
   ```

## API Endpoints

### Kimlik Doğrulama

- `POST /register`: Yeni kullanıcı kaydı
- `POST /login`: Kullanıcı girişi ve token alma

### Kullanıcı İşlemleri

- `GET /user-info`: Mevcut kullanıcı bilgisi
- `GET /player-stats`: Oyuncu istatistikleri

### Admin İşlemleri

- `GET /admin-only`: Admin paneli verileri
- `POST /admin/sql-query`: Doğal dil SQL sorguları
- `POST /admin/update-user-role`: Kullanıcı rolünü güncelleme
- `DELETE /admin/delete-user`: Kullanıcı silme

## Veritabanı Şeması

Veritabanı şu tablolardan oluşmaktadır:

- `users`: Kullanıcı hesapları
- `player_profiles`: Oyuncu profilleri
- `game_scores`: Oyun skorları

## LangChain Entegrasyonu

Cosmic Defenders API, LangChain kütüphanesi ve GPT modeli kullanarak doğal dil SQL sorguları yapabilir. Bu sayede admin kullanıcılar karmaşık SQL sorguları yazmak yerine İngilizce cümlelerle veritabanı sorgulayabilir.

```
"Show me the top 5 players with the highest scores"
```

gibi bir sorgu otomatik olarak SQL'e çevrilir ve sonuçlar döndürülür.

## Güvenlik

- Şifreler bcrypt ile hashlenerek saklanır
- JWT tokenları ile kimlik doğrulama yapılır
- Rate limiting ile brute force saldırıları engellenir
- Rol tabanlı erişim kontrolü

## Development

### Debug Modu

Debug modunda çalıştırmak için:

```bash
export FLASK_ENV=development
export FLASK_DEBUG=1
python app.py
```

## İletişim

Sorularınız için furkanyrgn19@gmail.com adresine e-posta gönderebilirsiniz.
