import { defineConfig } from "cypress";

export default defineConfig({
    e2e: {
        baseUrl: "http://localhost:3002",
        defaultCommandTimeout: 10000,
        pageLoadTimeout: 60000,
        viewportWidth: 1920,
        viewportHeight: 1080,
        specPattern: ["cypress/e2e/setup.cy.ts", "cypress/e2e/**/*.ts"],
    },
    env: {
        baseUrl: "http://localhost:3002",
    },
});
