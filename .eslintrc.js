module.exports = {
    ignorePatterns: [
        "test/*.js",
        "server/modules/*",
        "src/util.js"
    ],
    root: true,
    env: {
        browser: true,
        commonjs: true,
        es2020: true,
        node: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:vue/vue3-recommended",
        "plugin:jsdoc/recommended-error",
    ],
    parser: "vue-eslint-parser",
    parserOptions: {
        parser: "@typescript-eslint/parser",
        sourceType: "module",
        requireConfigFile: false,
    },
    plugins: [
        "jsdoc",
        "@typescript-eslint",
    ],
    rules: {
        "yoda": "error",
        eqeqeq: [ "warn", "smart" ],
        "linebreak-style": [ "error", "unix" ],
        "camelcase": [ "warn", {
            "properties": "never",
            "ignoreImports": true
        }],
        "no-unused-vars": [ "warn", {
            "args": "none"
        }],
        indent: [
            "error",
            4,
            {
                ignoredNodes: [ "TemplateLiteral" ],
                SwitchCase: 1,
            },
        ],
        quotes: [ "error", "double" ],
        semi: "error",
        "vue/html-indent": [ "error", 4 ], // default: 2
        "vue/max-attributes-per-line": "off",
        "vue/singleline-html-element-content-newline": "off",
        "vue/html-self-closing": "off",
        "vue/require-component-is": "off",      // not allow is="style" https://github.com/vuejs/eslint-plugin-vue/issues/462#issuecomment-430234675
        "vue/attribute-hyphenation": "off",     // This change noNL to "no-n-l" unexpectedly
        "vue/multi-word-component-names": "off",
        "no-multi-spaces": [ "error", {
            ignoreEOLComments: true,
        }],
        "array-bracket-spacing": [ "warn", "always", {
            "singleValue": true,
            "objectsInArrays": false,
            "arraysInArrays": false
        }],
        "space-before-function-paren": [ "error", {
            "anonymous": "always",
            "named": "never",
            "asyncArrow": "always"
        }],
        "curly": "error",
        "object-curly-spacing": [ "error", "always" ],
        "object-curly-newline": "off",
        "object-property-newline": "error",
        "comma-spacing": "error",
        "brace-style": "error",
        "no-var": "error",
        "key-spacing": "warn",
        "keyword-spacing": "warn",
        "space-infix-ops": "error",
        "arrow-spacing": "warn",
        "no-trailing-spaces": "error",
        "no-constant-condition": [ "error", {
            "checkLoops": false,
        }],
        "space-before-blocks": "warn",
        //"no-console": "warn",
        "no-extra-boolean-cast": "off",
        "no-multiple-empty-lines": [ "warn", {
            "max": 1,
            "maxBOF": 0,
        }],
        "lines-between-class-members": [ "warn", "always", {
            exceptAfterSingleLine: true,
        }],
        "no-unneeded-ternary": "error",
        "array-bracket-newline": [ "error", "consistent" ],
        "eol-last": [ "error", "always" ],
        //"prefer-template": "error",
        "template-curly-spacing": [ "warn", "never" ],
        "comma-dangle": [ "warn", "only-multiline" ],
        "no-empty": [ "error", {
            "allowEmptyCatch": true
        }],
        "no-control-regex": "off",
        "one-var": [ "error", "never" ],
        "max-statements-per-line": [ "error", { "max": 1 }],
        "jsdoc/check-tag-names": [
            "error",
            {
                "definedTags": [ "link" ]
            }
        ],
        "jsdoc/no-undefined-types": "off",
        "jsdoc/no-defaults": [
            "error",
            { "noOptionalParamNames": true }
        ],
        "jsdoc/require-throws": "warn",
        "jsdoc/require-jsdoc": [
            "error",
            {
                "require": {
                    "FunctionDeclaration": true,
                    "MethodDefinition": true,
                }
            }
        ],
        "jsdoc/no-blank-block-descriptions": "error",
        "jsdoc/require-returns-description": "warn",
        "jsdoc/require-returns-check": [
            "error",
            { "reportMissingReturnForUndefinedTypes": false }
        ],
        "jsdoc/require-returns": [
            "warn",
            {
                "forceRequireReturn": true,
                "forceReturnsWithAsync": true
            }
        ],
        "jsdoc/require-param-type": "warn",
        "jsdoc/require-param-description": "warn"
    },
    "overrides": [
        {
            "files": [ "src/languages/*.js", "src/icon.js" ],
            "rules": {
                "comma-dangle": [ "error", "always-multiline" ],
            }
        },

        // Override for TypeScript
        {
            "files": [
                "**/*.ts",
            ],
            extends: [
                "plugin:@typescript-eslint/recommended",
            ],
            "rules": {
                "jsdoc/require-returns-type": "off",
                "jsdoc/require-param-type": "off",
                "@typescript-eslint/no-explicit-any": "off",
                "prefer-const": "off",
            }
        }
    ]
};
