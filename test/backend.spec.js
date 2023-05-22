const { genSecret, DOWN, log} = require("../src/util");
const utilServerRewire = require("../server/util-server");
const Discord = require("../server/notification-providers/discord");
const axios = require("axios");
const { UptimeKumaServer } = require("../server/uptime-kuma-server");
const Database = require("../server/database");
const {Settings} = require("../server/settings");
const fs = require("fs");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
dayjs.extend(require("dayjs/plugin/timezone"));

jest.mock("axios");

describe("Test parseCertificateInfo", () => {
    it("should handle undefined", async () => {
        const parseCertificateInfo = utilServerRewire.__get__("parseCertificateInfo");
        const info = parseCertificateInfo(undefined);
        expect(info).toEqual(undefined);
    }, 5000);

    it("should handle normal cert chain", async () => {
        const parseCertificateInfo = utilServerRewire.__get__("parseCertificateInfo");

        const chain1 = {
            fingerprint: "CF:2C:F3:6A:FE:6B:10:EC:44:77:C8:95:BB:96:2E:06:1F:0E:15:DA",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain2 = {
            fingerprint: "A0:31:C4:67:82:E6:E6:C6:62:C2:C8:7C:76:DA:9A:A6:2C:CA:BD:8E",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain3 = {
            fingerprint: "5F:B7:EE:06:33:E2:59:DB:AD:0C:4C:9A:E6:D3:8F:1A:61:C7:DC:25",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        chain1.issuerCertificate = chain2;
        chain2.issuerCertificate = chain3;
        chain3.issuerCertificate = chain3;

        const info = parseCertificateInfo(chain1);
        expect(chain1).toEqual(info);
    }, 5000);

    it("should handle cert chain with strange circle", async () => {
        const parseCertificateInfo = utilServerRewire.__get__("parseCertificateInfo");

        const chain1 = {
            fingerprint: "CF:2C:F3:6A:FE:6B:10:EC:44:77:C8:95:BB:96:2E:06:1F:0E:15:DA",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain2 = {
            fingerprint: "A0:31:C4:67:82:E6:E6:C6:62:C2:C8:7C:76:DA:9A:A6:2C:CA:BD:8E",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain3 = {
            fingerprint: "5F:B7:EE:06:33:E2:59:DB:AD:0C:4C:9A:E6:D3:8F:1A:61:C7:DC:25",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain4 = {
            fingerprint: "haha",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        chain1.issuerCertificate = chain2;
        chain2.issuerCertificate = chain3;
        chain3.issuerCertificate = chain4;
        chain4.issuerCertificate = chain2;

        const info = parseCertificateInfo(chain1);
        expect(chain1).toEqual(info);
    }, 5000);

    it("should handle cert chain with last undefined (should be happen in real, but just in case)", async () => {
        const parseCertificateInfo = utilServerRewire.__get__("parseCertificateInfo");

        const chain1 = {
            fingerprint: "CF:2C:F3:6A:FE:6B:10:EC:44:77:C8:95:BB:96:2E:06:1F:0E:15:DA",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain2 = {
            fingerprint: "A0:31:C4:67:82:E6:E6:C6:62:C2:C8:7C:76:DA:9A:A6:2C:CA:BD:8E",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain3 = {
            fingerprint: "5F:B7:EE:06:33:E2:59:DB:AD:0C:4C:9A:E6:D3:8F:1A:61:C7:DC:25",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        const chain4 = {
            fingerprint: "haha",
            valid_from: "Oct 22 12:00:00 2013 GMT",
            valid_to: "Oct 22 12:00:00 2028 GMT",
            subjectaltname: "DNS:www.example.org, DNS:example.com, DNS:example.edu, DNS:example.net, DNS:example.org, DNS:www.example.com, DNS:www.example.edu, DNS:www.example.net",
        };

        chain1.issuerCertificate = chain2;
        chain2.issuerCertificate = chain3;
        chain3.issuerCertificate = chain4;
        chain4.issuerCertificate = undefined;

        const info = parseCertificateInfo(chain1);
        expect(chain1).toEqual(info);
    }, 5000);
});

describe("Test genSecret", () => {

    beforeAll(() => {

    });

    it("should be correct length", () => {
        let secret = genSecret(-1);
        expect(secret).toEqual("");

        secret = genSecret(0);
        expect(secret).toEqual("");

        secret = genSecret(1);
        expect(secret.length).toEqual(1);

        secret = genSecret(2);
        expect(secret.length).toEqual(2);

        secret = genSecret(64);
        expect(secret.length).toEqual(64);

        secret = genSecret(9000);
        expect(secret.length).toEqual(9000);

        secret = genSecret(90000);
        expect(secret.length).toEqual(90000);
    });

    it("should contain first and last possible chars", () => {
        let secret = genSecret(90000);
        expect(secret).toContain("A");
        expect(secret).toContain("9");
    });
});

describe("Test reset-password", () => {
    it("should able to run", async () => {
        await require("../extra/reset-password").main();
    }, 120000);
});

describe("Test Discord Notification Provider", () => {
    const hostname = "discord.com";
    const port = 1337;

    const sendNotification = async (hostname, port, type) => {
        const discordProvider = new Discord();

        axios.post.mockResolvedValue({});

        await discordProvider.send(
            {
                discordUsername: "Uptime Kuma",
                discordWebhookUrl: "https://discord.com",
            },
            "test message",
            {
                type,
                hostname,
                port,
            },
            {
                status: DOWN,
            }
        );
    };

    it("should send hostname for ping monitors", async () => {
        await sendNotification(hostname, null, "ping");
        expect(axios.post.mock.lastCall[1].embeds[0].fields[1].value).toBe(hostname);
    });

    it.each([ "dns", "port", "steam" ])("should send hostname for %p monitors", async (type) => {
        await sendNotification(hostname, port, type);
        expect(axios.post.mock.lastCall[1].embeds[0].fields[1].value).toBe(`${hostname}:${port}`);
    });
});

describe("The function filterAndJoin", () => {
    it("should join and array of strings to one string", () => {
        const result = utilServerRewire.filterAndJoin([ "one", "two", "three" ]);
        expect(result).toBe("onetwothree");
    });

    it("should join strings using a given connector", () => {
        const result = utilServerRewire.filterAndJoin([ "one", "two", "three" ], "-");
        expect(result).toBe("one-two-three");
    });

    it("should filter null, undefined and empty strings before joining", () => {
        const result = utilServerRewire.filterAndJoin([ undefined, "", "three" ], "--");
        expect(result).toBe("three");
    });

    it("should return an empty string if all parts are filtered out", () => {
        const result = utilServerRewire.filterAndJoin([ undefined, "", "" ], "--");
        expect(result).toBe("");
    });
});

describe("Test uptimeKumaServer.getClientIP()", () => {
    it("should able to get a correct client IP", async () => {
        Database.init({
            "data-dir": "./data/test"
        });

        if (! fs.existsSync(Database.path)) {
            log.info("server", "Copying Database");
            fs.copyFileSync(Database.templatePath, Database.path);
        }

        await Database.connect(true);
        await Database.patch();

        const fakeSocket = {
            client: {
                conn: {
                    remoteAddress: "192.168.10.10",
                    request: {
                        headers: {
                        }
                    }
                }
            }
        }
        const server = Object.create(UptimeKumaServer.prototype);
        let ip = await server.getClientIP(fakeSocket);

        await Settings.set("trustProxy", false);
        expect(await Settings.get("trustProxy")).toBe(false);
        expect(ip).toBe("192.168.10.10");

        fakeSocket.client.conn.request.headers["x-forwarded-for"] = "10.10.10.10";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("192.168.10.10");

        fakeSocket.client.conn.request.headers["x-real-ip"] = "20.20.20.20";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("192.168.10.10");

        await Settings.set("trustProxy", true);
        expect(await Settings.get("trustProxy")).toBe(true);

        fakeSocket.client.conn.request.headers["x-forwarded-for"] = "10.10.10.10";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("10.10.10.10");

        // x-real-ip
        delete fakeSocket.client.conn.request.headers["x-forwarded-for"];
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("20.20.20.20");

        fakeSocket.client.conn.request.headers["x-forwarded-for"] = "2001:db8:85a3:8d3:1319:8a2e:370:7348";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("2001:db8:85a3:8d3:1319:8a2e:370:7348");

        fakeSocket.client.conn.request.headers["x-forwarded-for"] = "203.0.113.195";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("203.0.113.195");

        fakeSocket.client.conn.request.headers["x-forwarded-for"] = "203.0.113.195, 2001:db8:85a3:8d3:1319:8a2e:370:7348";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("203.0.113.195");

        fakeSocket.client.conn.request.headers["x-forwarded-for"] = "203.0.113.195,2001:db8:85a3:8d3:1319:8a2e:370:7348,150.172.238.178";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("203.0.113.195");

        // Elements are comma-separated, with optional whitespace surrounding the commas.
        fakeSocket.client.conn.request.headers["x-forwarded-for"] = "203.0.113.195 , 2001:db8:85a3:8d3:1319:8a2e:370:7348,150.172.238.178";
        ip = await server.getClientIP(fakeSocket);
        expect(ip).toBe("203.0.113.195");

        await Database.close();
    }, 120000);
});
