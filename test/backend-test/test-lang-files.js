const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");

describe("Language files", () => {
    test("every language in src/i18n.js has a file in src/lang", () => {
        const source = fs.readFileSync("src/i18n.js", "utf-8");
        const list = source.match(/const languageList = \{(?<body>[\s\S]*?)\n\};/).groups.body;
        const keys = [...list.matchAll(/^\s+(?:"(?<quoted>[^"]+)"|(?<bare>\w+)):/gm)].map(
            (m) => m.groups.quoted ?? m.groups.bare
        );
        assert.ok(keys.length > 0, "no languages found in src/i18n.js");

        // src/mixins/lang.js also tries the underscore form, since Weblate creates e.g. en_GB.json for "en-GB"
        const missing = keys.filter(
            (key) => !fs.existsSync(`src/lang/${key}.json`) && !fs.existsSync(`src/lang/${key.replace("-", "_")}.json`)
        );
        assert.deepStrictEqual(missing, [], `Languages without a file in src/lang: ${missing.join(", ")}`);
    });
});
