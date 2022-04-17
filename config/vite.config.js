import legacy from "@vitejs/plugin-legacy";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const postCssScss = require("postcss-scss");
const postcssRTLCSS = require("postcss-rtlcss");

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        vue(),
        legacy({
            targets: [ "ie > 11" ],
            additionalLegacyPolyfills: [ "regenerator-runtime/runtime" ]
        })
    ],
    css: {
        postcss: {
            "parser": postCssScss,
            "map": false,
            "plugins": [ postcssRTLCSS ]
        }
    },
});
