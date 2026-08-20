# SOCKS5 Monitor

This fork adds an independent `SOCKS5 Proxy` monitor type to Uptime Kuma 2.5.x.

## Modes

- `handshake` (default): opens the proxy TCP connection, negotiates SOCKS5, performs RFC 1929 username/password authentication when credentials are configured, then disconnects.
- `connect`: performs the same handshake/authentication, sends SOCKS5 `CONNECT` for the configured target, waits for a successful proxy response, then disconnects.
- `exit-ip`: performs the same handshake/authentication, sends SOCKS5 `CONNECT` for the configured HTTP/HTTPS IP endpoint, reads a small plain-text response body, and requires the returned IPv4 address to match the proxy host.

The `handshake` and `connect` modes do not send or read application data. In `connect` and `exit-ip` modes a domain target is sent to the proxy as a domain, so DNS resolution occurs at the proxy (the equivalent of `socks5h`).

## Fields

| Socket.IO field        | UI field          | Rules                                                                                                                             |
| ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `type`                 | Monitor Type      | Must be `socks5`                                                                                                                  |
| `hostname`             | Hostname          | Proxy hostname or IPv4; IPv6 and URL strings are rejected                                                                         |
| `port`                 | Port              | Required, `1` to `65535`; no default                                                                                              |
| `socks5Username`       | Username          | Optional; must be paired with password; UTF-8 length `1` to `255` bytes                                                           |
| `socks5Password`       | Password          | Optional; must be paired with username; UTF-8 length `1` to `255` bytes                                                           |
| `socks5CheckMode`      | Check Mode        | `handshake`, `connect`, or `exit-ip`; defaults to `handshake`                                                                     |
| `socks5TargetHost`     | Target Host       | Required in `connect`; hostname or IPv4; IPv6 is rejected                                                                         |
| `socks5TargetPort`     | Target Port       | Required in `connect`; `1` to `65535`; no default                                                                                 |
| `socks5ExitIpCheckUrl` | Exit IP check URL | Optional in `exit-ip`; defaults to `https://api.ipify.org`; only `http://` and `https://` plain-text IPv4 endpoints are supported |

In `exit-ip` mode, `hostname` must be an IPv4 address. The returned response body is trimmed and compared exactly with `hostname`.

When credentials are present the client offers only username/password authentication. It never falls back to no-auth, so an incorrect configured password cannot report success even when the proxy also supports anonymous access.

Credentials follow the existing monitor secret storage model. They are available only in authenticated edit data and are excluded from public monitor JSON, heartbeat payloads, notification payloads, and monitor logs.

## Web UI

Choose `SOCKS5 Proxy` when adding a monitor. The default mode is `Handshake and authentication`. Enable `Username and password authentication` to enter credentials. Choose `Proxy chain connection` to reveal target host and port, or `Exit IP check` to reveal the optional IP endpoint URL.

## Socket.IO API Example

```json
{
  "type": "socks5",
  "name": "Authenticated proxy",
  "hostname": "proxy.internal",
  "port": 1080,
  "interval": 60,
  "retryInterval": 60,
  "maxretries": 0,
  "timeout": 10,
  "socks5Username": "monitor-user",
  "socks5Password": "monitor-password",
  "socks5CheckMode": "connect",
  "socks5TargetHost": "service.internal",
  "socks5TargetPort": 443,
  "socks5ExitIpCheckUrl": null,
  "notificationIDList": {},
  "accepted_statuscodes": ["200-299"],
  "conditions": [],
  "kafkaProducerBrokers": [],
  "kafkaProducerSaslOptions": {},
  "rabbitmqNodes": []
}
```

## Migration and Rollback

Before upgrading, back up the data directory or database using the same procedure as any Uptime Kuma upgrade. Startup runs `2026-08-13-0000-add-socks5-monitor.js` and `2026-08-14-0000-add-socks5-exit-ip-check-url.js`, which add nullable SOCKS5 columns to `monitor`.

For application rollback, first delete or convert every `type = 'socks5'` monitor and stop Uptime Kuma. Restoring the pre-upgrade data directory or database backup is the preferred and supported rollback path.

The migrations include tested `down` functions that remove the SOCKS5 columns and their stored values. Uptime Kuma does not ship a standalone Knex CLI configuration, so operators who cannot restore a backup must invoke that function through a database-specific maintenance script using the same Knex connection settings as their deployment. Test this procedure against a copy of the database before touching production data.

## Local Validation

Protocol fixtures are in `test/backend-test/fixtures`. They implement a local authenticated SOCKS5 server and a local TCP target; tests do not contact remote targets.

```bash
node --test test/backend-test/monitors/test-socks5.js
npm run build
```
