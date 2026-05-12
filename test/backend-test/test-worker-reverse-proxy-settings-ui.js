const { describe, test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

describe("Worker Reverse Proxy settings UI", () => {
    test("allows the Reverse Proxy settings page in Worker UI mode", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/pages/Settings.vue"),
            "utf8"
        );

        assert.match(
            source,
            /\["general",\s*"appearance",\s*"reverse-proxy",\s*"twingate",\s*"import-monitors"\]/,
            "reverse-proxy should be listed as a supported Worker settings page"
        );
    });

    test("does not initialize local cloudflared controls in Worker UI mode", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../src/components/settings/ReverseProxy.vue"),
            "utf8"
        );

        assert.match(
            source,
            /<section v-if="!\$root\.isCloudflareWorkerUI"[\s\S]*?<h4 class="mt-4">Cloudflare Tunnel<\/h4>/,
            "local Cloudflare Tunnel controls should be hidden in the Worker UI"
        );
        assert.match(
            source,
            /if \(!this\.\$root\.isCloudflareWorkerUI\) \{\s*this\.\$root\.getSocket\(\)\.emit\(prefix \+ "join"\);/,
            "Reverse Proxy settings should only join the cloudflared socket channel outside Worker UI mode"
        );
        assert.match(
            source,
            /if \(!this\.\$root\.isCloudflareWorkerUI\) \{\s*this\.\$root\.getSocket\(\)\.emit\(prefix \+ "leave"\);/,
            "Reverse Proxy settings should only leave the cloudflared socket channel outside Worker UI mode"
        );
    });
});
