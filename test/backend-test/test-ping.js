const { describe, test } = require("node:test");
const assert = require("node:assert");
const cp = require("node:child_process");
const os = require("node:os");
const { EventEmitter } = require("node:events");
const iconv = require("iconv-lite");
const ping = require("../../server/modules/ping");
const { convertToUTF8, getWindowsCodepage, toEncodingName } = require("../../server/modules/ping/lib/encoding");
const { pingAsync } = require("../../server/monitor-types/ping");

// "Request timed out." as printed by ping.exe, per Windows console (OEM) codepage.
// cp864 is left out because iconv-lite has no Arabic letters for it.
const WINDOWS_OEM_CODEPAGES = [
    { cp: "cp437", language: "en-US", text: "Request timed out." },
    { cp: "cp720", language: "ar-EG", text: "انتهت مهلة الطلب." },
    { cp: "cp737", language: "el-GR", text: "Λήξη χρονικού ορίου αιτήματος." },
    { cp: "cp775", language: "lv-LV", text: "Pieprasījuma taimauts." },
    { cp: "cp850", language: "de-DE", text: "Zeitüberschreitung der Anforderung." },
    { cp: "cp852", language: "cs-CZ", text: "Vypršel časový limit." },
    { cp: "cp855", language: "bg-BG", text: "Изтече времето за изчакване на заявката." },
    { cp: "cp857", language: "tr-TR", text: "İstek zaman aşımına uğradı." },
    { cp: "cp858", language: "fr-FR", text: "Délai d'attente dépassé." },
    { cp: "cp860", language: "pt-PT", text: "O pedido excedeu o tempo limite." },
    { cp: "cp861", language: "is-IS", text: "Beiðni rann út á tíma." },
    { cp: "cp862", language: "he-IL", text: "פסק זמן של הבקשה." },
    { cp: "cp863", language: "fr-CA", text: "Délai d'attente dépassé." },
    { cp: "cp865", language: "sv-SE", text: "Tidsgränsen överskreds." },
    { cp: "cp866", language: "ru-RU", text: "Превышен интервал ожидания для запроса." },
    { cp: "cp869", language: "el-GR", text: "Λήξη χρονικού ορίου αιτήματος." },
    { cp: "cp874", language: "th-TH", text: "คำขอหมดเวลา" },
    { cp: "cp932", language: "ja-JP", text: "要求がタイムアウトしました。" },
    { cp: "cp936", language: "zh-CN", text: "请求超时。" },
    { cp: "cp949", language: "ko-KR", text: "요청 시간이 만료되었습니다." },
    { cp: "cp950", language: "zh-TW", text: "要求逾時。" },
];

describe("Monitor Type: ping", () => {
    test("should convert IDN domains to Punycode before pinging", async () => {
        const idnDomain = "münchen.de";
        const punycodeDomain = "xn--mnchen-3ya.de";

        await assert.rejects(pingAsync(idnDomain, false, 1, "", true, 56, 1, 1), (err) => {
            if (err.message.includes("Parameter string not correctly encoded")) {
                assert.fail("Ping failed with encoding error: IDN was not converted");
            }
            assert.ok(
                err.message.includes(punycodeDomain),
                `Error message should contain the Punycode domain "${punycodeDomain}". Got: ${err.message}`
            );
            return true;
        });
    });

    test("should strip brackets from IPv6 addresses before pinging", async () => {
        const ipv6WithBrackets = "[2606:4700:4700::1111]";
        const ipv6Raw = "2606:4700:4700::1111";

        await assert.rejects(pingAsync(ipv6WithBrackets, true, 1, "", true, 56, 1, 1), (err) => {
            assert.strictEqual(
                err.message.includes(ipv6WithBrackets),
                false,
                "Error message should not contain brackets"
            );
            // Allow either the IP in the message (local) OR "Network is unreachable"
            const containsIP = err.message.includes(ipv6Raw);
            const isUnreachable =
                err.message.includes("Network is unreachable") || err.message.includes("Network unreachable");
            // macOS error when IPv6 stack is missing
            const isMacOSError = err.message.includes("nodename nor servname provided");
            assert.ok(
                containsIP || isUnreachable || isMacOSError,
                `Ping failed correctly, but error message format was unexpected.\nGot: "${err.message}"\nExpected to contain IP "${ipv6Raw}" OR be a standard network error.`
            );
            return true;
        });
    });

    test("should handle standard ASCII domains correctly", async () => {
        const domain = "invalid-domain.test";
        await assert.rejects(pingAsync(domain, false, 1, "", true, 56, 1, 1), (err) => {
            assert.strictEqual(err.message.includes("Parameter string not correctly encoded"), false);
            assert.ok(
                err.message.includes(domain),
                `Error message should contain the domain "${domain}". Got: ${err.message}`
            );
            return true;
        });
    });
});

