const { describe, test, mock } = require("node:test");
const assert = require("node:assert");
const { encodeBase64 } = require("../../server/util-server");
const { UP, DOWN, PENDING } = require("../../src/util");

describe("GlobalpingMonitorType", () => {
    const { GlobalpingMonitorType } = require("../../server/monitor-types/globalping");

    describe("ping", () => {
        test("should handle successful ping", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createPingMeasurement();
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                hostname: "example.com",
                location: "North America",
                ping_count: 3,
                protocol: "ICMP",
                ipFamily: "ipv4",
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
                ping: 0,
            };

            await monitorType.ping(mockClient, monitor, heartbeat, true);

            assert.strictEqual(mockClient.createMeasurement.mock.calls.length, 1);
            assert.deepStrictEqual(mockClient.createMeasurement.mock.calls[0].arguments[0], {
                type: "ping",
                target: "example.com",
                inProgressUpdates: false,
                limit: 1,
                locations: [{ magic: "North America" }],
                measurementOptions: {
                    packets: 3,
                    protocol: "ICMP",
                    ipVersion: 4,
                },
            });

            assert.deepStrictEqual(heartbeat, {
                status: UP,
                msg: "Ashburn (VA), US, NA, Amazon.com (AS14618), (aws-us-east-1) : OK",
                ping: 2.169,
            });
        });

        test("should handle failed ping with status failed", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createPingMeasurement();
            measurement.results[0].result.status = "failed";
            measurement.results[0].result.rawOutput = "Host unreachable";
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                hostname: "unreachable.example.com",
                location: "Europe",
                ping_count: 3,
                protocol: "ICMP",
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await monitorType.ping(mockClient, monitor, heartbeat, true);

            assert.deepStrictEqual(heartbeat, {
                status: DOWN,
                msg: "Ashburn (VA), US, NA, Amazon.com (AS14618), (aws-us-east-1) : Failed: Host unreachable",
            });
        });

        test("should handle API error on create measurement", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                error: {
                    type: "validation_error",
                    message: "Invalid target",
                    params: { target: "example.com" },
                },
            });
            createResponse.ok = false;
            createResponse.response.status = 400;

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);

            const monitor = {
                hostname: "example.com",
                location: "North America",
                ping_count: 3,
                protocol: "ICMP",
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await assert.rejects(monitorType.ping(mockClient, monitor, heartbeat, true), (error) => {
                assert.deepStrictEqual(
                    error,
                    new Error("Failed to create measurement: validation_error Invalid target.\ntarget: example.com")
                );
                return true;
            });
        });

        test("should handle API error on await measurement", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const awaitResponse = createMockResponse({
                error: {
                    type: "internal_error",
                    message: "Server error",
                },
            });
            awaitResponse.ok = false;
            awaitResponse.response.status = 400;

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                hostname: "example.com",
                location: "North America",
                ping_count: 3,
                protocol: "ICMP",
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await assert.rejects(monitorType.ping(mockClient, monitor, heartbeat, true), (error) => {
                assert.deepStrictEqual(
                    error,
                    new Error("Failed to fetch measurement (2g8T7V3OwXG3JV6Y10011zF2v): internal_error Server error.")
                );
                return true;
            });
        });
    });

    describe("http", () => {
        test("should handle successful HTTP request", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://example.com:444/api/test?test=1",
                location: "North America",
                method: "GET",
                accepted_statuscodes_json: JSON.stringify(["200-299", "300-399"]),
                headers: '{"Test-Header": "Test-Value"}',
                ipFamily: "ipv4",
                dns_resolve_server: "8.8.8.8",
                auth_method: "basic",
                basic_auth_user: "username",
                basic_auth_pass: "password",
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
                ping: 0,
            };

            await monitorType.http(mockClient, monitor, heartbeat, true);

            assert.strictEqual(mockClient.createMeasurement.mock.calls.length, 1);
            const expectedToken = encodeBase64(monitor.basic_auth_user, monitor.basic_auth_pass);
            assert.deepStrictEqual(mockClient.createMeasurement.mock.calls[0].arguments[0], {
                type: "http",
                target: "example.com",
                inProgressUpdates: false,
                limit: 1,
                locations: [{ magic: "North America" }],
                measurementOptions: {
                    request: {
                        host: "example.com",
                        path: "/api/test",
                        query: "test=1",
                        method: "GET",
                        headers: {
                            "Test-Header": "Test-Value",
                            Authorization: `Basic ${expectedToken}`,
                        },
                    },
                    port: 444,
                    protocol: "HTTPS",
                    ipVersion: 4,
                    resolver: "8.8.8.8",
                },
            });

            assert.deepStrictEqual(heartbeat, {
                status: UP,
                msg: "New York (NY), US, NA, MASSIVEGRID (AS49683) : OK",
                ping: 1440,
            });
        });

        test("should handle failed HTTP request", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            measurement.results[0].result.status = "failed";
            measurement.results[0].result.rawOutput = "Host unreachable";
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://example.com",
                location: "North America",
                method: "GET",
                accepted_statuscodes_json: JSON.stringify(["200-299", "300-399"]),
                headers: null,
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await monitorType.http(mockClient, monitor, heartbeat, true);

            assert.deepStrictEqual(heartbeat, {
                status: DOWN,
                msg: "New York (NY), US, NA, MASSIVEGRID (AS49683) : Failed: Host unreachable",
            });
        });

        test("should handle API error on create measurement", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                error: {
                    type: "validation_error",
                    message: "Invalid target",
                    params: { target: "example.com" },
                },
            });
            createResponse.ok = false;
            createResponse.response.status = 400;

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);

            const monitor = {
                url: "https://example.com",
                location: "North America",
                method: "GET",
                accepted_statuscodes_json: JSON.stringify(["200-299", "300-399"]),
                headers: null,
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await assert.rejects(monitorType.http(mockClient, monitor, heartbeat, true), (error) => {
                assert.deepStrictEqual(
                    error,
                    new Error("Failed to create measurement: validation_error Invalid target.\ntarget: example.com")
                );
                return true;
            });
        });

        test("should handle API error on await measurement", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const awaitResponse = createMockResponse({
                error: {
                    type: "internal_error",
                    message: "Server error",
                },
            });
            awaitResponse.ok = false;
            awaitResponse.response.status = 400;

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://example.com",
                location: "North America",
                method: "GET",
                accepted_statuscodes_json: JSON.stringify(["200-299", "300-399"]),
                headers: null,
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await assert.rejects(monitorType.http(mockClient, monitor, heartbeat, true), (error) => {
                assert.deepStrictEqual(
                    error,
                    new Error("Failed to fetch measurement (2g8T7V3OwXG3JV6Y10011zF2v): internal_error Server error.")
                );
                return true;
            });
        });

        test("should handle invalid status code", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            measurement.results[0].result.rawOutput = "RAW OUTPUT";
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://example.com/api/test",
                location: "North America",
                method: "GET",
                accepted_statuscodes_json: JSON.stringify(["200-299"]),
                headers: null,
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
                ping: 0,
            };

            await monitorType.http(mockClient, monitor, heartbeat, true);

            assert.deepStrictEqual(heartbeat, {
                status: DOWN,
                msg: "New York (NY), US, NA, MASSIVEGRID (AS49683) : Status code 301 not accepted. Output: RAW OUTPUT",
                ping: 1440,
            });
        });

        test("should handle keyword check (keyword present)", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            measurement.results[0].result.rawOutput = "Response body with KEYWORD word";
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://example.com",
                location: "North America",
                protocol: "HTTPS",
                accepted_statuscodes_json: JSON.stringify(["300-399"]),
                keyword: "KEYWORD",
                invertKeyword: false,
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await monitorType.http(mockClient, monitor, heartbeat, true);

            assert.deepStrictEqual(heartbeat, {
                status: UP,
                msg: "New York (NY), US, NA, MASSIVEGRID (AS49683) : 301 - Moved Permanently, keyword is found",
                ping: 1440,
            });
        });

        test("should handle keyword check (keyword not present)", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            measurement.results[0].result.rawOutput = "Response body with KEYWORD word";
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://example.com",
                location: "North America",
                protocol: "HTTPS",
                accepted_statuscodes_json: JSON.stringify(["300-399"]),
                keyword: "MISSING_KEYWORD",
                invertKeyword: false,
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await assert.rejects(monitorType.http(mockClient, monitor, heartbeat, true), (error) => {
                assert.deepStrictEqual(
                    error,
                    new Error(
                        "New York (NY), US, NA, MASSIVEGRID (AS49683) : 301 - Moved Permanently, but keyword is not in [Response body with KEYWORD word]"
                    )
                );
                return true;
            });
        });

        test("should handle inverted keyword check", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            measurement.results[0].result.rawOutput = "Response body with KEYWORD word";
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://example.com",
                location: "North America",
                protocol: "HTTPS",
                accepted_statuscodes_json: JSON.stringify(["300-399"]),
                keyword: "ERROR",
                invertKeyword: true,
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await monitorType.http(mockClient, monitor, heartbeat, true);

            assert.deepStrictEqual(heartbeat, {
                status: UP,
                msg: "New York (NY), US, NA, MASSIVEGRID (AS49683) : 301 - Moved Permanently, keyword not found",
                ping: 1440,
            });
        });

        test("should handle JSON query check (valid)", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            measurement.results[0].result.rawOutput = JSON.stringify({
                status: "success",
                value: 42,
            });
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://api.example.com/status",
                location: "North America",
                protocol: "HTTPS",
                accepted_statuscodes_json: JSON.stringify(["300-399"]),
                jsonPath: "$.status",
                jsonPathOperator: "==",
                expectedValue: "success",
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await monitorType.http(mockClient, monitor, heartbeat, true);

            assert.deepStrictEqual(heartbeat, {
                status: UP,
                msg: "New York (NY), US, NA, MASSIVEGRID (AS49683) : JSON query passes (comparing success == success)",
                ping: 1440,
            });
        });

        test("should handle JSON query check (invalid)", async () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");
            const mockClient = createGlobalpingClientMock();
            const createResponse = createMockResponse({
                id: "2g8T7V3OwXG3JV6Y10011zF2v",
            });
            const measurement = createHttpMeasurement();
            measurement.results[0].result.rawOutput = JSON.stringify({
                status: "failed",
                value: 42,
            });
            const awaitResponse = createMockResponse(measurement);

            mockClient.createMeasurement.mock.mockImplementation(() => createResponse);
            mockClient.awaitMeasurement.mock.mockImplementation(() => awaitResponse);

            const monitor = {
                url: "https://api.example.com/status",
                location: "North America",
                protocol: "HTTPS",
                accepted_statuscodes_json: JSON.stringify(["300-399"]),
                jsonPath: "$.status",
                jsonPathOperator: "==",
                expectedValue: "success",
            };

            const heartbeat = {
                status: PENDING,
                msg: "",
            };

            await assert.rejects(monitorType.http(mockClient, monitor, heartbeat, true), (error) => {
                assert.deepStrictEqual(
                    error,
                    new Error(
                        "New York (NY), US, NA, MASSIVEGRID (AS49683) : JSON query does not pass (comparing failed == success)"
                    )
                );
                return true;
            });
        });
    });

    describe("helper methods", () => {
        test("formatProbeLocation should format location correctly", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const probe = {
                city: "New York",
                state: "NY",
                country: "US",
                continent: "NA",
                network: "Amazon.com",
                asn: 14618,
                tags: ["aws-us-east-1", "datacenter"],
            };

            const result = monitorType.formatProbeLocation(probe);

            assert.strictEqual(result, "New York (NY), US, NA, Amazon.com (AS14618), (aws-us-east-1)");
        });

        test("formatProbeLocation should handle missing state", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const probe = {
                city: "London",
                state: null,
                country: "GB",
                continent: "EU",
                network: "Example Network",
                asn: 12345,
                tags: [],
            };

            const result = monitorType.formatProbeLocation(probe);

            assert.strictEqual(result, "London, GB, EU, Example Network (AS12345)");
        });

        test("formatResponse should combine location and text", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const probe = {
                city: "Tokyo",
                state: null,
                country: "JP",
                continent: "AS",
                network: "Example ISP",
                asn: 54321,
                tags: [],
            };

            const result = monitorType.formatResponse(probe, "Test message");

            assert.strictEqual(result, "Tokyo, JP, AS, Example ISP (AS54321) : Test message");
        });

        test("formatApiError should format error with params", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const error = {
                type: "validation_error",
                message: "Invalid request",
                params: {
                    field: "target",
                    value: "invalid",
                },
            };

            const result = monitorType.formatApiError(error);

            assert.strictEqual(result, "validation_error Invalid request.\nfield: target\nvalue: invalid");
        });

        test("formatApiError should format error without params", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const error = {
                type: "internal_error",
                message: "Server error",
            };

            const result = monitorType.formatApiError(error);

            assert.strictEqual(result, "internal_error Server error.");
        });

        test("formatTooManyRequestsError with API token", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const result = monitorType.formatTooManyRequestsError(true);

            assert.strictEqual(
                result,
                "You have run out of credits. Get higher limits by sponsoring us or hosting probes. Learn more at https://dash.globalping.io?view=add-credits."
            );
        });

        test("formatTooManyRequestsError without API token", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const result = monitorType.formatTooManyRequestsError(false);

            assert.strictEqual(
                result,
                "You have run out of credits. Get higher limits by creating an account. Sign up at https://dash.globalping.io?view=add-credits."
            );
        });

        test("getBasicAuthHeader should return empty for non-basic auth", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const monitor = {
                auth_method: "none",
            };

            const result = monitorType.getBasicAuthHeader(monitor);

            assert.deepStrictEqual(result, {});
        });

        test("getBasicAuthHeader should return Authorization header", () => {
            const monitorType = new GlobalpingMonitorType("test-agent/1.0");

            const monitor = {
                auth_method: "basic",
                basic_auth_user: "testuser",
                basic_auth_pass: "testpass",
            };

            const result = monitorType.getBasicAuthHeader(monitor);

            const expectedToken = encodeBase64(monitor.basic_auth_user, monitor.basic_auth_pass);

            assert.strictEqual(result.Authorization, `Basic ${expectedToken}`);
        });
    });
});

