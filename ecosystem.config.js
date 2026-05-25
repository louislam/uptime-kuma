module.exports = {
    apps: [
        {
            name: "status-uptime-kuma",
            script: "./server/server.js",
            cwd: "/home/newstargeted.com/status.newstargeted.com",
            env: {
                UPTIME_KUMA_PORT: "3011",
                UPTIME_KUMA_DISABLE_FRAME_SAMEORIGIN: "1",
            },
        },
    ],
};
