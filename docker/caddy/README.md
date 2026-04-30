# Caddy reverse proxy (optional)

This directory contains an opt-in [Caddy](https://caddyserver.com/) configuration that fronts Uptime Kuma with HTTPS. Caddy obtains and renews a Let's Encrypt certificate automatically, so no certificate files need to be managed by hand.

The service is defined under the `caddy` profile in [`compose.yaml`](../../compose.yaml) and is **disabled by default**.

## Prerequisites for automatic HTTPS

1. **DNS** - point an `A` (IPv4) and/or `AAAA` (IPv6) record for your hostname at this server's public IP. Caddy proves ownership via this hostname, so the record must resolve before the container starts handling requests.
2. **Port 80** - must be reachable from the public internet. Let's Encrypt uses an HTTP-01 challenge on this port to issue and renew certificates.
3. **Port 443** - must be reachable from the public internet. This is where browsers actually connect over HTTPS once the certificate is issued.

Both ports are published by the `caddy` service in `compose.yaml`; make sure any host firewall, cloud security group, or upstream NAT also allows them.

## Bringing it up

Set `DOMAIN` to the hostname you configured in DNS, then start the stack with the `caddy` profile:

```bash
DOMAIN=status.example.com docker compose --profile caddy up -d
```

`DOMAIN` can also be set in a `.env` file next to `compose.yaml`. If `DOMAIN` is unset or empty, Compose refuses to start and prints the reason.

When fronting Uptime Kuma with Caddy, change the `uptime-kuma` port mapping in `compose.yaml` from `"3001:3001"` to `"127.0.0.1:3001:3001"` so only Caddy is reachable from the public internet.

## What the Caddyfile does

See [`Caddyfile`](./Caddyfile) for inline comments on each directive. In short:

- Listens on the hostname in `$DOMAIN`, redirects HTTP→HTTPS, and manages the certificate.
- Compresses responses with `zstd` (preferred) or `gzip`.
- Sends HSTS, `X-Content-Type-Options: nosniff`, and a `Referrer-Policy` header.
- Reverse-proxies to `uptime-kuma:3001` over the internal Docker network, including transparent WebSocket / Socket.IO support.
