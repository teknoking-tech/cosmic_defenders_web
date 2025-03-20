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
from contextlib import contextmanager

# Güncel LangChain import'ları
from langchain_community.utilities.sql_database import SQLDatabase
from langchain_openai import ChatOpenAI
from langchain.agents import create_sql_agent
from langchain.agents.agent_types import AgentType
from langchain.agents.agent_toolkits import SQLDatabaseToolkit


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



# Güncel kurulum kodu
def setup_langchain_sql_agent():
    """LangChain SQL agent'ı güncel sürüme göre kurar ve yapılandırır."""
    openai_api_key = os.getenv('OPENAI_API_KEY')
    if not openai_api_key:
        print("Uyarı: OPENAI_API_KEY ortam değişkeninde bulunamadı")
        return None
    
    try:
        # Oracle bağlantı bilgileri
        oracle_user = os.getenv('ORACLE_USER', 'C##COSMIC_DEFENDERS')
        oracle_password = os.getenv('ORACLE_PASSWORD', 'MyPassword123')
        oracle_host = os.getenv('ORACLE_HOST', 'oracle-db')
        oracle_port = os.getenv('ORACLE_PORT', '1521')
        oracle_sid = os.getenv('ORACLE_SID', 'XE')
        
        # Oracle için SQLAlchemy connection string
        db_url = f"oracle+oracledb://{oracle_user}:{oracle_password}@{oracle_host}:{oracle_port}/?service_name={oracle_sid}"
        
        # SQLDatabase oluştur
        db = SQLDatabase.from_uri(
            db_url,
            sample_rows_in_table_info=3,  # Her tablodaki örnek satır sayısı
            include_tables=None,  # Tüm tabloları dahil et (isteğe bağlı olarak belirli tabloları listeleyebilirsiniz)
            exclude_tables=None,  # Hariç tutulacak tablo yok
        )
        
        # LLM modeli oluştur (ChatOpenAI)
        llm = ChatOpenAI(
            temperature=0,  # Deterministik yanıtlar için
            api_key=openai_api_key,
            model="gpt-3.5-turbo",  # veya gpt-4 daha iyi SQL anlama için
        )
        
        # SQL toolkit oluştur
        toolkit = SQLDatabaseToolkit(
            db=db,
            llm=llm
        )
        
        # SQL Agent oluştur
        agent_executor = create_sql_agent(
            llm=llm,
            toolkit=toolkit,
            verbose=True,  # Ayrıntılı çıktı için
            agent_type=AgentType.OPENAI_FUNCTIONS,  # En son ve verimli agent tipi
            max_iterations=5,  # Maximum düşünme turları
            handle_parsing_errors=True  # Ayrıştırma hatalarını otomatik ele alır
        )
        
        print("LangChain SQL Agent başarıyla kuruldu!")
        return agent_executor
    except Exception as e:
        print(f"LangChain SQL agent kurulumu sırasında hata: {str(e)}")
        import traceback
        traceback.print_exc()
        return None



class DatabaseManager:
    def __init__(self, connection_string):
        self.connection_string = connection_string

    @contextmanager
    def get_connection(self):
        conn = None
        try:
            conn = oracledb.connect(self.connection_string)
            yield conn
        finally:
            if conn:
                try:
                    conn.close()
                except Exception as e:
                    print(f"Error closing connection: {e}")

    def execute_query(self, query, params=None):
        with self.get_connection() as conn:
            with conn.cursor() as cursor:
                if params:
                    cursor.execute(query, params)
                else:
                    cursor.execute(query)
                conn.commit()
                return cursor.fetchall()

db_manager = DatabaseManager(oracle_connection_string)


sql_agent = setup_langchain_sql_agent()

@contextmanager
def get_db_connection():
    """Database connection context manager"""
    conn = None
    try:
        conn = oracledb.connect(oracle_connection_string)
        yield conn
    finally:
        if conn:
            try:
                conn.close()
            except Exception as e:
                print(f"Error closing connection: {e}")

class BaseModel:
    def __init__(self, db_manager):
        self.db_manager = db_manager

class PlayerStats(BaseModel):
    def __init__(self, db_manager, user_id):
        super().__init__(db_manager)
        self.user_id = user_id

    def get_stats(self):
        query = """
            SELECT games_played, wins, losses, total_score, highest_score
            FROM player_stats
            WHERE user_id = :1
        """
        result = self.db_manager.execute_query(query, (self.user_id,))
        if result:
            stats = result[0]
            return {
                "games": stats[0],
                "wins": stats[1],
                "losses": stats[2],
                "total_score": stats[3],
                "highest_score": stats[4]
            }
        return None

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
        return 5  # Player için rate limit 5
    
    def can_access_endpoint(self, endpoint):
        player_allowed_endpoints = [
            '/protected-endpoint',
            '/player-stats',
            '/refresh-token'
        ]
        return endpoint in player_allowed_endpoints

