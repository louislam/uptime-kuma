module.exports = {
    apps: [
        {
            name: "uptime-kuma",
            script: "node",
            args: "--run start-server",
            interpreter: "none",
            cwd: __dirname,
        },
    ],
};
