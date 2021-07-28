import legacy from "@vitejs/plugin-legacy"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vite"

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        legacy({
            targets: ["ie > 11"],
            additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
        }),
    ],
})
