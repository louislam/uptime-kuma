process.env.UPTIME_KUMA_HIDE_LOG = ["info_db", "info_server"].join(",");

const { describe, test, before, after, beforeEach } = require("node:test");
const assert = require("node:assert");
const PrometheusClient = require("prom-client");
const { R } = require("redbean-node");
const { log } = require("../../src/util");
const { Prometheus } = require("../../server/prometheus");

const monitor = { id: 1, name: "m", type: "http", url: "u", hostname: null, port: null };
const beat = { status: 1, ping: 42 };
const tagLabels = (names) => names.map((name) => ({ name, value: "" }));

// A heartbeat for a monitor carrying the given tags, exactly as monitor.start()
// builds one. update() swallows a bad-label error and logs it, so failures are
// observed through the captured log rather than a thrown exception.
const beatWithTags = (names) => new Prometheus(monitor, tagLabels(names)).update(beat, undefined, null);

let loggedErrors = [];
let currentTags = [];
let origFindAll;
let origLogError;
const labelsetErrors = () => loggedErrors.filter((m) => m.includes("initial labelset"));

describe("Prometheus tag labels", () => {
    before(() => {
        origFindAll = R.findAll;
        R.findAll = async (type) => (type === "tag" ? currentTags.map((name) => ({ name })) : []);
        origLogError = log.error;
        log.error = (...args) =>
            loggedErrors.push(args.map((a) => (a && a.message ? a.message : String(a))).join(" "));
    });

    after(() => {
        R.findAll = origFindAll;
        log.error = origLogError;
        PrometheusClient.register.clear();
    });

    beforeEach(() => {
        loggedErrors = [];
    });

    test("a tag created after startup becomes a usable label after re-init", async () => {
        currentTags = ["critical"];
        await Prometheus.init();

        // Before re-init the labelset is frozen: a monitor carrying a tag that
        // did not exist at init() time is rejected by prom-client.
        beatWithTags(["legacy"]);
        assert.ok(labelsetErrors().length > 0, "expected the frozen labelset to reject the new tag");

        // A tag mutation re-runs init(); the new label is now registered.
        currentTags = ["critical", "legacy"];
        await Prometheus.init();
        loggedErrors = [];
        beatWithTags(["legacy"]);
        assert.strictEqual(labelsetErrors().length, 0, "re-init should make the new tag a valid label");

        const metrics = await PrometheusClient.register.metrics();
        assert.match(metrics, /monitor_status\{[^}]*legacy=/, "monitor_status should carry the legacy label");
    });

    test("re-init leaves metrics owned by other modules registered", async () => {
        // Stands in for the metrics prometheus-api-metrics registers on the
        // default registry for the /metrics endpoint: re-init must not wipe them.
        if (!(await PrometheusClient.register.getSingleMetric("sentinel_other_metric"))) {
            new PrometheusClient.Gauge({ name: "sentinel_other_metric", help: "not ours" });
        }
        currentTags = ["critical"];
        await Prometheus.init();
        assert.ok(
            await PrometheusClient.register.getSingleMetric("sentinel_other_metric"),
            "an unrelated metric on the default registry must survive re-init"
        );
    });

    test("deleting a tag drops its label from the metrics", async () => {
        currentTags = ["critical", "legacy"];
        await Prometheus.init();
        beatWithTags(["legacy"]);
        assert.match(await PrometheusClient.register.metrics(), /monitor_status\{[^}]*legacy=/);

        currentTags = ["critical"];
        await Prometheus.init();
        beatWithTags([]);
        assert.doesNotMatch(
            await PrometheusClient.register.metrics(),
            /monitor_status\{[^}]*legacy=/,
            "the removed tag should no longer appear as a label"
        );
    });
});