# Admin rolü
class AdminRole(UserRole):
    @property
    def role_name(self):
        return "admin"
    
    @property
    def rate_limit(self):
        return 10  # Admin için rate limit 10
    
    def can_access_endpoint(self, endpoint):
        return True  # Admin tüm endpointlere erişebilir

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
            return jsonify({
                'success': False,
                'message': 'Token gerekli!'
            }), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            
            # Rate limit kontrolü
            if data.get('usage_count', 0) >= 5:  # Sabit rate limit
                return jsonify({
                    'success': False,
                    'message': 'Rate limit aşıldı! (5 istek/token)'
                }), 429
            
            # Token'ı yenile
            new_token = jwt.encode({
                'user_id': data['user_id'],
                'role': data.get('role', 'player'),
                'usage_count': data.get('usage_count', 0) + 1,
                'exp': datetime.now(timezone.utc) + timedelta(hours=1)
            }, app.config['SECRET_KEY'], algorithm="HS256")
            
            response = make_response(f(*args, **kwargs))
            response.headers['New-Token'] = new_token
            return response
            
        except jwt.ExpiredSignatureError:
            return jsonify({
                'success': False,
                'message': 'Token süresi dolmuş!'
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                'success': False,
                'message': 'Geçersiz token!'
            }), 401
        except Exception as e:
            return jsonify({
                'success': False,
                'message': 'Token doğrulama hatası!',
                'error': str(e)
            }), 500
    
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
        result = db_manager.execute_query("SELECT 1 FROM DUAL")
        
        if result:
            return jsonify({'message': 'Veritabanı bağlantısı başarılı!', 'result': result[0][0]}), 200
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
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Oracle OUT parameter için var tanımla
            user_id_var = cursor.var(int)
            
            cursor.execute("""
                INSERT INTO users (username, password, email, role) 
                VALUES (:1, :2, :3, :4) 
                RETURNING user_id INTO :5
            """, (data['username'], hashed_password, data['email'], role, user_id_var))
            
            conn.commit()
            user_id = user_id_var.getvalue()[0]
            
            return jsonify({
                'success': True,
                'message': 'Kullanıcı başarıyla oluşturuldu!', 
                'user_id': user_id, 
                'role': role
            }), 201
            
    except oracledb.DatabaseError as e:
        error, = e.args
        return jsonify({
            'success': False,
            'message': 'Veritabanı hatası!', 
            'error': error.message
        }), 500

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    if not data or not data.get('username') or not data.get('password'):
        return jsonify({'message': 'Eksik bilgi!'}), 400
    
    try:
        query = "SELECT * FROM users WHERE username = :1"
        params = (data['username'],)
        user = db_manager.execute_query(query, params)
        print("User query result:", user)  # Hata ayıklama için
        
        if not user:
            return jsonify({'message': 'Geçersiz kullanıcı adı veya şifre!'}), 401

        # Kullanıcı tablodaki kolon sırası: [user_id, username, password, email, role, ...]
        stored_password = user[0][2]
        # Eğer stored_password None veya boş ise, ilgili kullanıcı kayıtında sorun var
        if not stored_password:
            return jsonify({'message': 'Kullanıcı parolası okunamadı!'}), 401

        if not bcrypt.checkpw(data['password'].encode('utf-8'), stored_password.encode('utf-8')):
            return jsonify({'message': 'Geçersiz kullanıcı adı veya şifre!'}), 401
        
        # Kullanıcı rolünü belirle
        role = user[0][4] if user[0][4] in ['player', 'admin'] else 'player'
        user_role = RoleFactory.get_role(role)
        
        # Token üret
        token = jwt.encode({
            'user_id': user[0][0],
            'role': role,
            'usage_count': 0,
            'exp': datetime.now(timezone.utc) + user_role.token_expiry
        }, app.config['SECRET_KEY'], algorithm="HS256")

        return jsonify({
            'token': token,
            'role': role,
            'rate_limit': user_role.rate_limit
        }), 200
        
    except Exception as e:
        print("Login error:", str(e))
        return jsonify({'message': 'Veritabanı hatası!', 'error': str(e)}), 500
    

