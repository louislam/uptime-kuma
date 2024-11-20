import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [ vue() ],
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: [ "./test/component/setup.js" ],
    },
    resolve: {
        alias: {
            "@": resolve(__dirname, "../src"),
        },
    },
});
