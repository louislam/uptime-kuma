# Uptime Kuma

<div align="center" width="100%">
    <img src="./public/icon.svg" width="128" alt="" />
</div>

It is a self-hosted monitoring tool like "Uptime Robot".

<img src="https://louislam.net/uptimekuma/1.jpg" width="512" alt="" />

# Features

* Monitoring uptime for HTTP(s) / TCP / Ping.
* Fancy, Reactive, Fast UI/UX.
* Notifications via Webhook, Telegram, Discord and email (SMTP). 
* 20 seconds interval.

# How to Use

### Docker
```bash
docker run -d --restart=always -p 3001:3001 louislam/uptime-kuma
```

Browse to http://localhost:3001 after started.

Change Port and Volume

```bash
docker run -d --restart=always -p <YOUR_PORT>:3001 -v <YOUR_DIR OR VOLUME>:/app/data louislam/uptime-kuma
```

### Without Docker

Required Tools: Node.js >= 14, git and pm2. 

```bash
git clone https://github.com/louislam/uptime-kuma.git
cd uptime-kuma
npm run setup

# Option 1. Try it
npm run start-server

# (Recommanded) 
# Option 2. Run in background using PM2
# Install PM2 if you don't have: npm install pm2 -g
pm2 start npm --name uptime-kuma -- run start-server

```

Browse to http://localhost:3001 after started.

### One-click Deploy to DigitalOcean

[![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/louislam/uptime-kuma/tree/master&refcode=e2c7eb658434)

### Reverse Proxy Examples

Nginx with Certbot
````
server {
    listen 80;
    server_name subdomain.domain.com

    location / {
        proxy_pass http://127.0.0.1:3001

    }

}
````

Nginx without Certbot
````
server {    
  listen 443 ssl http2;
  server_name sub.domain.comt;
  ssl_certificate     /path/to/ssl/cert/crt;
  ssl_certificate_key /path/to/ssl/key/key;

  location / {
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_pass           http://127.0.0.1:3001/;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}

Credit to 12nick12
````
Apache
````
<VirtualHost *:80>
  ServerName sub.domain.com

  ProxyPass / http://127.0.0.1:3001/
  RewriteEngine on
  RewriteCond %{HTTP:Upgrade} websocket [NC]
  RewriteCond %{HTTP:Connection} upgrade [NC]
  RewriteRule ^/?(.*) "ws://127.0.0.1:3001/$1" [P,L]
</VirtualHost>

Credit to TheGuyDanish
````

Caddy
````
subdomain.domain.com {
    reverse_proxy 127.0.0.1:3001 :
}
````


# More Screenshots

Settings Page:

<img src="https://louislam.net/uptimekuma/2.jpg" width="400" alt="" />

Telegram Notification Sample:

<img src="https://louislam.net/uptimekuma/3.jpg" width="400" alt="" />


# Motivation

* I was looking for a self-hosted monitoring tool like "Uptime Robot", but it is hard to find a suitable one. One of the close one is statping. Unfortunately, it is not stable and unmaintained. 
* Want to build a fancy UI.
* Learn Vue 3 and vite.js.
* Show the power of Bootstrap 5. 
* Try to use WebSocket with SPA instead of REST API.
* Deploy my first Docker image to Docker Hub.


If you love this project, please consider giving me a ⭐.