describe("Ping output encoding on Windows", () => {
    test("decodes raw ping output for every Windows OEM codepage", () => {
        const failed = failingLanguages(({ cp, text }) => convertToUTF8(iconv.encode(text, cp), "win32", cp));

        assert.deepStrictEqual(failed, [], `not decoded: ${failed.join(", ")}`);
    });

    test("keeps ping output bytes intact through the ping library", async () => {
        // The ping module must hand the raw bytes to the decoder, not `String(data)`.
        const text = "要求がタイムアウトしました。";
        const output = Buffer.from(text, "utf8");
        // Split inside a character, which a per-chunk `String(data)` would break
        const split = output.findIndex((byte) => (byte & 0xc0) === 0x80);
        const header = Buffer.from("PING 127.0.0.1 (127.0.0.1): 32 data bytes\n");
        const res = await probeFakePing([header, output.subarray(0, split), output.subarray(split)], "linux");

        assert.ok(res.output.includes(text), `lost before decoding: ${JSON.stringify(res.output)}`);
    });

    test("maps the UTF-8 console codepage", () => {
        assert.strictEqual(toEncodingName("65001"), "utf8");
        assert.strictEqual(toEncodingName("936"), "cp936");
    });

    test("decodes UTF-8 ping output when the console codepage is UTF-8", () => {
        const text = "要求がタイムアウトしました。";

        assert.strictEqual(convertToUTF8(Buffer.from(text, "utf8"), "win32", "utf8"), text);
    });

    test("decodes with the host console codepage", { skip: process.platform !== "win32" }, async () => {
        const codepage = getWindowsCodepage();
        const fixture = WINDOWS_OEM_CODEPAGES.find((item) => item.cp === codepage);
        if (!fixture) {
            return;
        }
        const header = Buffer.from("PING 127.0.0.1 (127.0.0.1): 32 data bytes\n");
        const res = await probeFakePing([header, iconv.encode(fixture.text, fixture.cp)], "win32");

        assert.ok(res.output.includes(fixture.text), `lost on ${codepage}: ${JSON.stringify(res.output)}`);
    });
});

/**
 * Run a check over every codepage and report the ones that fail.
 * @param {Function} check called with each fixture, returns the decoded text
 * @returns {string[]} languages that did not round-trip
 */
function failingLanguages(check) {
    const failed = [];
    for (const fixture of WINDOWS_OEM_CODEPAGES) {
        let decoded;
        try {
            decoded = check(fixture);
        } catch (e) {
            decoded = e.message;
        }
        if (decoded !== fixture.text) {
            failed.push(`${fixture.language}/${fixture.cp}`);
        }
    }
    return failed;
}

/**
 * Run the ping module against fake ping output instead of a real ping process
 * @param {Buffer[]} chunks Bytes the fake ping writes, one array item per chunk
 * @param {string} platform Platform name to report, as os.platform() would
 * @returns {Promise<object>} Parsed ping response
 */
async function probeFakePing(chunks, platform) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    const realSpawn = cp.spawn;
    const realPlatform = os.platform;
    cp.spawn = () => {
        setImmediate(() => {
            for (const chunk of chunks) {
                child.stdout.emit("data", chunk);
            }
            child.emit("close", 0);
        });
        return child;
    };
    os.platform = () => platform;
    try {
        return await ping.promise.probe("127.0.0.1", { min_reply: 1 });
    } finally {
        cp.spawn = realSpawn;
        os.platform = realPlatform;
    }
}
