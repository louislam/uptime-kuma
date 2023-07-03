const { defineConfig } = require("cypress");

module.exports = defineConfig({
    e2e: {
        supportFile: false,
        specPattern: [
            "test/cypress/unit/**/*.js"
        ],
    }
});
