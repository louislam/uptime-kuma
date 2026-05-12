import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettier from "eslint-config-prettier";
import jsdoc from "eslint-plugin-jsdoc";
import vue from "eslint-plugin-vue";
import vueScopedCss from "eslint-plugin-vue-scoped-css";
import globals from "globals";

export default [
    {
        ignores: [
            "node_modules/**",
            "dist/**",
            "dist-ssr/**",
            "data/**",
            "private/**",
            "out/**",
            "tmp/**",
            "server/modules/*",
            "src/util.js",
            "test/*.js",
            "extra/exe-builder/bin/**",
            "extra/exe-builder/obj/**",
        ],
    },
    js.configs.recommended,
    ...vue.configs["flat/recommended"],
    ...vueScopedCss.configs["flat/recommended"],
    ...tsPlugin.configs["flat/recommended"],
    jsdoc.configs["flat/recommended-error"],
    prettier,
    {
        languageOptions: {
            ecmaVersion: 2020,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.commonjs,
                ...globals.node,
                FRONTEND_VERSION: "readonly",
            },
            parserOptions: {
                requireConfigFile: false,
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            jsdoc,
        },
    },
    {
        files: ["**/*.vue"],
        languageOptions: {
            parserOptions: {
                parser: tsParser,
                sourceType: "module",
                requireConfigFile: false,
            },
        },
    },
    {
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                sourceType: "module",
                requireConfigFile: false,
            },
        },
    },
    {
    rules: {
        yoda: "error",
        eqeqeq: ["warn", "smart"],
        camelcase: [
            "warn",
            {
                properties: "never",
                ignoreImports: true,
            },
        ],
        "no-unused-vars": [
            "warn",
            {
                args: "none",
            },
        ],
        "vue/max-attributes-per-line": "off",
        "vue/singleline-html-element-content-newline": "off",
        "vue/html-self-closing": "off",
        "vue/require-component-is": "off", // not allow is="style" https://github.com/vuejs/eslint-plugin-vue/issues/462#issuecomment-430234675
        "vue/attribute-hyphenation": "off", // This change noNL to "no-n-l" unexpectedly
        "vue/multi-word-component-names": "off",
        "vue-scoped-css/no-unused-selector": "warn",
        curly: "error",
        "no-var": "error",
        "no-throw-literal": "error",
        "no-constant-condition": [
            "error",
            {
                checkLoops: false,
            },
        ],
        //"no-console": "warn",
        "no-extra-boolean-cast": "off",
        "no-unneeded-ternary": "error",
        //"prefer-template": "error",
        "no-empty": [
            "error",
            {
                allowEmptyCatch: true,
            },
        ],
        "no-control-regex": "off",
        "one-var": ["error", "never"],
        "max-statements-per-line": ["error", { max: 1 }],
        "jsdoc/check-tag-names": [
            "error",
            {
                definedTags: ["link"],
            },
        ],
        "jsdoc/no-undefined-types": "off",
        "jsdoc/no-defaults": ["error", { noOptionalParamNames: true }],
        "jsdoc/require-throws": "warn",
        "jsdoc/require-jsdoc": [
            "error",
            {
                require: {
                    FunctionDeclaration: true,
                    MethodDefinition: true,
                },
            },
        ],
        "jsdoc/no-blank-block-descriptions": "error",
        "jsdoc/require-returns-description": "warn",
        "jsdoc/require-returns-check": ["error", { reportMissingReturnForUndefinedTypes: false }],
        "jsdoc/require-returns": [
            "warn",
            {
                forceRequireReturn: true,
                forceReturnsWithAsync: true,
            },
        ],
        "jsdoc/require-param-type": "warn",
        "jsdoc/require-param-description": "warn",
    },
    },
    {
        files: ["**/*.ts"],
        rules: {
            "jsdoc/require-returns-type": "off",
            "jsdoc/require-param-type": "off",
            "@typescript-eslint/no-explicit-any": "off",
            "prefer-const": "off",
        },
    },
];
