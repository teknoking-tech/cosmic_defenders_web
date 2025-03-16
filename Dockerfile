# Python 3.9 base image kullanın
FROM python:3.9-slim

# Çalışma dizini oluşturun
WORKDIR /app

# Gereksinim dosyasını kopyalayın
COPY requirements.txt .

# Bağımlılıkları yükleyin
RUN pip install --no-cache-dir -r requirements.txt

# Uygulama dosyasını kopyalayın
COPY app.py .

# FastAPI'nin 8000 portunu açın
EXPOSE 8000

# FastAPI'yi başlatın
CMD ["python", "app.py"]