/**
 * Reusable mock factory for Globalping client
 * @returns {object} Mocked Globalping client
 */
function createGlobalpingClientMock() {
    return {
        createMeasurement: mock.fn(),
        awaitMeasurement: mock.fn(),
    };
}

/**
 * Reusable mock factory for Globalping response
 * @param {object} data Response data
 * @returns {object} Mocked Globalping response
 */
function createMockResponse(data) {
    return {
        ok: true,
        response: {
            status: 200,
        },
        data,
    };
}

/**
 * Creates a successful ping measurement response
 * @returns {object} Mock measurement response
 */
function createPingMeasurement() {
    return {
        id: "2g8T7V3OwXG3JV6Y10011zF2v",
        type: "ping",
        status: "finished",
        createdAt: "2025-11-05T08:25:33.173Z",
        updatedAt: "2025-11-05T08:25:34.750Z",
        target: "google.com",
        probesCount: 1,
        locations: [{ magic: "us-east-1" }],
        results: [
            {
                probe: {
                    continent: "NA",
                    region: "Northern America",
                    country: "US",
                    state: "VA",
                    city: "Ashburn",
                    asn: 14618,
                    longitude: -77.49,
                    latitude: 39.04,
                    network: "Amazon.com",
                    tags: [
                        "aws-us-east-1",
                        "aws",
                        "datacenter-network",
                        "u-cloudlookingglass:aws-us-east-1-use1-az6",
                        "u-cloudlookingglass:aws-us-east-1-use1-az6-net",
                    ],
                    resolvers: ["private"],
                },
                result: {
                    status: "finished",
                    rawOutput:
                        "PING  (142.251.16.100) 56(84) bytes of data.\n64 bytes from bl-in-f100.1e100.net (142.251.16.100): icmp_seq=1 ttl=106 time=2.07 ms\n64 bytes from bl-in-f100.1e100.net (142.251.16.100): icmp_seq=2 ttl=106 time=2.08 ms\n64 bytes from bl-in-f100.1e100.net (142.251.16.100): icmp_seq=3 ttl=106 time=2.35 ms\n\n---  ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss, time 1002ms\nrtt min/avg/max/mdev = 2.073/2.169/2.351/0.128 ms",
                    resolvedAddress: "142.251.16.100",
                    resolvedHostname: "bl-in-f100.1e100.net",
                    timings: [
                        { ttl: 106, rtt: 2.07 },
                        { ttl: 106, rtt: 2.08 },
                        { ttl: 106, rtt: 2.35 },
                    ],
                    stats: {
                        min: 2.073,
                        max: 2.351,
                        avg: 2.169,
                        total: 3,
                        loss: 0,
                        rcv: 3,
                        drop: 0,
                    },
                },
            },
        ],
    };
}

