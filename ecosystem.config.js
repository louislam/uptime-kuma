module.exports = {
    apps: [{
        name: "uptime-kuma",
        script: "./server/server.js",
        restart_delay: 3000,
        error_file: "./logs/uptime-kuma.err.log",
        out_file: "./logs/uptime-kuma.out.log"
    }]
};
