from flask import Flask, request, jsonify, make_response, Response
import jwt
from flask_cors import CORS
import oracledb
import bcrypt
import os
from functools import wraps
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
from abc import ABC, abstractmethod

# .env dosyasını yükle
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'dev_secret_key')
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, expose_headers=["New-Token"])

# Oracle bağlantı bilgileri
oracle_user = os.getenv('ORACLE_USER', 'C##COSMIC_DEFENDERS')
oracle_password = os.getenv('ORACLE_PASSWORD', 'MyPassword123')
oracle_host = os.getenv('ORACLE_HOST', 'oracle-db')
oracle_port = os.getenv('ORACLE_PORT', '1521')
oracle_sid = os.getenv('ORACLE_SID', 'XE')

oracle_connection_string = f"{oracle_user}/{oracle_password}@{oracle_host}:{oracle_port}/{oracle_sid}"

def get_db_connection():
    return oracledb.connect(oracle_connection_string)

# Kullanıcı rol sınıfları için temel sınıf
class UserRole(ABC):
    @property
    @abstractmethod
    def role_name(self):
        pass
    
    @property
    @abstractmethod
    def rate_limit(self):
        pass
    
    @property
    def token_expiry(self):
        return timedelta(hours=1)
    
    def can_access_endpoint(self, endpoint):
    # Oyuncular için kısıtlı endpoint erişimleri
        player_allowed_endpoints = [
        '/protected-endpoint',
        '/player-stats',  # Bu endpoint'i ekleyin
        # Diğer oyuncu endpointleri eklenebilir
      ]
        return endpoint in player_allowed_endpoints

# Oyuncu rolü
class PlayerRole(UserRole):
    @property
    def role_name(self):
        return "player"
    
    @property
    def rate_limit(self):
        return 5
    
    def can_access_endpoint(self, endpoint):
        # Oyuncular için kısıtlı endpoint erişimleri
        player_allowed_endpoints = [
            '/protected-endpoint',
            # Diğer oyuncu endpointleri eklenebilir
        ]
        return endpoint in player_allowed_endpoints

# Admin rolü
class AdminRole(UserRole):
    @property
    def role_name(self):
        return "admin"
    
    @property
    def rate_limit(self):
        return 10
    
    def can_access_endpoint(self, endpoint):
        # Adminler tüm endpointlere erişebilir
        return True

# Rol fabrikası
class RoleFactory:
    @staticmethod
    def get_role(role_name):
        if role_name == "admin":
            return AdminRole()
        else:
            return PlayerRole()  # Varsayılan rol player

# JWT token doğrulama decorator'ı
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            bearer = request.headers['Authorization']
            if bearer and bearer.startswith('Bearer '):
                token = bearer.split()[1]
        
        if not token:
            return jsonify({'message': 'Token gerekli!'}), 401
        
        try:
            # Token çözümleme
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            
            # Kullanıcı rolünü belirle
            role_name = data.get('role', 'player')
            user_role = RoleFactory.get_role(role_name)
            
            # Rate limit kontrolü
            # Token kontrolünde rate limit değerini arttır
            if data['usage_count'] >= user_role.rate_limit * 5:  # Daha yüksek bir değer
                return jsonify({'message': 'Token kullanım limiti aşıldı!'}), 403
            
            # Endpoint erişim kontrolü
            if not user_role.can_access_endpoint(request.path):
                return jsonify({'message': 'Bu endpoint için yetkiniz yok!'}), 403
            
            # Yeni token oluştur
            new_token = jwt.encode({
                'user_id': data['user_id'],
                'role': user_role.role_name,
                'usage_count': data['usage_count'] + 1,
                'exp': datetime.now(timezone.utc) + user_role.token_expiry
            }, app.config['SECRET_KEY'], algorithm="HS256")
            
            # Hata ayıklama için kullanıcı ID'sini logla
            print(f"İşlem yapılan kullanıcı ID: {data['user_id']}, Rol: {user_role.role_name}")
            
            try:
                # Orijinal fonksiyonu çağır ve yanıtı al
                original_response = f(*args, **kwargs)
                
                # Yanıt tipini logla - hata ayıklama için
                print(f"Fonksiyon yanıt tipi: {type(original_response)}")
                
                # Yanıt tipine göre işleme
                if isinstance(original_response, Response):
                    # Response nesnesi kopya oluşturmadan header ekle
                    original_response.headers['New-Token'] = new_token
                    return original_response
                
                elif isinstance(original_response, tuple) and len(original_response) == 2:
                    # (data, status_code) şeklinde tuple
                    response_body, status_code = original_response
                    # Tuple içindeki veri tipini kontrol et
                    print(f"Tuple içindeki veri tipi: {type(response_body)}")
                    
                    if isinstance(response_body, dict):
                        response = make_response(jsonify(response_body), status_code)
                    else:
                        # Dict değilse güvenli dönüşüm
                        response = make_response(str(response_body), status_code)
                    
                    response.headers['New-Token'] = new_token
                    return response
                
                elif isinstance(original_response, dict):
                    # Dict ise jsonify kullan
                    response = make_response(jsonify(original_response))
                    response.headers['New-Token'] = new_token
                    return response
                
                else:
                    # String veya diğer tipler için
                    print(f"Diğer tip yanıt: {original_response}")
                    try:
                        # Önce JSON yapılabilir mi kontrol et
                        json_response = jsonify({"message": str(original_response)})
                        response = make_response(json_response)
                    except:
                        # JSON yapılamazsa string olarak dön
                        response = make_response(str(original_response))
                    
                    response.headers['New-Token'] = new_token
                    return response
                
            except Exception as func_error:
                # Orijinal fonksiyon çağrısında hata
                print(f"Fonksiyon çağrı hatası: {str(func_error)}")
                return jsonify({'message': f'İşlem hatası: {str(func_error)}'}), 500
                
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token süresi dolmuş!'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Geçersiz token!'}), 401
        except Exception as e:
            print(f"Token doğrulama hatası: {str(e)}")
            return jsonify({'message': f'Token doğrulama hatası!'}), 500
    
    return decorated

