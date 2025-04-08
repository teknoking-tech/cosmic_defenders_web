# rag_module.py
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import Chroma
from langchain_openai import OpenAIEmbeddings, ChatOpenAI
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
import os
from dotenv import load_dotenv
from contextlib import contextmanager
import oracledb
import pandas as pd
import tempfile
import json

# .env dosyasını yükle
load_dotenv()

# OpenAI API Anahtarı
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')

# Oracle bağlantı bilgileri
oracle_user = os.getenv('ORACLE_USER', 'C##COSMIC_DEFENDERS')
oracle_password = os.getenv('ORACLE_PASSWORD', 'MyPassword123')
oracle_host = os.getenv('ORACLE_HOST', 'oracle-db')
oracle_port = os.getenv('ORACLE_PORT', '1521')
oracle_sid = os.getenv('ORACLE_SID', 'XE')

oracle_connection_string = f"{oracle_user}/{oracle_password}@{oracle_host}:{oracle_port}/{oracle_sid}"

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

class RAGSystem:
    def __init__(self, persist_directory="chroma_db"):
        """RAG sistemini başlat ve yapılandır."""
        self.persist_directory = persist_directory
        
        # Embeddings ve LLM modelini oluştur
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY bulunamadı. Lütfen .env dosyasını kontrol edin.")
        
        self.embeddings = OpenAIEmbeddings(api_key=OPENAI_API_KEY)
        self.llm = ChatOpenAI(
            temperature=0,
            model="gpt-3.5-turbo-16k",
            api_key=OPENAI_API_KEY
        )
        
        # Vektör veritabanını kontrol et veya oluştur
        if os.path.exists(persist_directory):
            print(f"Var olan Chroma DB yükleniyor: {persist_directory}")
            self.vectordb = Chroma(
                persist_directory=persist_directory,
                embedding_function=self.embeddings
            )
        else:
            print("Vektör veritabanı henüz oluşturulmadı. İndeksleme yapın.")
            self.vectordb = None
    
    def _create_temp_documents_from_db(self):
        """Veritabanından oyuncu ve oyun verilerini çeker ve geçici dokümanlar oluşturur."""
        temp_dir = tempfile.mkdtemp()
        files_created = []
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Oyuncu profilleri
                cursor.execute("""
                    SELECT 
                        u.username,
                        u.email,
                        u.role,
                        pp.nickname,
                        pp.player_level,
                        pp.experience_points,
                        pp.profile_id
                    FROM users u
                    JOIN player_profiles pp ON u.user_id = pp.user_id
                """)
                
                profiles = cursor.fetchall()
                if profiles:
                    profiles_file = os.path.join(temp_dir, "player_profiles.txt")
                    
                    with open(profiles_file, 'w', encoding='utf-8') as f:
                        f.write("# Oyuncu Profilleri\n\n")
                        for profile in profiles:
                            f.write(f"Kullanıcı Adı: {profile[0]}\n")
                            f.write(f"E-posta: {profile[1]}\n")
                            f.write(f"Rol: {profile[2]}\n")
                            f.write(f"Oyuncu Takma Adı: {profile[3]}\n")
                            f.write(f"Seviye: {profile[4]}\n")
                            f.write(f"Deneyim Puanı: {profile[5]}\n")
                            f.write(f"Profil ID: {profile[6]}\n\n")
                    
                    files_created.append(profiles_file)
                
                # Oyun skorları
                cursor.execute("""
                    SELECT 
                        gs.score_id,
                        u.username,
                        pp.nickname,
                        gs.score,
                        gs.enemies_defeated,
                        gs.resources_collected,
                        gs.played_at
                    FROM game_scores gs
                    JOIN player_profiles pp ON gs.profile_id = pp.profile_id
                    JOIN users u ON pp.user_id = u.user_id
                    ORDER BY gs.score DESC
                """)
                
                scores = cursor.fetchall()
                if scores:
                    scores_file = os.path.join(temp_dir, "game_scores.txt")
                    
                    with open(scores_file, 'w', encoding='utf-8') as f:
                        f.write("# Oyun Skorları\n\n")
                        for score in scores:
                            f.write(f"Skor ID: {score[0]}\n")
                            f.write(f"Kullanıcı Adı: {score[1]}\n")
                            f.write(f"Oyuncu Takma Adı: {score[2]}\n")
                            f.write(f"Skor: {score[3]}\n")
                            f.write(f"Yenilen Düşman: {score[4]}\n")
                            f.write(f"Toplanan Kaynak: {score[5]}\n")
                            f.write(f"Oynanma Tarihi: {score[6]}\n\n")
                    
                    files_created.append(scores_file)
                
                # İstatistiksel özet
                cursor.execute("""
                    SELECT 
                        pp.player_level,
                        COUNT(DISTINCT pp.profile_id) AS player_count,
                        AVG(gs.score) AS avg_score,
                        MAX(gs.score) AS max_score,
                        MIN(gs.score) AS min_score,
                        AVG(gs.enemies_defeated) AS avg_enemies,
                        AVG(gs.resources_collected) AS avg_resources
                    FROM player_profiles pp
                    LEFT JOIN game_scores gs ON pp.profile_id = gs.profile_id
                    GROUP BY pp.player_level
                    ORDER BY pp.player_level
                """)
                
                stats = cursor.fetchall()
                if stats:
                    stats_file = os.path.join(temp_dir, "player_statistics.txt")
                    
                    with open(stats_file, 'w', encoding='utf-8') as f:
                        f.write("# Oyuncu Seviyelerine Göre İstatistikler\n\n")
                        for stat in stats:
                            f.write(f"Seviye: {stat[0]}\n")
                            f.write(f"Oyuncu Sayısı: {stat[1]}\n")
                            f.write(f"Ortalama Skor: {stat[2]}\n")
                            f.write(f"Maksimum Skor: {stat[3]}\n")
                            f.write(f"Minimum Skor: {stat[4]}\n")
                            f.write(f"Ortalama Yenilen Düşman: {stat[5]}\n")
                            f.write(f"Ortalama Toplanan Kaynak: {stat[6]}\n\n")
                    
                    files_created.append(stats_file)
                
                # Oyun kuralları ve açıklamaları (statik bilgiler)
                game_info_file = os.path.join(temp_dir, "game_info.txt")
                with open(game_info_file, 'w', encoding='utf-8') as f:
                    f.write("# Cosmic Defenders Oyun Bilgileri\n\n")
                    f.write("Cosmic Defenders, uzay temalı bir savunma oyunudur. Oyuncular, galaksiyi korumak için çeşitli uzay gemileri ve silahlar kullanarak düşman uzaylılara karşı savaşırlar.\n\n")
                    f.write("## Oyun Mekanikleri\n\n")
                    f.write("- Oyuncular savunma kuleleri inşa ederek düşmanları durdurmalıdır\n")
                    f.write("- Her düşman yenildiğinde puan ve deneyim kazanılır\n")
                    f.write("- Oyun ilerledikçe daha güçlü düşmanlar ortaya çıkar\n")
                    f.write("- Oyuncular deneyim puanı kazandıkça seviyeleri yükselir\n")
                    f.write("- Seviye yükseldikçe yeni savunma kuleleri ve yetenekler açılır\n\n")
                    f.write("## Seviye Sistemi\n\n")
                    f.write("- Seviye 1: Başlangıç seviyesi, temel savunma kuleleri\n")
                    f.write("- Seviye 2: Gelişmiş silahlar açılır, 1000 XP gerektirir\n")
                    f.write("- Seviye 3: Özel yetenekler açılır, 2500 XP gerektirir\n")
                    f.write("- Seviye 4: Efsanevi silahlar açılır, 5000 XP gerektirir\n")
                    f.write("- Seviye 5: Maksimum seviye, tüm silahlar ve yetenekler açılır, 10000 XP gerektirir\n")
                
                files_created.append(game_info_file)
                
            return temp_dir, files_created
        except Exception as e:
            print(f"Veritabanından doküman oluşturma hatası: {str(e)}")
            return temp_dir, []
    
    def index_documents(self, custom_docs_dir=None):
        """Dokümanları yükle, işle ve indeksle."""
        try:
            # Veritabanından geçici dokümanlar oluştur
            temp_dir, db_files = self._create_temp_documents_from_db()
            
            # Kullanıcının verdiği doküman dizini varsa, onları da ekle
            all_files = db_files.copy()
            if custom_docs_dir and os.path.exists(custom_docs_dir):
                loader = DirectoryLoader(custom_docs_dir, glob="**/*.txt")
                custom_docs = loader.load()
                # İsterseniz burada custom_docs dosyalarını listeye ekleyebilirsiniz
            
            if not all_files:
                print("İndekslenecek doküman bulunamadı!")
                return False
            
            # Dokümanları yükle
            loaders = []
            for file_path in all_files:
                loaders.append(TextLoader(file_path, encoding='utf-8'))
            
            documents = []
            for loader in loaders:
                documents.extend(loader.load())
            
            # Dokümanları parçalara ayır
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=1000,
                chunk_overlap=200,
                separators=["\n\n", "\n", ".", " ", ""]
            )
            texts = text_splitter.split_documents(documents)
            
            print(f"{len(texts)} doküman parçası oluşturuldu.")
            
            # ChromaDB vektör veritabanı oluştur
            self.vectordb = Chroma.from_documents(
                texts, 
                self.embeddings,
                persist_directory=self.persist_directory
            )
            
            # Veritabanını kaydet
            self.vectordb.persist()
            print(f"Vektör veritabanı {self.persist_directory} dizinine kaydedildi.")
            
            # Geçici dosyaları temizle
            for file_path in all_files:
                if os.path.exists(file_path):
                    os.remove(file_path)
            
            if os.path.exists(temp_dir):
                try:
                    os.rmdir(temp_dir)
                except:
                    pass
            
            return True
        except Exception as e:
            print(f"İndeksleme hatası: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    def setup_qa_chain(self):
        """Soru-cevap zincirini oluştur."""
        if not self.vectordb:
            raise ValueError("Vektör veritabanı henüz oluşturulmamış! Önce 'index_documents' çağırın.")
        
        # Özel RAG promptu
        template = """Sen Cosmic Defenders oyununun yapay zeka asistanısın. 
        Aşağıdaki bağlam bilgilerini kullanarak kullanıcının sorusuna yanıt ver.
        
        Bağlam:
        {context}
        
        Soru: {question}
        
        Yanıtını aşağıdaki kurallara göre ver:
        1. Sadece verilen bağlam bilgilerini kullan. Bağlamda olmayan bilgiler için "Bu bilgi mevcut değil" de.
        2. Kısa ve öz yanıtlar ver, gereksiz tekrarlardan kaçın.
        3. Sayısal verileri mümkünse tablolar veya listeler şeklinde düzenle.
        4. Teknik jargon kullanma, oyuncu dostu bir dil kullan.
        
        Yanıt:"""
        
        prompt = PromptTemplate(
            template=template,
            input_variables=["context", "question"]
        )
        
        # Retrievalqa zinciri oluştur
        retriever = self.vectordb.as_retriever(
            search_type="similarity",
            search_kwargs={"k": 5}
        )
        
        qa_chain = RetrievalQA.from_chain_type(
            llm=self.llm,
            chain_type="stuff",
            retriever=retriever,
            return_source_documents=True,
            chain_type_kwargs={"prompt": prompt}
        )
        
        return qa_chain
    
    def ask(self, question):
        """Kullanıcı sorusunu yanıtla."""
        try:
            if not self.vectordb:
                raise ValueError("Vektör veritabanı henüz oluşturulmamış!")
            
            qa_chain = self.setup_qa_chain()
            result = qa_chain({"query": question})
            
            answer = {
                "answer": result["result"],
                "sources": [{"source": doc.metadata.get("source", "Bilinmeyen Kaynak")} for doc in result["source_documents"]]
            }
            
            return answer
        except Exception as e:
            print(f"Soru yanıtlama hatası: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"answer": f"Bir hata oluştu: {str(e)}", "sources": []}
    
    def refresh_index(self):
        """Veritabanı indeksini yenile."""
        # Eski indeksi temizle
        if os.path.exists(self.persist_directory):
            import shutil
            try:
                shutil.rmtree(self.persist_directory)
                print(f"Eski indeks temizlendi: {self.persist_directory}")
            except Exception as e:
                print(f"Eski indeks temizleme hatası: {str(e)}")
        
        # Yeniden indeksle
        return self.index_documents()

# Modül testi
if __name__ == "__main__":
    rag = RAGSystem()
    print("RAG sistemi başlatıldı.")
    
    # İndeksleme
    success = rag.index_documents()
    if success:
        print("Dokümanlar başarıyla indekslendi.")
        
        # Test sorusu
        test_question = "En yüksek skora sahip oyuncu kimdir?"
        print(f"Test sorusu: {test_question}")
        
        response = rag.ask(test_question)
        print(f"Yanıt: {response['answer']}")
        print("Kaynaklar:")
        for src in response['sources']:
            print(f"- {src['source']}")
    else:
        print("İndeksleme başarısız oldu.")