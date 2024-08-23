import legacy from "@vitejs/plugin-legacy";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import viteCompression from "vite-plugin-compression";

const postCssScss = require("postcss-scss");
const postcssRTLCSS = require("postcss-rtlcss");

const viteCompressionFilter = /\.(js|mjs|json|css|html|svg)$/i;

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: 3000,
    },
    define: {
        "FRONTEND_VERSION": JSON.stringify(process.env.npm_package_version),
        "DEVCONTAINER": JSON.stringify(process.env.DEVCONTAINER),
        "GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN": JSON.stringify(process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN),
        "CODESPACE_NAME": JSON.stringify(process.env.CODESPACE_NAME),
    },
    plugins: [
        vue(),
        legacy({
            targets: [ "since 2015" ],
        }),
        visualizer({
            filename: "tmp/dist-stats.html"
        }),
        viteCompression({
            algorithm: "gzip",
            filter: viteCompressionFilter,
        }),
        viteCompression({
            algorithm: "brotliCompress",
            filter: viteCompressionFilter,
        }),
    ],
    css: {
        postcss: {
            "parser": postCssScss,
            "map": false,
            "plugins": [ postcssRTLCSS ]
        }
    },
    build: {
        commonjsOptions: {
            include: [ /.js$/ ],
        },
        rollupOptions: {
            output: {
                manualChunks(id, { getModuleInfo, getModuleIds }) {

                }
            }
        },
    }
});
