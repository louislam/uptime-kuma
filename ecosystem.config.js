module.exports = {
    apps: [
        {
            name: "status-uptime-kuma",
            script: "./server/server.js",
            cwd: "/home/newstargeted.com/status.newstargeted.com",
            env: {
                UPTIME_KUMA_PORT: "3011",
                UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN: "1",
                // Knex pool default is 10. After deferring per-monitor
                // heartbeat/stats fan-out and parallelising the 5 chunked
                // preparePreloadData fan-outs, peak concurrency at login
                // is roughly 5 fan-outs * chunk_size 8 = ~40 queries plus
                // other afterLogin work. 80 gives breathing room while
                // staying well under MariaDB max_connections=300 and
                // Kuma's own 100 ceiling at server/database.js:280.
                UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS: "80",
            },
        },
        {
            name: "kuma-pm2-push-sync",
            script: "./modules/pm2-kuma-push-sync.js",
            cwd: "/home/newstargeted.com/status.newstargeted.com",
            // Helper publishes PM2 process status to Kuma push monitors
            // named "PM2 <appName>". See modules/pm2-kuma-push-sync.js
            // and to-do/FIX-KUMA-PUSH-SYNC-20260525.md.
            env: {
                // Push every 30 s. Each PM2 push monitor is configured with
                // interval=60 s, so a 30 s helper cadence guarantees Kuma
                // sees a fresh heartbeat well inside its overdue window
                // even when /api/push is slow because of unrelated MariaDB
                // contention from the news_apis webhook workers.
                KUMA_PUSH_LOOP_MS: "30000",
                // 10 concurrent pushes finishes 33 monitors in ~5-25 s
                // depending on /api/push latency, vs ~165 s sequential.
                KUMA_PUSH_CONCURRENCY: "10",
                // Per-fetch ceiling so a hung /api/push call cannot tie up
                // a worker slot for the whole loop.
                KUMA_PUSH_FETCH_TIMEOUT_MS: "15000",
                // Loopback URL; override only if Kuma moves off port 3011.
                KUMA_PUSH_BASE_URL: "http://127.0.0.1:3011/api/push",
            },
        },
    ],
};
