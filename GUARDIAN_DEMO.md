# Guardian demo branch

This fork's default branch `guardian-demo` is Uptime Kuma **2.5.12** (upstream tag `2.5.12`, commit `5aa5dec4`) plus two
workflows that hand every pull request to **Software Supply Chain Guardian** (Bosch BGSW hackathon):

- `.github/workflows/guardian.yml`: `pull_request_target`, runs on a self-hosted runner, never checks out or runs PR code.
- `.github/workflows/guardian-nightly.yml`: nightly re-check of this branch against newly published advisories.

Uptime Kuma's own workflows are disabled in this fork. Some demo pull requests are intentionally crafted to look like
supply-chain attacks; any package they reference exists only in a local test registry and is harmless. Never install
dependencies from an unmerged demo pull request. The upstream project is https://github.com/louislam/uptime-kuma.
