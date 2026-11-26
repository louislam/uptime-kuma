# Security pass (diff-scoped)

Adapted from Cloudflare's security-audit skill (MIT). Only apply it to the lines this pull request changes; do not audit the whole repository.

For each changed line, ask whether an attacker controls the input and whether the change widens what they can do:

- Injection: SQL/knex string building, shell commands, template strings, path joins with user input, `eval`.
- Authz: new route, socket event, or API handler without the existing permission check; missing `checkOwner`/team scope; IDOR on new ids.
- Authn and secrets: tokens, passwords, or API keys logged, returned in JSON, or stored unhashed.
- SSRF and network: user-controlled URL fetched, redirect followed, DNS or webhook target unchecked.
- Deserialization and uploads: `JSON.parse`/`yaml`/`eval` on untrusted data, upload without type and size limits.
- XSS: new `v-html`, `innerHTML`, or unescaped template interpolation with server data.
- Denial of service: unbounded loop, unbounded regex, missing pagination on a new endpoint.
- Supply chain: new dependency, `postinstall` script, or GitHub Action pinned to a tag instead of a SHA.

Report only a real path from attacker-controlled input to impact. Name the input, the sink, and the missing check; "this might be unsafe" is not a finding.
