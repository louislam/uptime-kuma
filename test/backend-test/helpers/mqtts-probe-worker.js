// Worker script invoked by the MQTTS integration test in test-monitor-types.js.
//
// The kuma MQTT monitor calls `mqtt.connect()` without TLS overrides, so a
// self-signed broker cert can only be accepted via Node's process-wide
// `NODE_EXTRA_CA_CERTS` knob — and Node only reads that env var once, when
// TLS is first initialised. We therefore can't toggle it from inside the
// parent test (which already loaded TLS via earlier connections in other
// describe blocks). Instead the parent forks this worker with the env var
// pre-set, and we run the kuma probe in a fresh process.
//
// Inputs (env):
//   MQTTS_PROBE_HOST       hostname kuma should connect to
//   MQTTS_PROBE_PORT       mapped TLS port on the broker
//   MQTTS_PROBE_TOPIC      topic to subscribe to
//   MQTTS_PROBE_KEYWORD    success keyword to look for in the message
//   MQTTS_PROBE_INTERVAL   seconds (default 20) — kuma uses interval*0.8 as
//                          the subscribe-receive timeout
//   NODE_EXTRA_CA_CERTS    path to PEM holding the test CA (set by parent)
//
// Output: exits 0 with `RESULT_JSON {...}` on the last stdout line. Status
// is the kuma `UP` / `DOWN` numeric. Any thrown error is reported as
// `{ ok: false, error }` rather than a non-zero exit, so the parent can
// surface a clean assertion message.

"use strict";

const host = process.env.MQTTS_PROBE_HOST;
const port = parseInt(process.env.MQTTS_PROBE_PORT, 10);
const topic = process.env.MQTTS_PROBE_TOPIC;
const keyword = process.env.MQTTS_PROBE_KEYWORD;
const interval = parseInt(process.env.MQTTS_PROBE_INTERVAL || "20", 10);

(async () => {
    let result;
    try {
        const { MqttMonitorType } = require("../../../server/monitor-types/mqtt");
        const monitorType = new MqttMonitorType();

        const monitor = {
            id: 0,
            type: "mqtt",
            // Force the mqtts:// scheme — the monitor's regex sees the
            // protocol prefix and skips its default mqtt:// rewrite.
            hostname: `mqtts://${host}`,
            port,
            interval,
            mqtt_topic: topic,
            mqtt_check_type: "keyword",
            mqtt_success_message: keyword,
            mqtt_username: undefined,
            mqtt_password: undefined,
            mqtt_websocket_path: undefined,
            conditions: "[]",
        };
        const heartbeat = { status: 0, msg: "", ping: null, duration: 0, important: false, retries: 0 };
        await monitorType.check(monitor, heartbeat, { getUserAgent: () => "uptime-kuma-test" });
        result = { ok: true, status: heartbeat.status, msg: heartbeat.msg };
    } catch (err) {
        result = { ok: false, error: err && err.message ? err.message : String(err) };
    }
    // Last stdout line — parent slices on this prefix.
    process.stdout.write(`RESULT_JSON ${JSON.stringify(result)}\n`);
    process.exit(0);
})();
