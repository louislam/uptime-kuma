const { describe, test } = require("node:test");
const assert = require("node:assert");
const parserFactory = require("../../server/modules/ping/lib/parser/factory");
const linuxBuilder = require("../../server/modules/ping/lib/builder/linux");
const macBuilder = require("../../server/modules/ping/lib/builder/mac");

// Fixtures from https://github.com/danielzzz/node-ping/tree/master/test/fixture
const MACOS_NAN_STDDEV = `PING www.taobao.com.danuoyi.tbcache.com (122.225.217.183): 56 data bytes
64 bytes from 122.225.217.183: icmp_seq=0 ttl=53 time=4.628 ms

--- www.taobao.com.danuoyi.tbcache.com ping statistics ---
1 packets transmitted, 1 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 4.628/4.628/4.628/nan ms`;

const MACOS_NORMAL = `PING google.com (172.217.24.46): 56 data bytes
64 bytes from 172.217.24.46: icmp_seq=0 ttl=54 time=5.371 ms
64 bytes from 172.217.24.46: icmp_seq=1 ttl=54 time=4.269 ms

--- google.com ping statistics ---
2 packets transmitted, 2 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 4.269/4.820/5.371/0.551 ms`;

const OPENBSD_NAN_STDDEV = `PING 8.8.8.8 (8.8.8.8): 56 data bytes
64 bytes from 8.8.8.8: icmp_seq=0 ttl=117 time=10.000 ms

--- 8.8.8.8 ping statistics ---
1 packets transmitted, 1 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 10.000/10.000/10.000/nan ms`;

const BUSYBOX_IPV4 = `PING 1.1.1.1 (1.1.1.1): 56 data bytes
64 bytes from 1.1.1.1: seq=0 ttl=64 time=1.000 ms

--- 1.1.1.1 ping statistics ---
1 packets transmitted, 1 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 1.000/1.000/1.000/0.000 ms`;

const BUSYBOX_IPV6 = `PING 2606:4700:4700::1111 (2606:4700:4700::1111): 56 data bytes
64 bytes from 2606:4700:4700::1111: seq=0 ttl=57 time=0.672 ms

--- 2606:4700:4700::1111 ping statistics ---
1 packets transmitted, 1 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 0.672/0.672/0.672/nan ms`;

// BusyBox prints no stddev
const BUSYBOX_LOOPBACK = `PING ::1 (::1): 56 data bytes
64 bytes from ::1: seq=0 ttl=64 time=0.042 ms

--- ::1 ping statistics ---
1 packets transmitted, 1 packets received, 0% packet loss
round-trip min/avg/max = 0.042/0.042/0.042 ms`;

const LINUX_TARGET = `PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
64 bytes from 8.8.8.8: icmp_seq=1 ttl=117 time=1.000 ms

--- 8.8.8.8 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 1.000/1.000/1.000/0.000 ms`;

const LINUX_NAMED_REPLY = `PING google.com (142.251.29.102) 56(84) bytes of data.
64 bytes from uv-in-f102.1e100.net (142.251.29.102): icmp_seq=1 ttl=110 time=9.16 ms

--- google.com ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 9.162/9.162/9.162/0.000 ms`;

const LINUX_IPV6_TARGET = `PING 2606:4700:4700::1111(2606:4700:4700::1111) 56 data bytes
64 bytes from 2606:4700:4700::1111: icmp_seq=1 ttl=57 time=0.672 ms

--- 2606:4700:4700::1111 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 0.672/0.672/0.672/0.000 ms`;

const LINUX_DIFFERENT_ADDRESS = `PING 192.168.178.1 (192.168.178.1) 56(84) bytes of data.
64 bytes from 192.168.178.8: icmp_seq=1 ttl=64 time=0.578 ms (DIFFERENT ADDRESS!)
64 bytes from 192.168.178.8: icmp_seq=2 ttl=64 time=0.348 ms (DIFFERENT ADDRESS!)

--- 192.168.178.1 ping statistics ---
2 packets transmitted, 2 received, 0% packet loss, time 1000ms
rtt min/avg/max/mdev = 0.348/0.463/0.578/0.115 ms`;

const LINUX_PREFIX_OF_TARGET = `PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
64 bytes from 8.8.8.80: icmp_seq=1 ttl=64 time=1.000 ms

--- 8.8.8.8 ping statistics ---
1 packets transmitted, 1 received, 0% packet loss, time 0ms
rtt min/avg/max/mdev = 1.000/1.000/1.000/0.000 ms`;

const WINDOWS = `Pinging www.some-domain.com [127.0.0.1] with 32 bytes of
Reply from 127.0.0.1: bytes=32 time=564ms TTL=237
Reply from 127.0.0.1: bytes=32 time=555ms TTL=237

Ping statistics for 127.0.0.1:
   Packets: Sent = 2, Received = 2, Lost = 0 (0% loss)
   Approximate round trip times in milli-seconds:
      Minimum = 555ms, Maximum = 564ms, Average = 559ms`;