# Belirli bir role sahip kullanıcıların erişimini kısıtlamak için decorator
def role_required(allowed_roles):
    def decorator(f):
        @wraps(f)
        @token_required  # Önce token doğrula
        def decorated_function(*args, **kwargs):
            # Token zaten token_required tarafından doğrulandı, şimdi rol kontrolü yap
            token = request.headers['Authorization'].split()[1]
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            
            role = data.get('role', 'player')
            
            if role not in allowed_roles:
                return jsonify({'message': 'Bu işlem için yetkiniz yok!'}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


@app.route('/test-db', methods=['GET'])
def test_db():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1 FROM DUAL")
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result:
            return jsonify({'message': 'Veritabanı bağlantısı başarılı!', 'result': result[0]}), 200
        else:
            return jsonify({'message': 'Veritabanı bağlantısı başarılı ancak veri alınamadı.'}), 500
            
    except Exception as e:
        return jsonify({'message': 'Veritabanı hatası!', 'error': str(e)}), 500
@app.route('/')
def home():
    return jsonify({'message': 'Uygulama çalışıyor!'}), 200

@app.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('username') or not data.get('password') or not data.get('email'):
        return jsonify({'message': 'Eksik bilgi!'}), 400
    
    # Şifreyi bcrypt ile hashle
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    
    # Role kontrolü - sadece player veya admin olabilir
    role = data.get('role', 'player')
    if role not in ['player', 'admin']:
        role = 'player'  # Geçersiz roller için varsayılan player
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        user_id_var = cursor.var(int)
        cursor.execute("INSERT INTO users (username, password, email, role) VALUES (:1, :2, :3, :4) RETURNING user_id INTO :5", 
                       (data['username'], hashed_password, data['email'], role, user_id_var))
        
        conn.commit()
        user_id = user_id_var.getvalue()[0]
        
        cursor.close()
        conn.close()
        
        return jsonify({'message': 'Kullanıcı başarıyla oluşturuldu!', 'user_id': user_id, 'role': role}), 201
        
    except oracledb.DatabaseError as e:
        error, = e.args
        return jsonify({'message': 'Veritabanı hatası!', 'error': error.message}), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Eksik bilgi!'}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = :1", (data['username'],))
        user = cursor.fetchone()

        if not user or not bcrypt.checkpw(data['password'].encode('utf-8'), user[2].encode('utf-8')):
            return jsonify({'message': 'Geçersiz kullanıcı adı veya şifre!'}), 401
        
        # Kullanıcı rolünü belirle
        role = user[4] if user[4] in ['player', 'admin'] else 'player'
        user_role = RoleFactory.get_role(role)
        
        # Token üret
        token = jwt.encode({
            'user_id': user[0],
            'role': role,
            'usage_count': 0,
            'exp': datetime.now(timezone.utc) + user_role.token_expiry
        }, app.config['SECRET_KEY'], algorithm="HS256")
        
        cursor.close()
        conn.close()

        return jsonify({
            'token': token,
            'role': role,
            'rate_limit': user_role.rate_limit
        }), 200
        
    except oracledb.DatabaseError as e:
        error, = e.args
        return jsonify({'message': 'Veritabanı hatası!', 'error': error.message}), 500

@app.route('/protected-endpoint', methods=['GET'])
@token_required
def protected():
    print("Protected endpoint çağrıldı")
    return jsonify({"message": "Bu endpoint'e eriştin!"}), 200

@app.route('/admin-only', methods=['GET'])
@role_required(['admin'])
def admin_only():
    return jsonify({"message": "Admin paneline hoş geldiniz!"}), 200

# Örnek oyuncu endpoint'i
# Add these routes
@app.route('/player-stats', methods=['GET'])
@token_required
def player_stats():
    # Get user_id from token
    token = request.headers['Authorization'].split()[1]
    data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
    user_id = data['user_id']
    
    # Return sample data for now
    return jsonify({
        "message": "Oyuncu istatistikleri başarıyla alındı",
        "games": 27,
        "wins": 18,
        "losses": 9,
        "total_score": 1240,
        "highest_score": 215
    }), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)