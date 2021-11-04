module.exports = {
    "launch": {
        "headless": process.env.HEADLESS_TEST || false,
        "userDataDir": "./data/test-chrome-profile",
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-gpu",
            "--disable-dev-shm-usage"
        ],
    }
};