@app.route('/admin/sql-query', methods=['POST'])
@role_required(['admin'])
def admin_sql_query():
    if not sql_agent:
        return jsonify({
            'success': False,
            'message': 'SQL Agent yapılandırılmamış. OPENAI_API_KEY ayarını kontrol edin.'
        }), 500
    
    data = request.get_json()
    if not data or not data.get('query'):
        return jsonify({'success': False, 'message': 'Sorgu parametresi gerekli!'}), 400
    
    try:
        # Sorguyu güvenlik kontrolünden geçir
        query = data.get('query')
        lower_query = query.lower()
        
        # Güvenlik kontrolü - doğrudan tablo değişikliklerini engelle
        # Bu kontroller öneri olarak korundu, agent kendisi de değişikliklerden kaçınabilir
        if any(keyword in lower_query for keyword in ['drop', 'delete', 'update', 'insert', 'alter', 'truncate']):
            return jsonify({
                'success': False,
                'message': 'Güvenlik nedeniyle, veri değiştirme sorguları kullanılamaz.'
            }), 403
        
        print(f"SQL Agent ile sorgu çalıştırılıyor: {query}")
        
        # LangChain agent ile sorguyu çalıştır
        try:
            # Agent'ı doğal dil sorgusu ile çalıştır
            result = sql_agent.invoke({
                "input": query
            })
            
            # Agent'ın çıktısını al
            response = result.get("output", "Sonuç bulunamadı.")
            print(f"SQL agent sorgu sonucu: {response}")
            
            return jsonify({
                'success': True,
                'message': 'Sorgu başarıyla çalıştırıldı',
                'result': response
            }), 200
            
        except Exception as agent_error:
            print(f"SQL agent çalışma hatası: {str(agent_error)}")
            return jsonify({
                'success': False,
                'message': 'SQL agent sorguyu çalıştıramadı',
                'error': str(agent_error)
            }), 500
        
    except Exception as e:
        print(f"Genel SQL agent hatası: {str(e)}")
        return jsonify({
            'success': False,
            'message': 'Sorgu çalıştırılırken hata oluştu',
            'error': str(e)
        }), 500

@app.route('/protected-endpoint', methods=['GET'])
@token_required
def protected():
    print("Protected endpoint çağrıldı")
    return jsonify({"message": "Bu endpoint'e eriştin!"}), 200

@app.route('/admin-only', methods=['GET'])
@role_required(['admin'])
def admin_only():
    try:
        query = """
            SELECT 
                u.username,
                u.email,
                u.role,
                pp.nickname,
                pp.player_level,
                pp.experience_points,
                COUNT(gs.score_id) AS total_games,
                COALESCE(SUM(gs.score), 0) AS total_score,
                COALESCE(MAX(gs.score), 0) AS highest_score,
                COALESCE(SUM(gs.enemies_defeated), 0) AS enemies_defeated,
                COALESCE(SUM(gs.resources_collected), 0) AS resources_collected
            FROM users u
            LEFT JOIN player_profiles pp ON u.user_id = pp.user_id
            LEFT JOIN game_scores gs ON pp.profile_id = gs.profile_id
            GROUP BY u.username, u.email, u.role, pp.nickname, pp.player_level, pp.experience_points
        """
        result = db_manager.execute_query(query)
        print("Admin panel query result:", result)

        users = [{
            'username': user[0],
            'email': user[1],
            'role': user[2],
            'nickname': user[3],
            'level': user[4],
            'deneyim': user[5],
            'total_games': user[6],
            'total_score': user[7],
            'highest_score': user[8],
            'enemies_defeated': user[9],
            'resources_collected': user[10]
        } for user in result]

        return jsonify({
            'success': True,
            'message': 'Admin paneli verileri başarıyla alındı',
            'data': users
        }), 200
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': 'Veri alınamadı',
            'error': str(e)
        }), 500

@app.route('/admin/update-user-role', methods=['POST'])
@role_required(['admin'])
def update_user_role():
    data = request.get_json()
    if not data or not data.get('user_id') or not data.get('new_role'):
        return jsonify({'message': 'Eksik bilgi!'}), 400
    
    new_role = data['new_role']
    if new_role not in ['player', 'admin']:
        return jsonify({'message': 'Geçersiz rol!'}), 400
    
    try:
        query = "UPDATE users SET role = :1 WHERE user_id = :2"
        params = (new_role, data['user_id'])
        db_manager.execute_query(query, params)
        
        return jsonify({'message': 'Kullanıcı rolü başarıyla güncellendi!'}), 200
        
    except oracledb.DatabaseError as e:
        error, = e.args
        return jsonify({'message': 'Veritabanı hatası!', 'error': error.message}), 500

