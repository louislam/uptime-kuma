import { test } from "node:test";
import assert from "node:assert";
import { readFileSync } from "node:fs";

const socketSource = readFileSync(new URL("../../src/mixins/socket.js", import.meta.url), "utf8");

/**
 * Read the transports option passed to io() in socket.js
 * @returns Transport names, or an empty array when the option is unset
 */
function configuredTransports() {
    const match = socketSource.match(/transports\s*:\s*\[([^\]]*)\]/);
    if (!match) {
        return [];
    }

    return match[1]
        .split(",")
        .map((name) => name.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
}

test("socket.io client does not request WebSocket first", () => {
    const transports = configuredTransports();

    // Unset means the socket.io-client default: HTTP polling, then upgrade to WebSocket
    assert.ok(
        transports.length === 0 || transports[0] === "polling",
        `The client must not connect with WebSocket first (got [${transports.join(", ")}]). The dev frontend ` +
            "(:3000) connects to the backend (:3001), whose WebSocket origin check rejects that cross-port origin, " +
            "so the first connection has to be polling, which CORS allows."
    );
});
