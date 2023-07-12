# Usage

This setup comes up with the [Traefik](https://github.com/containous/traefik) v2.9 reverse proxy to access the Uptime-Kuma instance via a virtual host, has support for SSL certificates using Let's Encrypt and automatic redirection from http to https.

The default configuration will make Uptime frontend available via the `uptime.yourdomain.com` domain. If you wish to change this, update the `traefik.http.routers.uptime.rule=Host(`uptime.yourdomain.com`)` label for the Uptime Kuma service in the `docker-compose.yml` file.


Deploy this stack on any Docker node:

```
docker-compose up -d
```

And then access Uptime by hitting [http://uptime.yourdomain.com](http://uptime.yourdomain.com) with a web browser.

**NOTE**: Your machine must be able to resolve `uptime.yourdomain.com` (or your own domain if you updated it).