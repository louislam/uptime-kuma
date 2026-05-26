# Security Policy

## Reporting a Vulnerability

Please report suspected security issues privately through GitHub Security
Advisories:

<https://github.com/esaueng/uptimeworker/security/advisories/new>

Include enough detail to validate the issue:

- A clear description of the vulnerability and expected impact.
- Reproduction steps or a working proof of impact.
- The affected deployment mode, such as Cloudflare Worker, runner container, or
  dashboard UI.
- Relevant logs, requests, configuration, or screenshots with secrets redacted.

Do not open a public issue, discussion, pull request, or social post for an
undisclosed vulnerability.

Automated scan output and third-party package advisories are only useful when
they explain how the issue is exploitable in Uptime Worker. Reports without a
project-specific impact may be closed.

## Scope

In scope:

- Uptime Worker dashboard, API, and Cloudflare Worker code.
- Runner container code, direct checks, and Twingate integration.
- Database migrations, release workflows, and repository-owned deployment
  configuration.

Out of scope:

- Unrelated third-party services or infrastructure not controlled by this
  repository.
- Social engineering, phishing, spam, or physical attacks.
- Denial-of-service reports based only on excessive traffic volume.
- Issues that require already-compromised administrator access unless they
  create a meaningful new privilege escalation path.

## Bug Bounty Platforms

Uptime Worker does not run a paid bug bounty program and does not accept reports
through third-party bug bounty platforms. Use GitHub Security Advisories for
private security reports.

## Supported Versions

Security fixes target the current Uptime Worker codebase and the latest
published release from this repository. Older releases are not maintained; please
upgrade before reporting an issue that has already been fixed.
