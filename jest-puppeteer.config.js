module.exports = {
    "launch": {
        "headless": process.env.HEADLESS_TEST || false,
        "userDataDir": "./data/test-chrome-profile",
    }
};
