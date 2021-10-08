module.exports = {
    "verbose": true,
    "preset": "jest-puppeteer",
    "globals": {
        "__DEV__": true
    },
    "testRegex": "./test/*.spec.js",
    "rootDir": ".",
    "testTimeout": 30000,
    "transform": {
        "^.+\\.js$": "babel-jest",
        ".+\\.(css|styl|less|sass|scss|png|jpg|ttf|woff|woff2)$": "jest-transform-stub"
    }
};

