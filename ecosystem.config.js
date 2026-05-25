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
    ],
};
