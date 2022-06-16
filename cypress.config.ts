import { defineConfig } from "cypress";

export default defineConfig({
    e2e: {
        baseUrl: "http://localhost:3000",
        defaultCommandTimeout: 10000,
        pageLoadTimeout: 60000,
        viewportWidth: 1920,
        viewportHeight: 1080,
    },
    env: {
        baseUrl: "http://localhost:3000",
    },
});
