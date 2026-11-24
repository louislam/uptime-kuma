const { describe, test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { GenericContainer } = require("testcontainers");

// ping implementations that Uptime Kuma runs into on Linux
const IMPLEMENTATIONS = [
    {
        name: "GNU inetutils",
        image: "node:24-bookworm-slim",
        install: "apt-get update -qq && apt-get install -y -qq --no-install-recommends inetutils-ping",
    },
    {
        name: "iputils",
        image: "node:24-bookworm-slim",
        install: "apt-get update -qq && apt-get install -y -qq --no-install-recommends iputils-ping",
    },
    {
        // Newer iputils only ship ping, which handles IPv6 itself
        name: "iputils without ping6",
        image: "node:24-bookworm-slim",
        install:
            "apt-get update -qq && apt-get install -y -qq --no-install-recommends iputils-ping && rm -f /usr/bin/ping6",
    },
    {
        name: "BusyBox",
        image: "node:24-alpine",
    },
];

const SKIP =
    (!!process.env.CI && (process.platform !== "linux" || process.arch !== "x64")) ||
    Boolean(process.env.SKIP_TESTCONTAINER);

const PING_MODULE_PATH = path.join(__dirname, "../../../server/modules/ping");

// Runtime dependencies of the vendored ping module
const PING_DEPENDENCIES = ["command-exists", "iconv-lite", "chardet", "safer-buffer"].map((name) => ({
    source: path.join(__dirname, "../../../node_modules", name),
    target: `/ping/node_modules/${name}`,
}));

for (const implementation of IMPLEMENTATIONS) {
    describe(`Monitor Type: ping with ${implementation.name}`, { skip: SKIP }, () => {
        /** @type {import("testcontainers").StartedTestContainer | undefined} */
        let container;

        before(async () => {
            container = await new GenericContainer(implementation.image)
                .withCopyDirectoriesToContainer([{ source: PING_MODULE_PATH, target: "/ping" }, ...PING_DEPENDENCIES])
                .withCommand(["sleep", "infinity"])
                .start();

            if (implementation.install) {
                const installed = await container.exec(["sh", "-c", implementation.install]);
                assert.strictEqual(installed.exitCode, 0, installed.output);
            }
        });

        after(async () => {
            await container?.stop();
        });

        test("probe() reaches an IPv6 literal when the caller asked for IPv4", async () => {
            const res = await probe({
                v6: false,
                min_reply: 2,
                numeric: true,
                deadline: 5,
                timeout: 2,
                packetSize: 56,
            });

            assert.strictEqual(res.error, undefined, res.error);
            assert.strictEqual(res.alive, true, res.output);
            assert.strictEqual(typeof res.time, "number");
        });

        test("probe() passes only supported options on the IPv6 path", async () => {
            const res = await probe({
                v6: true,
                min_reply: 2,
                numeric: true,
                deadline: 5,
                timeout: 2,
                packetSize: 56,
            });

            assert.strictEqual(res.error, undefined, res.error);
            assert.ok(!res.output.includes("invalid option"), res.output);
            assert.strictEqual(res.alive, true, res.output);
        });

        /**
         * Probe the IPv6 loopback inside the container, with the real ping library
         * @param {object} config - Ping config, as the ping monitor would pass it
         * @returns {Promise<object>} Parsed ping response, or `{ error }`
         */
        async function probe(config) {
            const script = `
                const ping = require("/ping");
                ping.promise.probe("::1", ${JSON.stringify(config)}).then(
                    (res) => process.stdout.write(JSON.stringify(res)),
                    (err) => process.stdout.write(JSON.stringify({ error: err.message }))
                );
            `;

            const result = await container.exec(["node", "-e", script]);
            assert.strictEqual(result.exitCode, 0, result.output);

            return JSON.parse(result.stdout);
        }
    });
}