/**
 * Creates a successful HTTP measurement response
 * @returns {object} Mock measurement response
 */
function createHttpMeasurement() {
    return {
        id: "2m6DeD067jeT6licX0011zF2x",
        type: "http",
        status: "finished",
        createdAt: "2025-11-05T08:27:29.034Z",
        updatedAt: "2025-11-05T08:27:30.718Z",
        target: "google.com",
        probesCount: 1,
        locations: [{ magic: "New York" }],
        results: [
            {
                probe: {
                    continent: "NA",
                    region: "Northern America",
                    country: "US",
                    state: "NY",
                    city: "New York",
                    asn: 49683,
                    longitude: -74.01,
                    latitude: 40.71,
                    network: "MASSIVEGRID",
                    tags: ["datacenter-network", "u-gbzret4d"],
                    resolvers: ["private"],
                },
                result: {
                    status: "finished",
                    resolvedAddress: "209.85.201.101",
                    headers: {
                        location: "https://www.google.com/",
                        "content-type": "text/html; charset=UTF-8",
                        "content-security-policy-report-only":
                            "object-src 'none';base-uri 'self';script-src 'nonce-Eft2LKpM01f69RvQoV6QJA' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp",
                        date: "Wed, 05 Nov 2025 08:27:30 GMT",
                        expires: "Fri, 05 Dec 2025 08:27:30 GMT",
                        "cache-control": "public, max-age=2592000",
                        server: "gws",
                        "content-length": "220",
                        "x-xss-protection": "0",
                        "x-frame-options": "SAMEORIGIN",
                        "alt-svc": 'h3=":443"; ma=2592000,h3-29=":443"; ma=2592000',
                        connection: "close",
                    },
                    rawHeaders:
                        "Location: https://www.google.com/\nContent-Type: text/html; charset=UTF-8\nContent-Security-Policy-Report-Only: object-src 'none';base-uri 'self';script-src 'nonce-Eft2LKpM01f69RvQoV6QJA' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp\nDate: Wed, 05 Nov 2025 08:27:30 GMT\nExpires: Fri, 05 Dec 2025 08:27:30 GMT\nCache-Control: public, max-age=2592000\nServer: gws\nContent-Length: 220\nX-XSS-Protection: 0\nX-Frame-Options: SAMEORIGIN\nAlt-Svc: h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000\nConnection: close",
                    rawBody: null,
                    rawOutput:
                        "HTTP/1.1 301\nLocation: https://www.google.com/\nContent-Type: text/html; charset=UTF-8\nContent-Security-Policy-Report-Only: object-src 'none';base-uri 'self';script-src 'nonce-Eft2LKpM01f69RvQoV6QJA' 'strict-dynamic' 'report-sample' 'unsafe-eval' 'unsafe-inline' https: http:;report-uri https://csp.withgoogle.com/csp/gws/other-hp\nDate: Wed, 05 Nov 2025 08:27:30 GMT\nExpires: Fri, 05 Dec 2025 08:27:30 GMT\nCache-Control: public, max-age=2592000\nServer: gws\nContent-Length: 220\nX-XSS-Protection: 0\nX-Frame-Options: SAMEORIGIN\nAlt-Svc: h3=\":443\"; ma=2592000,h3-29=\":443\"; ma=2592000\nConnection: close",
                    truncated: false,
                    statusCode: 301,
                    statusCodeName: "Moved Permanently",
                    timings: {
                        total: 1440,
                        download: 1,
                        firstByte: 1391,
                        dns: 9,
                        tls: 22,
                        tcp: 16,
                    },
                },
            },
        ],
    };
}
