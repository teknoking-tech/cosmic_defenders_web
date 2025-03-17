FROM nginx:alpine

# Çalışma dizini oluşturun
WORKDIR /usr/share/nginx/html

# Nginx yapılandırmasını kopyalayın
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Frontend dosyalarını kopyalayın
COPY index.html .
COPY styles.css .
COPY script.js .

# 80 portunu açın
EXPOSE 80

# Nginx'i başlatın
CMD ["nginx", "-g", "daemon off;"]