@app.route('/admin/delete-user', methods=['DELETE'])
@role_required(['admin'])
def delete_user():
    data = request.get_json()
    if not data or not data.get('user_id'):
        return jsonify({'message': 'Eksik bilgi!'}), 400
    
    try:
        query = "DELETE FROM users WHERE user_id = :1"
        params = (data['user_id'],)
        db_manager.execute_query(query, params)
        
        return jsonify({'message': 'Kullanıcı başarıyla silindi!'}), 200
        
    except oracledb.DatabaseError as e:
        error, = e.args
        return jsonify({'message': 'Veritabanı hatası!', 'error': error.message}), 500

@app.route('/player-stats', methods=['GET'])
@token_required
def player_stats():
    try:
        token = request.headers['Authorization'].split()[1]
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        user_id = payload.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'User ID bulunamadı!'}), 400

        query = """
            SELECT 
                u.username,
                pp.nickname,
                pp.player_level,
                pp.experience_points AS deneyim,
                COUNT(gs.score_id) AS total_games,
                COALESCE(SUM(gs.score), 0) AS total_score,
                COALESCE(MAX(gs.score), 0) AS highest_score,
                COALESCE(SUM(gs.enemies_defeated), 0) AS enemies_defeated,
                COALESCE(SUM(gs.resources_collected), 0) AS resources_collected
            FROM users u
            JOIN player_profiles pp ON u.user_id = pp.user_id
            LEFT JOIN game_scores gs ON pp.profile_id = gs.profile_id
            WHERE u.user_id = :1
            GROUP BY u.username, pp.nickname, pp.player_level, pp.experience_points
        """
        print(f"Fetching stats for user_id: {user_id}")
        result = db_manager.execute_query(query, (user_id,))
        print("Query result:", result)
        
        # Eğer oyuncu bilgisi bulunamazsa, varsayılan bir profil oluştur
        if not result or len(result) == 0:
            print("No player profile found, creating default profile...")
            with get_db_connection() as conn:
                cursor = conn.cursor()
                default_nickname = f"Player_{user_id}"
                insert_query = """
                    INSERT INTO player_profiles (user_id, nickname, player_level, experience_points)
                    VALUES (:1, :2, 1, 0)
                """
                cursor.execute(insert_query, (user_id, default_nickname))
                conn.commit()
            # Tekrar sorgulamayı yapalım:
            result = db_manager.execute_query(query, (user_id,))
            print("Query result after profile creation:", result)
        
        if result and len(result) > 0:
            user_data = result[0]
            return jsonify({
                'success': True,
                'message': 'İstatistikler başarıyla alındı',
                'data': {
                    'username': user_data[0],
                    'nickname': user_data[1],
                    'level': user_data[2],
                    'deneyim': user_data[3],
                    'total_games': user_data[4],
                    'total_score': user_data[5],
                    'highest_score': user_data[6],
                    'enemies_defeated': user_data[7],
                    'resources_collected': user_data[8]
                }
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Oyuncu bilgileri alınamadı!'
            }), 404
    except Exception as e:
        print("Error:", str(e))
        return jsonify({
            'success': False,
            'message': 'Veri alınamadı',
            'error': str(e)
        }), 500

@app.route('/user-info', methods=['GET'])
@token_required
def user_info():
    try:
        token = request.headers['Authorization'].split()[1]
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
        user_id = payload.get('user_id')
        if not user_id:
            return jsonify({'success': False, 'message': 'User ID bulunamadı!'}), 400

        # Rate limit kontrolü
        if payload.get('usage_count', 0) >= 5:
            return jsonify({
                'success': False,
                'message': 'Rate limit aşıldı! (5 istek/token)'
            }), 429

        query = """
            SELECT 
                user_id,
                username,
                email,
                role,
                created_at,
                last_login
            FROM users
            WHERE user_id = :1
        """
        print(f"Fetching user info for user_id: {user_id}")
        result = db_manager.execute_query(query, (user_id,))
        print("Query result:", result)
        
        if result and len(result) > 0:
            user_data = result[0]
            return jsonify({
                'success': True,
                'message': 'Kullanıcı bilgileri başarıyla alındı',
                'data': {
                    'user_id': user_data[0],
                    'username': user_data[1],
                    'email': user_data[2],
                    'role': user_data[3],
                    'created_at': user_data[4],
                    'last_login': user_data[5]
                }
            }), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Kullanıcı bilgileri alınamadı!'
            }), 404
    except Exception as e:
        print("Error:", str(e))
        return jsonify({
            'success': False,
            'message': 'Veri alınamadı',
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000)