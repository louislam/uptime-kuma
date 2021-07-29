module.exports = {
    env: {
        browser: true,
        commonjs: true,
        es2017: true,
        es11: true,
        node: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:vue/vue3-recommended",
    ],
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: "module",
    },
    rules: {
        // override/add rules settings here, such as:
        // 'vue/no-unused-vars': 'error'
        "no-unused-vars": "warn",
        indent: ["error", 4],
        quotes: ["warn", "double"],
        //semi: ['off', 'never'],
        "vue/html-indent": ["warn", 4], // default: 2
        "vue/max-attributes-per-line": "off",
        "vue/singleline-html-element-content-newline": "off",
        "no-multi-spaces": ["error", {
            ignoreEOLComments: true,
        }],
        "curly": "error",
        "object-curly-spacing": ["error", "always"],
        "object-curly-newline": ["error", {
            "ObjectExpression": {
                "minProperties": 1,
            },
            "ObjectPattern": {
                "multiline": true,
                "minProperties": 2,
            },
            "ImportDeclaration": {
                "multiline": true,
            },
            "ExportDeclaration": {
                "multiline": true,
                //'minProperties': 2,
            },
        }],
        "object-property-newline": "error",
        "comma-spacing": "error",
        "brace-style": "error",
        "no-var": "error",
        "key-spacing": "warn",
        "keyword-spacing": "warn",
        "space-infix-ops": "warn",
        "arrow-spacing": "warn",
        "no-trailing-spaces": "warn",
        "space-before-blocks": "warn",
        //'no-console': 'warn',
        "no-extra-boolean-cast": "off",
        "no-multiple-empty-lines": ["warn", {
            "max": 1,
            "maxBOF": 0,
        }],
        "lines-between-class-members": ["warn", "always", {
            exceptAfterSingleLine: true,
        }],
        "no-unneeded-ternary": "error",
        "no-else-return": ["error", {
            "allowElseIf": false,
        }],
        "array-bracket-newline": ["error", "consistent"],
        "eol-last": ["error", "always"],
        //'prefer-template': 'error',
        "comma-dangle": ["warn", "always-multiline"],
    },
}
