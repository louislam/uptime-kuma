const { test } = require("node:test");
const assert = require("node:assert/strict");
const { openNtripTransport, BUSY_STATUS_CODES } = require("../../../server/ntrip/transport");
const { createMockCaster, waitFor, buildLegacyGps } = require("./ntrip-support");

const frame = buildLegacyGps({ messageType: 1004, stationId: 1234, towMs: 432000000, satelliteCount: 8 });

/**
 * Connect to a mock caster and collect every transport callback.
 * @param {object} options Test options
 * @param {Function} options.reply Caster reply behaviour
 * @param {object} options.config Configuration overrides
 * @returns {Promise<object>} Caster, connection, recorded events and a cleanup function
 */
async function connect({ reply, config = {} }) {
    const caster = createMockCaster({ reply });
    const port = await caster.listen();

    const accepted = [];
    const data = [];
    const failures = [];
    const abort = new AbortController();

    const connection = openNtripTransport(
        {
            hostname: "127.0.0.1",
            port,
            tls: false,
            mountpoint: "BASE",
            revision: "2",
            username: null,
            password: null,
            ...config,
        },
        {
            signal: abort.signal,
            onAccepted: () => accepted.push(true),
            onData: (chunk) => data.push(chunk),
            onFailure: (error) => failures.push(error),
        }
    );

    return {
        caster,
        connection,
        accepted,
        data,
        failures,
        abort,
        cleanup: async () => {
            abort.abort();
            connection.close();
            await caster.close();
        },
    };
}

/**
 * Reply with a Rev2 success header followed by optional body bytes.
 * @param {Buffer} body Bytes to send with the header
 * @returns {Function} Caster reply function
 */
function rev2Success(body) {
    return (socket) => {
        const header = Buffer.from("HTTP/1.1 200 OK\r\nContent-Type: gnss/data\r\n\r\n", "ascii");
        socket.write(body ? Buffer.concat([header, body]) : header);
    };
}

test("accepts a Rev2 handshake and passes stream bytes through unchanged", async () => {
    const h = await connect({ reply: rev2Success(frame) });
    await waitFor(() => h.accepted.length > 0, "acceptance");
    await waitFor(() => Buffer.concat(h.data).length >= frame.length, "stream bytes");

    assert.deepEqual(Buffer.concat(h.data), frame);
    assert.deepEqual(h.failures, []);
    await h.cleanup();
});

test("sends a Rev2 request naming the mountpoint and NTRIP version", async () => {
    const h = await connect({ reply: rev2Success() });
    await waitFor(() => h.caster.requests.length > 0, "request");

    const request = h.caster.requests[0];
    assert.match(request, /^GET \/BASE HTTP\/1\.1\r\n/);
    assert.match(request, /\r\nHost: 127\.0\.0\.1:\d+\r\n/);
    assert.match(request, /\r\nNtrip-Version: Ntrip\/2\.0\r\n/);
    assert.match(request, /\r\nUser-Agent: NTRIP /);
    await h.cleanup();
});

test("sends a Rev1 request without an Ntrip-Version header", async () => {
    const h = await connect({
        config: { revision: "1" },
        reply: (socket) => socket.write("ICY 200 OK\r\n\r\n"),
    });
    await waitFor(() => h.accepted.length > 0, "acceptance");

    const request = h.caster.requests[0];
    assert.match(request, /^GET \/BASE HTTP\/1\.0\r\n/);
    assert.ok(!request.includes("Ntrip-Version"));
    await h.cleanup();
});

test("accepts a Rev1 response that omits the blank line before the stream", async () => {
    const h = await connect({
        config: { revision: "1" },
        reply: (socket) => socket.write(Buffer.concat([Buffer.from("ICY 200 OK\r\n", "ascii"), frame])),
    });
    await waitFor(() => h.accepted.length > 0, "acceptance");
    await waitFor(() => Buffer.concat(h.data).length >= frame.length, "stream bytes");

    assert.deepEqual(Buffer.concat(h.data), frame);
    assert.deepEqual(h.failures, []);
    await h.cleanup();
});

