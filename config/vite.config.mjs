import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import visualizer from "rollup-plugin-visualizer";
import viteCompression from "vite-plugin-compression";
import postCssScss from "postcss-scss";
import postcssRTLCSS from "postcss-rtlcss";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

const viteCompressionFilter = /\.(js|mjs|json|css|html|svg)$/i;

// https://vitejs.dev/config/
export default defineConfig({
    server: {
        port: 3000,
    },
    define: {
        FRONTEND_VERSION: JSON.stringify(process.env.npm_package_version),
        "process.env": {},
    },
    plugins: [
        vue(),
        visualizer({
            filename: "tmp/dist-stats.html",
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
            parser: postCssScss,
            map: false,
            plugins: [postcssRTLCSS],
        },
        preprocessorOptions: {
            scss: {
                loadPaths: [projectRoot],
                quietDeps: true,

                // Most of them are coming from boostrap unfortunately
                silenceDeprecations: [
                    "import",
                    "global-builtin",
                    "if-function",
                    "color-functions",
                    "abs-percent",
                    "function-units",
                ],
            },
        },
    },
    build: {
        commonjsOptions: {
            include: [/.js$/],
        },
    },
});
