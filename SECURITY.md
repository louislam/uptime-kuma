# Security Policy

> [!CAUTION]
> Unfortunately, I DO NOT check Security Advisories anymore. Thanks to AI slop reports, they keep running over my GitHub Security Advisories.

## Reporting a Vulnerability

1. Create a new security advisory in https://github.com/louislam/uptime-kuma/security/advisories/new.
2. Talk to me as a human in https://github.com/louislam/uptime-kuma/issues, explain the type of security issue but don't reveal the details. LLM description will be banned and closed immediately.

PS: Do not use the public issue tracker or discuss it in public as it will cause more damage.

## Will be Closed without explanation

- No LLM description, I don't read it
- Do not report any upstream dependency issues, unless you have PoC to prove that the upstream issue affected Uptime Kuma.
- Do not report any scan result by any tools, unless you have PoC.
- Do not report any SSRF issues.

## Do you accept other 3rd-party bug bounty platforms?

At this moment, I DO NOT accept other bug bounty platforms, because I am not
familiar with these platforms and someone has tried to send a phishing link to
me by doing this already. To minimize my own risk, please report through GitHub
Advisories only. I will ignore all 3rd-party bug bounty platforms emails.

## Supported Versions

### Uptime Kuma Versions

You should use or upgrade to the latest version of Uptime Kuma.
All versions are upgradable to the latest version.

### Upgradable Docker Tags

| Tag             | Supported          |
| --------------- | ------------------ |
| 2               | :white_check_mark: |
| 2-slim          | :white_check_mark: |
| next            | :white_check_mark: |
| next-slim       | :white_check_mark: |
| 2-rootless      | :white_check_mark: |
| 2-slim-rootless | :white_check_mark: |
| 1               | ❌                 |
| 1-debian        | ❌                 |
| latest          | ❌                 |
| debian          | ❌                 |
| All other tags  | ❌                 |