test("reassembles a status line and headers split across packets", async () => {
    const h = await connect({
        reply: (socket) => {
            const header = "HTTP/1.1 200 OK\r\nContent-Type: gnss/data\r\n\r\n";
            let index = 0;
            const push = () => {
                if (index >= header.length) {
                    socket.write(frame);
                    return;
                }
                socket.write(header.slice(index, index + 3));
                index += 3;
                setTimeout(push, 1);
            };
            push();
        },
    });
    await waitFor(() => h.accepted.length > 0, "acceptance");
    await waitFor(() => Buffer.concat(h.data).length >= frame.length, "stream bytes");
    assert.deepEqual(Buffer.concat(h.data), frame);
    await h.cleanup();
});

test("decodes a chunked Rev2 body across arbitrary boundaries", async () => {
    const h = await connect({
        reply: (socket) => {
            socket.write("HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n");
            const encoded = Buffer.concat([
                Buffer.from(`${frame.length.toString(16)}\r\n`, "ascii"),
                frame,
                Buffer.from("\r\n", "ascii"),
                Buffer.from(`${frame.length.toString(16)}\r\n`, "ascii"),
                frame,
                Buffer.from("\r\n", "ascii"),
            ]);
            let index = 0;
            const push = () => {
                if (index >= encoded.length) {
                    return;
                }
                socket.write(encoded.subarray(index, index + 7));
                index += 7;
                setTimeout(push, 1);
            };
            push();
        },
    });
    await waitFor(() => h.accepted.length > 0, "acceptance");
    await waitFor(() => Buffer.concat(h.data).length >= frame.length * 2, "decoded chunks");

    assert.deepEqual(Buffer.concat(h.data), Buffer.concat([frame, frame]));
    assert.deepEqual(h.failures, []);
    await h.cleanup();
});

