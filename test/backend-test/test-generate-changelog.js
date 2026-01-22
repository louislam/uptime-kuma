const { describe, test } = require("node:test");
const assert = require("node:assert");

describe("Generate Changelog", () => {
    test("ignoreList should not contain @ symbols", () => {
        // Read the file to check the ignoreList
        const fs = require("fs");
        const path = require("path");
        const content = fs.readFileSync(
            path.join(__dirname, "../../extra/generate-changelog.mjs"),
            "utf-8"
        );
        
        // Extract the ignoreList line
        const ignoreListMatch = content.match(/const ignoreList = \[(.*?)\];/);
        assert.ok(ignoreListMatch, "ignoreList should be defined");
        
        const ignoreListStr = ignoreListMatch[1];
        
        // Check that none of the entries start with @
        assert.ok(!ignoreListStr.includes('"@'), "ignoreList should not contain entries starting with @");
        assert.ok(!ignoreListStr.includes("'@"), "ignoreList should not contain entries starting with @");
        
        // Verify specific bots are in the list (without @)
        assert.ok(ignoreListStr.includes('"autofix-ci[bot]"'), "autofix-ci[bot] should be in ignoreList");
        assert.ok(ignoreListStr.includes('"app/copilot-swe-agent"'), "app/copilot-swe-agent should be in ignoreList");
        assert.ok(ignoreListStr.includes('"app/github-actions"'), "app/github-actions should be in ignoreList");
        assert.ok(ignoreListStr.includes('"github-actions[bot]"'), "github-actions[bot] should be in ignoreList");
    });
    
    test("ignoreList should include all required bots", () => {
        const fs = require("fs");
        const path = require("path");
        const content = fs.readFileSync(
            path.join(__dirname, "../../extra/generate-changelog.mjs"),
            "utf-8"
        );
        
        // Extract the ignoreList line
        const ignoreListMatch = content.match(/const ignoreList = \[(.*?)\];/);
        const ignoreListStr = ignoreListMatch[1];
        
        // Parse the list (simple parsing for this test)
        const entries = ignoreListStr.split(',').map(s => s.trim().replace(/["']/g, ''));
        
        const requiredBots = [
            "autofix-ci[bot]",
            "app/copilot-swe-agent",
            "app/github-actions",
            "github-actions[bot]"
        ];
        
        for (const bot of requiredBots) {
            assert.ok(entries.includes(bot), `${bot} should be in ignoreList`);
        }
    });
});
