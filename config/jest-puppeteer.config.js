module.exports = {
    "launch": {
        "dumpio": true,
        "slowMo": 500,
        "headless": process.env.HEADLESS_TEST || false,
        "userDataDir": "./data/test-chrome-profile",
        args: [
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--no-default-browser-check",
            "--no-experiments",
            "--no-first-run",
            "--no-pings",
            "--no-sandbox",
            "--no-zygote",
            "--single-process",
        ],
    }
};
