# Cloudflare D1 Write Reduction

This change reduces per-check D1 writes while preserving monitor status correctness:

- Stable UP checks now persist one raw heartbeat per monitor per 15-minute sampling bucket by default.
- DOWN, PENDING, first-heartbeat, and recovery-to-UP results are still persisted as raw heartbeats.
- Every check still updates the 60-second metric bucket and the latest runtime summary fields.
- Hourly and daily metric buckets are rebuilt by scheduled rollups with idempotent `INSERT ... ON CONFLICT DO UPDATE`.
- Expensive runtime summary fields are recomputed on transitions, sampled raw heartbeats, and scheduled summary refreshes.

Estimated rows-written reduction for a stable healthy monitor checked every minute:

- Before: 1 raw heartbeat + 3 metric buckets + 1 runtime summary, plus event-log cleanup, roughly 4-5 D1 rows written per check.
- After: 1 metric bucket + 1 cheap runtime summary per check, with raw heartbeat and full summary refresh once per 15-minute sample bucket, roughly 2 rows written per stable UP check plus periodic rollup/refresh work.

Operational migration step:

- Apply `cloudflare/migrations/0013_d1_write_reduction.sql`.
- The migration adds the active/type monitor index, reasserts the existing heartbeat lookup index with `IF NOT EXISTS`, and runs `PRAGMA optimize`.
