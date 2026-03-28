const { R } = require("redbean-node");
const { log } = require("../src/util");

const DEFAULTS = {
    type: "http",
    interval: 60,
    maxretries: 1,
    timeout: 48,
    active: 1,
    accepted_statuscodes_json: '["200-299"]',
    maxredirects: 10,
    method: "GET",
};

/**
 * Seed monitors from the UPTIME_KUMA_MONITORS environment variable.
 *
 * The env var must be a JSON array of monitor objects. Each object requires
 * at minimum a `name` and `url`. All other fields are optional and fall back
 * to sensible defaults (see DEFAULTS above).
 *
 * Seeding is idempotent: if a monitor with the same URL already exists for
 * the user, it is skipped. Monitors added through the UI are never affected.
 *
 * Example value:
 *   UPTIME_KUMA_MONITORS='[{"name":"My API","url":"https://api.example.com"}]'
 *
 * @param {import("socket.io").Server} io Socket.io server instance
 * @param {object} server UptimeKumaServer instance (exposes monitorList)
 * @param {Function|null} startFn Optional override for starting a monitor — defaults to bean.start(io).
 *                                 Inject a no-op in tests to avoid real HTTP check loops.
 * @returns {Promise<void>}
 */
async function seedMonitorsFromEnv(io, server, startFn = null) {
    const raw = process.env.UPTIME_KUMA_MONITORS;
    if (!raw) {
        return;
    }

    let specs;
    try {
        specs = JSON.parse(raw);
    } catch (e) {
        log.error("seeder", "UPTIME_KUMA_MONITORS is not valid JSON: " + e.message);
        return;
    }

    if (!Array.isArray(specs) || specs.length === 0) {
        return;
    }

    const user = await R.findOne("user");
    if (!user) {
        log.warn("seeder", "No user found — skipping monitor seeding. Create an account first, then restart the server.");
        return;
    }

    for (const spec of specs) {
        if (!spec.name || !spec.url) {
            log.warn("seeder", "Skipping monitor entry missing 'name' or 'url': " + JSON.stringify(spec));
            continue;
        }

        const existing = await R.findOne("monitor", " url = ? AND user_id = ? ", [ spec.url, user.id ]);
        if (existing) {
            log.info("seeder", `Monitor already exists, skipping: ${spec.name} (${spec.url})`);
            continue;
        }

        const bean = R.dispense("monitor");
        bean.import({ ...DEFAULTS, ...spec });
        bean.user_id = user.id;
        await R.store(bean);

        server.monitorList[bean.id] = bean;
        const _start = startFn ?? ((b, ioInstance) => b.start(ioInstance));
        await _start(bean, io);

        log.info("seeder", `Seeded monitor: ${spec.name} (${spec.url})`);
    }
}

module.exports = { seedMonitorsFromEnv };
