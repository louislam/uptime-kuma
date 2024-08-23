const { defineConfig } = require("cypress");

module.exports = defineConfig({
    projectId: "vyjuem",
    e2e: {
        experimentalStudio: true,
        setupNodeEvents(on, config) {

        },
        fixturesFolder: "test/cypress/fixtures",
        screenshotsFolder: "test/cypress/screenshots",
        videosFolder: "test/cypress/videos",
        downloadsFolder: "test/cypress/downloads",
        supportFile: "test/cypress/support/e2e.js",
        baseUrl: "http://localhost:3002",
        defaultCommandTimeout: 10000,
        pageLoadTimeout: 60000,
        viewportWidth: 1920,
        viewportHeight: 1080,
        specPattern: [
            "test/cypress/e2e/setup.cy.js",
            "test/cypress/e2e/**/*.js"
        ],
    },
    env: {
        baseUrl: "http://localhost:3002",
    },
});
