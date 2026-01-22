const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

/**
 * Extract the ignoreList array from the file content
 * @param {string} content - File content
 * @returns {string} - The ignoreList content as a string
 */
function extractIgnoreList(content) {
    // Match the ignoreList array, handling square brackets in usernames
    const ignoreListMatch = content.match(/const ignoreList = \[([\s\S]*?)\];/);
    assert.ok(ignoreListMatch, "ignoreList should be defined");
    return ignoreListMatch[1];
}

describe("Generate Changelog", () => {
    test("ignoreList should not contain @ symbols", () => {
        const content = fs.readFileSync(
            path.join(__dirname, "../../extra/generate-changelog.mjs"),
            "utf-8"
        );
        
        const ignoreListStr = extractIgnoreList(content);
        
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
        const content = fs.readFileSync(
            path.join(__dirname, "../../extra/generate-changelog.mjs"),
            "utf-8"
        );
        
        const ignoreListStr = extractIgnoreList(content);
        
        const requiredBots = [
            "autofix-ci[bot]",
            "app/copilot-swe-agent",
            "app/github-actions",
            "github-actions[bot]"
        ];
        
        for (const bot of requiredBots) {
            assert.ok(ignoreListStr.includes(`"${bot}"`), `${bot} should be in ignoreList`);
        }
    });
});
