# Fix: autofix.ci CI failing on every push to master3395/uptime-kuma

Date (Europe/Oslo): 25/05/2026 21:55

## Symptom

The `autofix.ci` GitHub Actions workflow has been red on every push to
`master3395/uptime-kuma:master`, including run
[#26414438570](https://github.com/master3395/uptime-kuma/actions/runs/26414438570)
("fix(perf,db): respect DB pool env var and patch stat\_\* dup-key race").

The annotations look intimidating ("11 errors, 11 warnings"), but only one
step actually fails. The rest are pre-existing upstream noise.

## Root cause

### The actual failure

Step 9 of the job, `Run autofix-ci/action@635ffb0c…`, fails with:

```
autofix.ci app is not installed for this repository.
```

The workflow's last step posts any auto-formatted diffs back to the PR through
the upstream
[autofix.ci GitHub App](https://github.com/marketplace/autofix-ci). The app is
installed only on `louislam/uptime-kuma`. Forks (this one included) cannot
authenticate against an app that is not installed on the head repository, so
the action exits 1 and the run is marked failure. Earlier steps (`npm ci`,
`lint-fix:js`, `lint-fix:style`, `fmt`, `tsc`) all use
`continue-on-error: true`, so their failures are visible only as annotations.

### The "11 errors" annotations

| Where                                                                                      | What                                                           | Whose problem                                                                                                                              |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 8 errors in `node_modules/@types/node/http.d.ts` (lines 239, 240, 244, 248, 255, 261, 269) | TS parser cannot read syntax in current `@types/node`          | Upstream: pinned `typescript` version is older than installed `@types/node` major. Same annotations appear in `louislam/uptime-kuma` runs. |
| 2 errors in `node_modules/@types/node/buffer.d.ts:129`                                     | Same as above                                                  | Upstream                                                                                                                                   |
| 1 error: "autofix.ci app is not installed"                                                 | Step 9 cannot post diffs                                       | Fork-only                                                                                                                                  |
| 10 warnings on `modules/pm2-kuma-push-sync.js`                                             | Missing JSDoc tags on the helper file we authored in this fork | Ours to fix                                                                                                                                |
| 1 warning: "Node.js 20 actions are deprecated"                                             | `autofix-ci/action@635ffb…` runs on Node 20                    | Upstream action; fixed when louislam upgrades the pinned tag                                                                               |

## Fix

### 1. Skip the autofix job on forks

`.github/workflows/autofix.yml` now gates the job:

```yaml
jobs:
  autofix:
    if: github.repository == 'louislam/uptime-kuma'
    runs-on: ubuntu-latest
    ...
```

Behavior:

- **Upstream `louislam/uptime-kuma`**: unchanged. The job runs as before, the
  autofix.ci app receives diffs.
- **This fork `master3395/uptime-kuma`**: the job is skipped (a clean
  "skipped" status, not a failure), so the run no longer goes red on every
  commit and the noisy upstream annotations stop appearing on our PR pages.

This is the standard pattern for fork-only repositories that do not host the
autofix.ci app. When we sync from upstream the only conflict on this file is
the single `if:` line, easy to keep.

### 2. Clean up our own JSDoc warnings

`modules/pm2-kuma-push-sync.js` shipped with several functions lacking JSDoc
(`loadDbConfig`, `shellQuote`, `runCommand`, `runMariaDb`, `getPm2StateMap`,
`getPm2PushMonitors`, `sleep`, `syncOnce`, `main`) and a few JSDoc blocks with
typed parameters but no descriptions (`describeFetchError`, `sendPush`,
`runWithConcurrency`).

All functions now carry `@param`, `@returns`, and where relevant `@throws`,
matching the project's eslint-jsdoc rules:

- `jsdoc/require-param-description`
- `jsdoc/require-returns-description`
- `jsdoc/tag-lines` (no blank line between description and tags)

`npx eslint modules/pm2-kuma-push-sync.js` is now clean (0 errors, 0 warnings).
The file remains under the 500-line module budget (328 lines).

### 3. Not touched (intentionally)

- `node_modules/@types/node/*.d.ts` parse errors: third-party type
  definitions, the fork should not pin or vendor them. Will resolve when
  upstream bumps `typescript` or pins `@types/node`.
- The `Node.js 20 actions are deprecated` warning on `autofix-ci/action`:
  upstream maintains the action SHA pin.

## Verify

```bash
# Locally
node --check modules/pm2-kuma-push-sync.js          # syntax ok
npx --no-install eslint modules/pm2-kuma-push-sync.js   # 0 problems

# YAML parse check
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/autofix.yml'))"
```

After this push lands on the fork:

- `autofix.ci` for new commits should report **skipped** (or be filtered out
  of the actions list entirely depending on how GitHub renders gated jobs).
- Per-commit annotations for `pm2-kuma-push-sync.js` are gone.
- Upstream `@types/node` annotations remain only because the workflow itself
  is gated off, so they are no longer surfaced on this fork.

## Operator notes

- If we ever want autofix.ci to run on this fork, install the app via
  https://github.com/apps/autofix-ci on `master3395/uptime-kuma`, then remove
  the `if:` line.
- The `Auto Test` workflow is also failing on this fork independently of
  autofix.ci. That is a separate issue (Playwright + Docker setup that does
  not match this fork's deploy) and is out of scope for this fix.
