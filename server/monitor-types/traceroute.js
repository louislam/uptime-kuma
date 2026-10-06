const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const childProcessAsync = require("promisify-child-process");
const dns = require("dns").promises;
const net = require("net");

class TracerouteMonitorType extends MonitorType {
    name = "traceroute";

    async check(monitor, heartbeat) {
        const target = String(monitor.hostname || "").trim();
        if (!target) {
            throw new Error("Traceroute target is required");
        }

        if (!net.isIP(target)) {
            await dns.lookup(target, { family: monitor.tracerouteIPv6 ? 6 : 4 });
        }

        const maxHops = this.integer(monitor.tracerouteMaxHops, 30, 1, 64);
        const probes = this.integer(monitor.tracerouteProbes, 3, 1, 5);
        const timeout = this.integer(monitor.tracerouteTimeout, 1000, 100, 10000);
        const command = monitor.tracerouteIPv6 ? "traceroute6" : "traceroute";
        const started = Date.now();

        let result;
        try {
            result = await childProcessAsync.execFile(command, [
                "-n", "-m", String(maxHops), "-w", String(Math.max(1, Math.ceil(timeout / 1000))),
                "-q", String(probes), target,
            ], {
                timeout: Math.max(10000, timeout * maxHops + 5000),
                maxBuffer: 1024 * 1024,
            });
        } catch (error) {
            const output = [error.stdout?.toString?.() || "", error.stderr?.toString?.() || ""]
                .filter(Boolean).join("\n").trim();
            heartbeat.ping = Date.now() - started;
            throw new Error(this.compact(output || error.message));
        }

        const output = result.stdout?.toString?.() || "";
        const hops = this.parse(output);
        const reached = this.destinationReached(hops, target);

        heartbeat.ping = Date.now() - started;
        heartbeat.traceroute = JSON.stringify({ target, ipv6: !!monitor.tracerouteIPv6, hops });
        heartbeat.msg = this.message(output, reached, hops.length);

        if (!reached) {
            throw new Error(this.message(output, false, hops.length));
        }

        heartbeat.status = UP;
    }

    integer(value, fallback, min, max) {
        const number = Number(value);
        return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
    }

    parse(output) {
        const hops = [];

        for (const rawLine of output.split(/\r?\n/)) {
            const line = rawLine.trim();
            const match = line.match(/^(\d+)\s+(.+)$/);
            if (!match) {
                continue;
            }

            const tokens = match[2].split(/\s+/);
            const hopProbes = [];
            for (let i = 0; i < tokens.length; i++) {
                if (tokens[i] === "*") {
                    hopProbes.push({ ip: null, rtt: null });
                    continue;
                }

                const ipMatch = tokens[i].match(/^\(?([0-9a-f:.]+)\)?$/i);
                if (!ipMatch) {
                    const rtt = tokens[i].match(/^(\d+(?:\.\d+)?)\s*ms$/i);
                    if (rtt && hopProbes.length) {
                        hopProbes[hopProbes.length - 1].rtt = Number(rtt[1]);
                    }
                    continue;
                }

                const ip = ipMatch[1];
                let rtt = null;
                if (i + 1 < tokens.length) {
                    const rttMatch = tokens[i + 1].match(/^(\d+(?:\.\d+)?)\s*ms$/i);
                    if (rttMatch) {
                        rtt = Number(rttMatch[1]);
                        i++;
                    }
                }
                hopProbes.push({ ip, rtt });
            }

            const valid = hopProbes.filter((probe) => probe.rtt != null).map((probe) => probe.rtt);
            hops.push({
                hop: Number(match[1]),
                ip: hopProbes.find((probe) => probe.ip)?.ip || null,
                probes: hopProbes,
                avgRtt: valid.length ? Number((valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(2)) : null,
            });
        }

        return hops;
    }

    destinationReached(hops, target) {
        const last = hops[hops.length - 1];
        return !!last && last.probes.some((probe) => probe.ip === target);
    }

    compact(output) {
        return String(output || "Traceroute failed").replace(/\s+/g, " ").trim().slice(0, 1024);
    }

    message(output, reached, hops) {
        return (reached ? "Destination reached" : "Destination not reached") +
            " in " + hops + " hops: " + this.compact(output);
    }
}

module.exports = { TracerouteMonitorType };
