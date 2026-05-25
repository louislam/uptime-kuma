module.exports = {
    apps: [
        {
            name: "status-uptime-kuma",
            script: "./server/server.js",
            cwd: "/home/newstargeted.com/status.newstargeted.com",
            env: {
                UPTIME_KUMA_PORT: "3011",
                UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN: "1",
                // Knex pool default is 10; afterLogin fans out ~150 queries
                // for 49 monitors and 5 status pages. 50 keeps us well under
                // MariaDB max_connections=300 and Kuma's own 100 ceiling.
                UPTIME_KUMA_DB_POOL_MAX_CONNECTIONS: "50",
            },
        },
    ],
};