describe("Monitor Type: ping parser", () => {
    describe("statistics with a nan stddev", () => {
        test("macOS keeps min/avg/max when stddev is nan", () => {
            const res = parse("darwin", MACOS_NAN_STDDEV);

            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.time, 4.628);
            assert.strictEqual(res.min, "4.628");
            assert.strictEqual(res.avg, "4.628");
            assert.strictEqual(res.max, "4.628");
            assert.strictEqual(res.stddev, "0.000");
        });

        test("linux keeps min/avg/max when stddev is nan", () => {
            const res = parse("linux", MACOS_NAN_STDDEV);

            assert.strictEqual(res.avg, "4.628");
            assert.strictEqual(res.max, "4.628");
            assert.strictEqual(res.stddev, "0.000");
        });

        test("openbsd keeps min/avg/max when stddev is nan", () => {
            const res = parse("openbsd", OPENBSD_NAN_STDDEV);

            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.min, "10.000");
            assert.strictEqual(res.avg, "10.000");
            assert.strictEqual(res.max, "10.000");
            assert.strictEqual(res.stddev, "0.000");
        });

        test("macOS parses a normal footer unchanged", () => {
            const res = parse("darwin", MACOS_NORMAL);

            assert.strictEqual(res.time, 5.371);
            assert.strictEqual(res.min, "4.269");
            assert.strictEqual(res.avg, "4.820");
            assert.strictEqual(res.max, "5.371");
            assert.strictEqual(res.stddev, "0.551");
        });
    });

    describe("numeric_host", () => {
        test("linux reads the address from a BusyBox style header", () => {
            const res = parse("linux", BUSYBOX_IPV4, linuxDefaults("1.1.1.1"));

            assert.strictEqual(res.numeric_host, "1.1.1.1");
            assert.strictEqual(res.alive, true);
        });

        test("linux reads the address from a BusyBox style IPv6 header", () => {
            const res = parse("linux", BUSYBOX_IPV6, linuxDefaults("2606:4700:4700::1111"));

            assert.strictEqual(res.numeric_host, "2606:4700:4700::1111");
            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.time, 0.672);
        });

        test("linux keeps a BusyBox IPv6 reply without a stddev", () => {
            const res = parse("linux", BUSYBOX_LOOPBACK, linuxDefaults("::1"));

            assert.strictEqual(res.numeric_host, "::1");
            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.time, 0.042);
        });
    });

    describe("reply address verification", () => {
        test("linux rejects a reply from a different address by default", () => {
            const res = parse("linux", LINUX_DIFFERENT_ADDRESS, linuxDefaults("192.168.178.1"));

            assert.strictEqual(res.alive, false);
            assert.strictEqual(res.packetLoss, "100.000");
        });

        test("linux rejects a reply from an address that shares the target prefix", () => {
            const res = parse("linux", LINUX_PREFIX_OF_TARGET, linuxDefaults("8.8.8.8"));

            assert.strictEqual(res.alive, false);
        });

        test("linux accepts a reply from the target address", () => {
            const res = parse("linux", LINUX_TARGET, linuxDefaults("8.8.8.8"));

            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.time, 1);
        });

        test("linux accepts a reply that also prints the reverse DNS name", () => {
            const res = parse("linux", LINUX_NAMED_REPLY, linuxDefaults("google.com"));

            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.time, 9.16);
        });

        test("linux accepts a reply from an IPv6 target", () => {
            const res = parse("linux", LINUX_IPV6_TARGET, linuxDefaults("2606:4700:4700::1111"));

            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.time, 0.672);
        });

        test("linux accepts a different address when verification is off", () => {
            const res = parse("linux", LINUX_DIFFERENT_ADDRESS, { ignoreDifferentAddressReply: false });

            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.packetLoss, "0.000");
        });
    });

    describe("windows", () => {
        test("parses a normal ping", () => {
            const res = parse("win32", WINDOWS, { packetSize: 32 });

            assert.strictEqual(res.alive, true);
            assert.strictEqual(res.time, 564);
            assert.strictEqual(res.avg, "559.000");
        });
    });
});

describe("Monitor Type: ping builder", () => {
    test("linux spawn options do not modify process.env", () => {
        const previousLang = process.env.LANG;
        const options = linuxBuilder.getSpawnOptions();

        assert.strictEqual(options.env.LANG, "C");
        assert.notStrictEqual(options.env, process.env);
        assert.strictEqual(process.env.LANG, previousLang);
    });

    test("linux falls back to the deadline for an IPv6 timeout", () => {
        const args = linuxBuilder.getCommandArguments("::1", { v6: true, timeout: 2, min_reply: 1 });

        // GNU inetutils ping6 rejects -W
        assert.ok(!args.includes("-W"), args.join(" "));
        assert.strictEqual(args[args.indexOf("-w") + 1], "2");
    });

    test("linux keeps -W for an IPv4 timeout", () => {
        const args = linuxBuilder.getCommandArguments("1.1.1.1", { v6: false, timeout: 2, min_reply: 1 });

        assert.ok(args.includes("-W"), args.join(" "));
        assert.ok(!args.includes("-w"), args.join(" "));
    });

    test("macOS passes an IPv6 timeout as a deadline", () => {
        const args = macBuilder.getCommandArguments("::1", { v6: true, timeout: 2, min_reply: 1 });

        assert.ok(!args.includes("-W"), args.join(" "));
        assert.strictEqual(args[args.indexOf("-t") + 1], "2");
    });
});

/**
 * Build the ping config the way a Linux probe does, defaults included
 * @param {string} target - Pinged host or IP address
 * @returns {object} Ping config with the builder defaults applied
 */
function linuxDefaults(target) {
    const config = {};
    linuxBuilder.getCommandArguments(target, config);
    return config;
}

/**
 * Feed fixture output to the real parser of a platform
 * @param {string} platform - Platform name, as os.platform() would return
 * @param {string} output - System ping output
 * @param {object} config - Ping config passed to the parser, optional
 * @returns {object} Parsed ping response
 */
function parse(platform, output, config) {
    const parser = parserFactory.createParser("8.8.8.8", platform, config);
    for (const line of output.split("\n")) {
        parser.eat(line);
    }
    return parser.getResult();
}
