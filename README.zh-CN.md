# Uptime Kuma 中文自述

一个开源的自托管监控工具。

## ⭐ 特性

- 📊 监控 HTTP/HTTPS/TCP/ping 等
- 📧 邮件、Discord、Telegram 通知
- 🔄 多种监控间隔
- 📈 状态页面
- 🌙 黑暗模式
- 🐳 Docker 支持

## 🚀 快速开始

```bash
# Docker 部署
docker run -d --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:latest
```

访问 http://localhost:3001 开始使用！

## 配置示例

```yaml
# docker-compose.yaml
version: '3'
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: uptime-kuma
    volumes:
      - ./data:/app/data
    ports:
      - "3001:3001"
    restart: unless-stopped
```

## 支持

- Discord: https://discord.gg/louislam
- GitHub Issues: https://github.com/louislam/uptime-kuma/issues
