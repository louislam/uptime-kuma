# Uptime Kuma with MariaDB Setup

## Quick Start with Docker Compose

### 1. Download the Configuration
```bash
# Create directory
mkdir uptime-kuma-mariadb
cd uptime-kuma-mariadb

# Download docker-compose file
curl -o docker-compose.yml https://raw.githubusercontent.com/louislam/uptime-kuma/master/docker/docker-compose-mariadb.yml
```

### 2. Start Services
```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps
```

### 3. Access Applications
- **Uptime Kuma**: http://localhost:3001
- **phpMyAdmin**: http://localhost:8080

## Manual Docker Setup

### 1. Create Network
```bash
docker network create uptime-kuma-network
```

### 2. Start MariaDB
```bash
docker run -d \
  --name kuma-mariadb \
  --network uptime-kuma-network \
  -e MYSQL_ROOT_PASSWORD=rootpass \
  -e MYSQL_DATABASE=kuma_db \
  -e MYSQL_USER=kuma_user \
  -e MYSQL_PASSWORD=kumapass \
  -v mariadb_data:/var/lib/mysql \
  mariadb:12.0-ubi9-rc \
  --max-connections=500 \
  --innodb-buffer-pool-size=512M \
  --wait-timeout=600
```

### 3. Start Uptime Kuma
```bash
docker run -d \
  --name uptime-kuma \
  --network uptime-kuma-network \
  -p 3001:3001 \
  -e UPTIME_KUMA_DB_TYPE=mariadb \
  -e UPTIME_KUMA_DB_HOSTNAME=kuma-mariadb \
  -e UPTIME_KUMA_DB_PORT=3306 \
  -e UPTIME_KUMA_DB_NAME=kuma_db \
  -e UPTIME_KUMA_DB_USERNAME=kuma_user \
  -e UPTIME_KUMA_DB_PASSWORD=kumapass \
  -e DB_CONNECTION_POOL_MIN=20 \
  -e DB_CONNECTION_POOL_MAX=150 \
  louislam/uptime-kuma:2.0.1
```

## Environment Variables

### Database Connection
```bash
UPTIME_KUMA_DB_TYPE=mariadb
UPTIME_KUMA_DB_HOSTNAME=kuma-mariadb
UPTIME_KUMA_DB_PORT=3306
UPTIME_KUMA_DB_NAME=kuma_db
UPTIME_KUMA_DB_USERNAME=kuma_user
UPTIME_KUMA_DB_PASSWORD=kumapass
```

### Connection Pool (New)
```bash
DB_CONNECTION_POOL_MIN=20          # Minimum connections
DB_CONNECTION_POOL_MAX=150         # Maximum connections
DB_CONNECTION_POOL_IDLE_TIMEOUT=120000    # 2 minutes
DB_CONNECTION_POOL_ACQUIRE_TIMEOUT=60000  # 1 minute
```

## Troubleshooting

### Check Logs
```bash
# Uptime Kuma logs
docker logs uptime-kuma

# MariaDB logs
docker logs kuma-mariadb
```

### Database Connection Test
```bash
# Connect to MariaDB
docker exec -it kuma-mariadb mysql -u kuma_user -p kuma_db

# Show databases
SHOW DATABASES;

# Show connection pool status (in Uptime Kuma logs)
docker logs uptime-kuma | grep "Pool Config"
```

### Reset Everything
```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: This deletes all data)
docker volume rm uptime-kuma-mariadb_mariadb_data

# Start fresh
docker-compose up -d
```

## Production Recommendations

### Resource Limits
```yaml
deploy:
  resources:
    limits:
      memory: 1G
      cpus: '2.0'
    reservations:
      memory: 512M
```

### Backup Strategy
```bash
# Backup database
docker exec kuma-mariadb mysqldump -u root -prootpass kuma_db > backup.sql

# Restore database
docker exec -i kuma-mariadb mysql -u root -prootpass kuma_db < backup.sql
```

### Security
- Change default passwords
- Use Docker secrets for production
- Enable SSL/TLS for database connections
- Restrict network access