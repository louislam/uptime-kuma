const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const readSource = (relativePath) => fs.readFileSync(path.join(__dirname, "../..", relativePath), "utf8");

describe("UI theme and button styling", () => {
    test("global controls use compact corner radii instead of pill-shaped buttons", () => {
        const vars = readSource("src/assets/vars.scss");
        const appStyles = readSource("src/assets/app.scss");

        assert.match(vars, /\$border-radius:\s*0\.5rem;/);
        assert.match(vars, /\$button-border-radius:\s*0\.55rem;/);
        assert.match(vars, /\$button-border-radius-sm:\s*0\.45rem;/);
        assert.match(appStyles, /\.btn\s*\{[^}]*border-radius:\s*\$button-border-radius;/s);
        assert.match(appStyles, /\.btn-sm\s*\{[^}]*border-radius:\s*\$button-border-radius-sm;/s);
        assert.match(appStyles, /\.btn-outline-normal\s*\{[^}]*border-radius:\s*\$button-border-radius-sm;/s);
    });

    test("app shell exposes an immediate light and dark mode toggle", () => {
        const layout = readSource("src/layouts/Layout.vue");
        const icons = readSource("src/icon.js");

        assert.match(layout, /class="nav-link theme-toggle-button"/);
        assert.match(layout, /:aria-label="themeToggleLabel"/);
        assert.match(layout, /toggleUserTheme\(\)/);
        assert.match(layout, /this\.\$root\.userTheme = this\.\$root\.isDark \? "light" : "dark";/);
        assert.match(icons, /faSun/);
        assert.match(icons, /faMoon/);
    });

    test("light theme has explicit dashboard and form surface colors", () => {
        const appStyles = readSource("src/assets/app.scss");
        const layout = readSource("src/layouts/Layout.vue");

        assert.match(appStyles, /\.light\s*\{/);
        assert.match(appStyles, /\.light\s*\{[\s\S]*background-color:\s*\$light-page-bg;/);
        assert.match(appStyles, /\.light\s*\{[\s\S]*\.shadow-box\s*\{/);
        assert.match(appStyles, /\.light\s*\{[\s\S]*\.form-control,[\s\S]*\.form-select/);
        assert.match(layout, /\.light\s*\{[\s\S]*header\s*\{/);
        assert.match(layout, /\.light\s*\{[\s\S]*\.bottom-nav\s*\{/);
    });

    test("selected monitor list item has a persistent selection rail and stronger label contrast", () => {
        const appStyles = readSource("src/assets/app.scss");

        assert.match(appStyles, /&\.active\s*\{[\s\S]*?box-shadow:\s*inset 4px 0 0 \$primary,/);
        assert.match(appStyles, /&\.active\s+\.monitor-name\s*\{[\s\S]*?font-weight:\s*700;/);
        assert.match(appStyles, /\.light\s*\{[\s\S]*?\.monitor-list\s*\{[\s\S]*?&\.active\s*\{[\s\S]*?box-shadow:\s*inset 4px 0 0 \$primary,/);
        assert.match(appStyles, /\.dark\s*\{[\s\S]*?\.monitor-list\s*\{[\s\S]*?&\.active\s*\{[\s\S]*?box-shadow:\s*inset 4px 0 0 \$primary,/);
    });
});