test("reports authentication rejection with a retry-cooldown category", async () => {
    const h = await connect({
        config: { username: "user", password: "hunter2" },
        reply: (socket) => socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    assert.equal(h.failures[0].code, "AUTH");
    assert.deepEqual(h.accepted, []);
    await h.cleanup();
});

test("never leaks credentials into a failure message", async () => {
    const h = await connect({
        config: { username: "user", password: "hunter2" },
        reply: (socket) => socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    const text = `${h.failures[0].message} ${h.failures[0].stack}`;
    assert.ok(!text.includes("hunter2"), text);
    assert.ok(!text.toLowerCase().includes("authorization"), text);
    assert.ok(!text.includes("dXNlcjpodW50ZXIy"), text);
    await h.cleanup();
});

test("sends Basic authorization when credentials are configured", async () => {
    const h = await connect({
        config: { username: "user", password: "hunter2" },
        reply: rev2Success(),
    });
    await waitFor(() => h.caster.requests.length > 0, "request");

    const expected = Buffer.from("user:hunter2", "utf8").toString("base64");
    assert.match(h.caster.requests[0], new RegExp(`\r\nAuthorization: Basic ${expected}\r\n`));
    await h.cleanup();
});

test("rejects a sourcetable response instead of treating it as a stream", async () => {
    const h = await connect({
        reply: (socket) => socket.write("SOURCETABLE 200 OK\r\nContent-Type: gnss/sourcetable\r\n\r\nSTR;BASE;\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.match(h.failures[0].message, /sourcetable/i);
    assert.deepEqual(h.accepted, []);
    await h.cleanup();
});

test("a sourcetable names the mountpoint and says it may have stopped streaming", async () => {
    // The caster answers this way when a mountpoint is unfed as well as when it
    // is unknown, and for a monitor the first is by far the likelier case.
    const h = await connect({
        reply: (socket) => socket.write("SOURCETABLE 200 OK\r\n\r\nSTR;OTHER;\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    assert.match(h.failures[0].message, /'BASE'/);
    assert.match(h.failures[0].message, /stopped streaming/);
    await h.cleanup();
});

test("rejects a Rev2 sourcetable advertised only by content type", async () => {
    const h = await connect({
        reply: (socket) => socket.write("HTTP/1.1 200 OK\r\nContent-Type: gnss/sourcetable\r\n\r\nSTR;BASE;\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.match(h.failures[0].message, /sourcetable|mountpoint/i);
    await h.cleanup();
});

test("reports a missing mountpoint", async () => {
    const h = await connect({ reply: (socket) => socket.write("HTTP/1.1 404 Not Found\r\n\r\n") });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.match(h.failures[0].message, /not found|mountpoint/i);
    assert.notEqual(h.failures[0].code, "AUTH");
    await h.cleanup();
});

test("reads 406 as a mountpoint with no data source, not a client error", async () => {
    // Observed against a real caster: the base station stopped feeding the
    // mountpoint and the caster answered every request with 406 until it
    // returned. That is the outage this monitor exists to detect.
    const h = await connect({
        reply: (socket) => socket.write("HTTP/1.1 406 Not Acceptable\r\n\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    assert.match(h.failures[0].message, /BASE/);
    assert.match(h.failures[0].message, /no data from its source/);
    assert.deepEqual(h.accepted, []);
    await h.cleanup();
});

test("does not hold a cooldown on 406, so recovery is noticed promptly", async () => {
    const h = await connect({
        reply: (socket) => socket.write("HTTP/1.1 406 Not Acceptable\r\n\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    assert.notEqual(h.failures[0].code, "BUSY");
    assert.notEqual(h.failures[0].code, "AUTH");
    await h.cleanup();
});

test("categorizes every busy status the same way", async () => {
    for (const code of BUSY_STATUS_CODES) {
        const h = await connect({
            reply: (socket) => socket.write(`HTTP/1.1 ${code} Refused\r\n\r\n`),
        });
        await waitFor(() => h.failures.length > 0, `failure for ${code}`);

        assert.equal(h.failures[0].code, "BUSY", `status ${code}`);
        await h.cleanup();
    }
});

test("reports the caster's reason phrase so a refusal can be diagnosed", async () => {
    const h = await connect({
        reply: (socket) => socket.write("HTTP/1.1 409 Maximum connections for this user reached\r\n\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    assert.match(h.failures[0].message, /Maximum connections for this user reached/);
    await h.cleanup();
});

test("reports an explanatory response body alongside the status", async () => {
    const h = await connect({
        reply: (socket) =>
            socket.write("HTTP/1.1 406 Not Acceptable\r\nContent-Type: text/plain\r\n\r\nGGA position outside network"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    assert.match(h.failures[0].message, /GGA position outside network/);
    await h.cleanup();
});

test("collapses and truncates caster text instead of pasting it into the message", async () => {
    const noisy = `line one\r\n\tline two ${"x".repeat(400)}`;
    const h = await connect({
        reply: (socket) => socket.write(`HTTP/1.1 406 Not Acceptable\r\n\r\n${noisy}`),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    const message = h.failures[0].message;
    assert.ok(!/[\r\n\t]/.test(message), message);
    assert.match(message, /\.\.\.$/);

    // The cap applies to the caster's text, not to the whole message, so assert
    // on how much of the 400-character run survived rather than a total length.
    assert.ok(!message.includes("x".repeat(250)), "caster text was not truncated");
    await h.cleanup();
});

test("never leaks credentials through a caster-supplied explanation", async () => {
    const h = await connect({
        config: { username: "user", password: "hunter2" },
        reply: (socket) => socket.write("HTTP/1.1 406 Not Acceptable\r\n\r\nrejected"),
    });
    await waitFor(() => h.failures.length > 0, "failure");

    const text = `${h.failures[0].message} ${h.failures[0].stack}`;
    assert.ok(!text.includes("hunter2"), text);
    assert.ok(!text.includes("dXNlcjpodW50ZXIy"), text);
    await h.cleanup();
});

test("says nothing extra when the caster explains nothing", async () => {
    const h = await connect({ reply: (socket) => socket.write("HTTP/1.1 402 \r\n\r\n") });
    await waitFor(() => h.failures.length > 0, "failure");

    assert.ok(!h.failures[0].message.includes("The caster said"), h.failures[0].message);
    await h.cleanup();
});

test("does not follow redirects", async () => {
    const h = await connect({
        reply: (socket) => socket.write("HTTP/1.1 302 Found\r\nLocation: http://elsewhere.example/BASE\r\n\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.match(h.failures[0].message, /redirect/i);
    assert.deepEqual(h.accepted, []);
    await h.cleanup();
});

test("rejects a malformed status line", async () => {
    const h = await connect({ reply: (socket) => socket.write("NOT-A-STATUS\r\n\r\n") });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.match(h.failures[0].message, /response/i);
    await h.cleanup();
});

test("rejects headers larger than the bound", async () => {
    const h = await connect({
        reply: (socket) => {
            socket.write("HTTP/1.1 200 OK\r\n");
            const filler = `X-Filler: ${"a".repeat(1000)}\r\n`;
            for (let index = 0; index < 20; index++) {
                socket.write(filler);
            }
        },
    });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.match(h.failures[0].message, /header/i);
    await h.cleanup();
});

test("rejects an unsupported content encoding", async () => {
    const h = await connect({
        reply: (socket) => socket.write("HTTP/1.1 200 OK\r\nContent-Encoding: gzip\r\n\r\n"),
    });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.match(h.failures[0].message, /encoding/i);
    await h.cleanup();
});

test("reports the caster closing before it accepts", async () => {
    const h = await connect({ reply: (socket) => socket.destroy() });
    await waitFor(() => h.failures.length > 0, "failure");
    assert.deepEqual(h.accepted, []);
    await h.cleanup();
});

test("reports the caster closing an accepted stream", async () => {
    const h = await connect({
        reply: (socket) => {
            socket.write("HTTP/1.1 200 OK\r\n\r\n");
            setTimeout(() => socket.end(), 10);
        },
    });
    await waitFor(() => h.accepted.length > 0, "acceptance");
    await waitFor(() => h.failures.length > 0, "failure");
    await h.cleanup();
});

test("cancellation before acceptance produces no retryable failure", async () => {
    const h = await connect({ reply: () => {} });
    await waitFor(() => h.caster.requests.length > 0, "request");

    h.abort.abort();
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.deepEqual(h.failures, []);
    assert.deepEqual(h.accepted, []);
    await h.cleanup();
});

test("closing an accepted connection produces no failure", async () => {
    const h = await connect({ reply: rev2Success(frame) });
    await waitFor(() => h.accepted.length > 0, "acceptance");

    h.connection.close();
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.deepEqual(h.failures, []);
    await h.cleanup();
});

test("close is idempotent", async () => {
    const h = await connect({ reply: rev2Success() });
    await waitFor(() => h.accepted.length > 0, "acceptance");
    h.connection.close();
    h.connection.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.deepEqual(h.failures, []);
    await h.cleanup();
});

test("write reaches the caster after acceptance", async () => {
    const h = await connect({ reply: rev2Success() });
    await waitFor(() => h.accepted.length > 0, "acceptance");

    h.connection.write(Buffer.from("$GPGGA,test\r\n", "ascii"));
    await waitFor(() => h.caster.bodies.length > 0, "GGA delivery");

    assert.match(Buffer.concat(h.caster.bodies).toString("ascii"), /\$GPGGA,test/);
    await h.cleanup();
});

test("reports a connection refused to a closed port", async () => {
    const caster = createMockCaster({ reply: () => {} });
    const port = await caster.listen();
    await caster.close();

    const failures = [];
    const connection = openNtripTransport(
        {
            hostname: "127.0.0.1",
            port,
            tls: false,
            mountpoint: "BASE",
            revision: "2",
            username: null,
            password: null,
        },
        {
            signal: new AbortController().signal,
            onAccepted: () => {},
            onData: () => {},
            onFailure: (error) => failures.push(error),
        }
    );

    await waitFor(() => failures.length > 0, "connection failure");
    assert.ok(failures[0] instanceof Error);
    connection.close();
});

test("selects a TLS connection when the monitor enables it", () => {
    const seen = [];
    const connection = openNtripTransport(
        {
            hostname: "caster.example.com",
            port: 2102,
            tls: true,
            mountpoint: "BASE",
            revision: "2",
            username: null,
            password: null,
        },
        {
            signal: new AbortController().signal,
            onAccepted: () => {},
            onData: () => {},
            onFailure: () => {},
        },
        {
            createConnection: (options, useTls) => {
                seen.push({ options, useTls });
                const { PassThrough } = require("stream");
                const socket = new PassThrough();
                socket.setNoDelay = () => {};
                socket.destroy = () => {};
                return socket;
            },
        }
    );

    assert.equal(seen.length, 1);
    assert.equal(seen[0].useTls, true);
    assert.equal(seen[0].options.host, "caster.example.com");
    assert.equal(seen[0].options.port, 2102);
    assert.equal(seen[0].options.servername, "caster.example.com");
    connection.close();
});
