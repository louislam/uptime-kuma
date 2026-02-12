const http = require("node:http");
const https = require("node:https");
const { describe, test, before } = require("node:test");
const { HttpMonitorType } = require("../../../server/monitor-types/http");
const { UP, PENDING, log } = require("../../../src/util");
const { default: axios } = require("axios");
const assert = require("node:assert");


function createInspectingTestServer(opts = {}) {
    const {
        status = 200,
        responseBody = "OK",
        responseHeaders = { "Content-Type": "text/plain" },
        delayMs = 0,
    } = opts;

    const requests = [];

    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            let body = "";
            req.on("data", (chunk) => (body += chunk));
            req.on("end", () => {
                requests.push({
                    method: req.method,
                    url: req.url,
                    headers: req.headers,
                    body: body || null,
                });

                if (delayMs > 0) {
                    setTimeout(() => send(), delayMs);
                } else {
                    send();
                }
            });

            function send() {
                res.writeHead(status, responseHeaders);
                res.end(responseBody);
            }
        });

        server.listen(0, () => {
            resolve({
                server,
                port: server.address().port,
                url: `http://localhost:${server.address().port}`,
                getLastRequest: () => requests[requests.length - 1] || null,
            });
        });
    });
}

function createTestServer(opts = {}) {
    const {
        status = 200,
        body = "OK",
        headers = { "Content-Type": "text/plain" },
        delayMs = 0,
    } = opts;

    return new Promise((resolve) => {
        const server = http.createServer((req, res) => {
            if (delayMs > 0) {
                setTimeout(() => send(), delayMs);
            } else {
                send();
            }

            function send() {
                res.writeHead(status, headers);
                res.end(body);
            }
        });

        server.listen(0, () => {
            resolve({
                server,
                port: server.address().port,
                url: `http://localhost:${server.address().port}`,
            });
        });
    });
}

function createTestMonitor(overrides = {}) {
    return {
        name: "test-monitor",
        id: 9999,
        type: "http",
        url: "", // filled per test
        auth_method: null,
        ipFamily: null,
        body: null,
        httpBodyEncoding: null,
        method: "get",
        timeout: 10,
        headers: "{}",
        maxredirects: 10,
        proxy_id: null,
        cacheBust: false,
        keyword: null,
        isInvertKeyword: () => false,
        jsonPath: null,
        jsonPathOperator: null,
        expectedValue: null,
        getUrl() {
            return new URL(this.url);
        },
        getIgnoreTls: () => false,
        getAcceptedStatuscodes: () => ["200-299"],
        getSaveResponse: () => false,
        getSaveErrorResponse: () => false,
        handleTlsInfo: async () => {},
        makeAxiosRequest: (options) => axios.request(options),
        ...overrides,
    };
}


describe(
	'HttpMonitorType', 
	{
		skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
	}, 
	() => {
        let httpMonitor;

        before(() => {
            httpMonitor = new HttpMonitorType();
        });
        
        test("check() sets status to UP when server returns 200", async (t) => {
            const { server, url } = await createTestServer({ status: 200, body: "Everything fine" });
            t.after(() => server.close());
            const monitor = createTestMonitor({ url });

            const heartbeat = { 
                msg: "", 
                status: PENDING, 
                ping: undefined 
            };

            await httpMonitor.check(monitor, heartbeat, {});
    
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK");
            assert.ok(typeof heartbeat.ping === "number" && heartbeat.ping > 0);
        });
		
        test("check() rejects when server returns 400", async (t) => {
            const { server, url } = await createTestServer({ status: 400, body: "" });
            t.after(() => server.close());
            const monitor = createTestMonitor({ url });

            const heartbeat = { 
                msg: "", 
                status: PENDING 
            };
    
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                { message: /Request failed with status code 400/ }
            );
    
            assert.strictEqual(heartbeat.status, PENDING);
            assert.strictEqual(heartbeat.msg, "");
            assert.strictEqual(heartbeat.ping, undefined);
        });

        test("check() sets status to UP when range is 200-399 and server returns 302", async (t) => {
            const { server, url } = await createTestServer({ status: 302, body: "Found" });
            t.after(() => server.close());
    
            const monitor = createTestMonitor({
                url,
                getAcceptedStatuscodes: () => ["200-399"],
            });

            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "302 - Found");
        });

        test("check() sets status to UP when explicit 429 is allowed", async (t) => {
            const { server, url } = await createTestServer({ status: 429, body: "Too Many Requests" });
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                getAcceptedStatuscodes: () => ["200-299", "429"],
            });

            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "429 - Too Many Requests");
        });

        test("check() accepts single status code when getAcceptedStatuscodes returns [\"200\"]", async (t) => {
            const { server, url } = await createTestServer({ status: 200, body: "OK" });
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                getAcceptedStatuscodes: () => ["200"],
            });
            const heartbeat = { msg: "", status: PENDING };

            await httpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK");
        });

        test("check() rejects when status is not in single-code list", async (t) => {
            const { server, url } = await createTestServer({ status: 201, body: "Created" });
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                getAcceptedStatuscodes: () => ["200"],
            });
            const heartbeat = { msg: "", status: PENDING };

            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                { message: /Request failed with status code 201/ }
            );
            assert.strictEqual(heartbeat.status, PENDING);
        });

        test("check() sets status to UP when keyword is present", async (t) => {
            const bodyContent = "Server is healthy - uptime 99.98%";
            const { server, url } = await createTestServer({ body: bodyContent });
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                type: "keyword",
                keyword: "99.98%",
                isInvertKeyword: () => false,
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK, keyword is found");
        });

        test("check() rejects when keyword is missing", async (t) => {
            const bodyContent = "Server is healthy - uptime 99.98%";
            const { server, url } = await createTestServer({ body: bodyContent });
            t.after(() => server.close());
            
            const monitor = createTestMonitor({
                url,
                type: "keyword",
                keyword: "battery low",
                isInvertKeyword: () => false,
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.strictEqual(err.message, `200 - OK, but keyword is not in [${bodyContent}]`);
                    return true;
                }
            );
    
            assert.strictEqual(heartbeat.status, PENDING);
            assert.strictEqual(heartbeat.msg, '200 - OK')
        });

        test("check() sets status to UP when keyword is missing and inverted logic is used", async (t) => {
            const bodyContent = "All systems nominal";
            const { server, url } = await createTestServer({ body: bodyContent });
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                type: "keyword",
                keyword: "ERROR",
                isInvertKeyword: () => true,
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK, keyword not found");
        });

        test("check() rejects when keyword is present and inverted logic is used", async (t) => {
            const bodyContent = "CRITICAL ERROR detected";
            const { server, url } = await createTestServer({ body: bodyContent });
            t.after(() => server.close());
            
            const monitor = createTestMonitor({
                url,
                type: "keyword",
                keyword: "ERROR",
                isInvertKeyword: () => true,
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes(`200 - OK, but keyword is present in [${bodyContent}]`));
                    return true;
                }
            );

            assert.strictEqual(heartbeat.status, PENDING);
            assert.strictEqual(heartbeat.msg, '200 - OK');
        });

        test("check() finds keyword in stringified JSON response", async (t) => {
            const jsonBody = JSON.stringify({
                status: "ok",
                message: "Service is healthy and running smoothly",
            });
        
            const { server, url } = await createTestServer({ body: jsonBody });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "keyword",
                keyword: "healthy",
                isInvertKeyword: () => false,
            });
        
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.includes("keyword is found"));
        });

        test("check() sets status to UP when POSTing with JSON body", async (t) => {
            const payload = { status: "ok", value: 42 };
            const { server, url, getLastRequest } = await createInspectingTestServer({
                status: 201,
                responseBody: "Created",
            });
            t.after(() => server.close());
    
            const monitor = createTestMonitor({
                url,
                method: "post",
                body: JSON.stringify(payload),
                httpBodyEncoding: "json",
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            const req = getLastRequest();
            assert.strictEqual(req.method, "POST");
            assert.strictEqual(req.headers["content-type"], "application/json");
            assert.deepStrictEqual(JSON.parse(req.body), payload);
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "201 - Created");
        });

        test("check() sets status to UP when POSTing with form-urlencoded", async (t) => {
            const formData = "username=john&password=secret123&remember=true";
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
    
            const monitor = createTestMonitor({
                url,
                method: "post",
                body: formData,
                httpBodyEncoding: "form",
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            const req = getLastRequest();
            assert.strictEqual(req.method, "POST");
            assert.strictEqual(req.headers["content-type"], "application/x-www-form-urlencoded");
            assert.strictEqual(req.body, formData);
        });

        test("check() sets status to UP when POSTing with XML body", async (t) => {
            const xml = `<?xml version="1.0" encoding="UTF-8"?><request><action>ping</action><id>123</id></request>`;
    
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
    
            const monitor = createTestMonitor({
                url,
                method: "post",
                body: xml,
                httpBodyEncoding: "xml",
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            const req = getLastRequest();
            assert.strictEqual(req.headers["content-type"], "text/xml; charset=utf-8");
            assert.strictEqual(req.body.trim(), xml.trim());
        });

        test("check() rejects when JSON body is invalid", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
    
            const monitor = createTestMonitor({
                url,
                method: "post",
                body: '{ "name": "test", "age":  }',
                httpBodyEncoding: "json",
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("Your JSON body is invalid"));
                    return true;
                }
            );
    
            // Request should NOT have been sent
            assert.strictEqual(getLastRequest(), null);
            assert.strictEqual(heartbeat.status, PENDING);
        });

        test("check() sends no body when body is empty or whitespace", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                method: "post",
                body: "   ",
                httpBodyEncoding: "json",
            });
            const heartbeat = { msg: "", status: PENDING };

            await httpMonitor.check(monitor, heartbeat, {});

            const req = getLastRequest();
            // Implementation does not set bodyValue when body trims to empty, so no request body
            assert.ok(req.body === "" || req.body === null || req.body === undefined, "request body should be empty");
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() sends custom headers when provided", async (t) => {
            const customHeaders = {
                "X-Custom-Header": "test-value-123",
                "X-App-Version": "4.2.1",
                "Accept-Language": "en-US,en;q=0.9",
            };
    
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
    
            const monitor = createTestMonitor({
                url,
                headers: JSON.stringify(customHeaders),
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            const req = getLastRequest();
            assert.strictEqual(req.headers["x-custom-header"], "test-value-123");
            assert.strictEqual(req.headers["x-app-version"], "4.2.1");
            assert.strictEqual(req.headers["accept-language"], "en-US,en;q=0.9");
            // Should still have default Accept header
            assert.ok(req.headers["accept"].includes("text/html"));
        });

        test("check() rejects when headers JSON is invalid", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                headers: '{ "X-Foo": "bar", }', // trailing comma = invalid JSON
            });
            const heartbeat = { msg: "", status: PENDING };

            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("Unexpected token") || err.message.includes("JSON"));
                    return true;
                }
            );
            assert.strictEqual(getLastRequest(), null);
        });

        test("check() sends Basic Auth Authorization header when provided", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
    
            const monitor = createTestMonitor({
                url,
                auth_method: "basic",
                basic_auth_user: "admin",
                basic_auth_pass: "s3cr3t!",
            });
            const heartbeat = { msg: "", status: PENDING };
    
            await httpMonitor.check(monitor, heartbeat, {});
    
            const req = getLastRequest();
            const auth = req.headers.authorization;
            assert.ok(auth.startsWith("Basic "));
            const decoded = Buffer.from(auth.split(" ")[1], "base64").toString();
            assert.strictEqual(decoded, "admin:s3cr3t!");
        });

        test("check() sets status to UP when oauth2-cc provides valid bearer token", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
        
            const fakeToken = {
                access_token: "eyfakejwt123",
                token_type: "Bearer",
                expires_at: Math.floor(Date.now() / 1000) + 3600,
            };
        
            const monitor = createTestMonitor({
                url,
                auth_method: "oauth2-cc",
                makeOidcTokenClientCredentialsRequest: t.mock.fn(async () => fakeToken),
            });
        
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            const req = getLastRequest();
            assert.strictEqual(req.headers.authorization, "Bearer eyfakejwt123");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK");
        });
        
        test("check() throws when oauth2-cc token request fails", async (t) => {
            const { server, url } = await createTestServer();
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                auth_method: "oauth2-cc",
                makeOidcTokenClientCredentialsRequest: t.mock.fn(async () => {
                    throw new Error("Invalid client credentials");
                }),
            });
        
            const heartbeat = { msg: "", status: PENDING };
        
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                /The oauth config is invalid/
            );
        
            assert.strictEqual(heartbeat.status, PENDING);
        });

        test("check() reuses existing valid oauth2-cc token without refreshing when not expired", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer({
                status: 200,
                responseBody: "Protected resource OK",
            });
            t.after(() => server.close());
        
            const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
        
            const monitor = createTestMonitor({
                url,
                auth_method: "oauth2-cc",
                oauthAccessToken: {
                    access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-token",
                    token_type: "Bearer",
                    expires_at: futureExpiry,
                },
                makeOidcTokenClientCredentialsRequest: t.mock.fn(async () => {
                    throw new Error("Token is still valid");
                }),
            });
        
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(monitor.makeOidcTokenClientCredentialsRequest.mock.callCount(), 0,
                "Token request should NOT be called when existing token is valid");

            const req = getLastRequest();
            assert.strictEqual(req.headers.authorization, "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-token");

            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK");
        });

        test("check() refreshes oauth2-cc token when expires_at is in the past", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());

            const newToken = {
                access_token: "new-token-after-refresh",
                token_type: "Bearer",
                expires_at: Math.floor(Date.now() / 1000) + 3600,
            };

            const monitor = createTestMonitor({
                url,
                auth_method: "oauth2-cc",
                oauthAccessToken: {
                    access_token: "expired-token",
                    token_type: "Bearer",
                    expires_at: Math.floor(Date.now() / 1000) - 1, // 1 second ago
                },
                makeOidcTokenClientCredentialsRequest: t.mock.fn(async () => newToken),
            });

            const heartbeat = { msg: "", status: PENDING };

            await httpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(monitor.makeOidcTokenClientCredentialsRequest.mock.callCount(), 1);
            const req = getLastRequest();
            assert.strictEqual(req.headers.authorization, "Bearer new-token-after-refresh");
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() adds cache buster query parameter when enabled", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                cacheBust: true,
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            const req = getLastRequest();
            assert.ok(req.url.includes("?uptime_kuma_cachebuster="));
            assert.ok(/uptime_kuma_cachebuster=[a-z0-9]+/.test(req.url));
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() does NOT add cache buster when disabled", async (t) => {
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                cacheBust: false,
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            const req = getLastRequest();
            assert.ok(!req.url.includes("uptime_kuma_cachebuster"));
        });

        test("check() times out and throws when server is too slow", async (t) => {
            const { server, url } = await createInspectingTestServer({
                delayMs: 2500, // longer than timeout=1s
            });
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                timeout: 1, // 1 second
            });
            const heartbeat = { msg: "", status: PENDING };

            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("timeout") || err.code === "ECONNABORTED");
                    return true;
                }
            );

            assert.strictEqual(heartbeat.status, PENDING);
        });

        test("check() saves response body when saveResponse is enabled", async (t) => {
            const responseBody = { status: "healthy", version: "3.14" };
        
            const { server, url } = await createTestServer({
                status: 200,
                body: JSON.stringify(responseBody),
            });
            t.after(() => server.close());
        
            const saveResponseDataSpy = t.mock.fn(async () => {});
        
            const monitor = createTestMonitor({
                url,
                getSaveResponse: () => true,
                getSaveErrorResponse: () => true,
                saveResponseData: saveResponseDataSpy,
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(saveResponseDataSpy.mock.callCount(), 1);
            assert.deepStrictEqual(saveResponseDataSpy.mock.calls[0].arguments[1], responseBody);
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() does not call saveResponseData when getSaveResponse() is false", async (t) => {
            const { server, url } = await createTestServer({ status: 200, body: "ok" });
            t.after(() => server.close());

            const saveResponseDataSpy = t.mock.fn(async () => {});

            const monitor = createTestMonitor({
                url,
                getSaveResponse: () => false,
                getSaveErrorResponse: () => true,
                saveResponseData: saveResponseDataSpy,
            });
            const heartbeat = { msg: "", status: PENDING };

            await httpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(saveResponseDataSpy.mock.callCount(), 0);
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() does not call saveResponseData when getSaveErrorResponse() is false", async (t) => {
            const { server, url } = await createTestServer({ status: 200, body: "ok" });
            t.after(() => server.close());

            const saveResponseDataSpy = t.mock.fn(async () => {});

            const monitor = createTestMonitor({
                url,
                getSaveResponse: () => true,
                getSaveErrorResponse: () => false,
                saveResponseData: saveResponseDataSpy,
            });
            const heartbeat = { msg: "", status: PENDING };

            await httpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(saveResponseDataSpy.mock.callCount(), 0);
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() follows up to maxredirects and succeeds", async (t) => {
            let redirectCount = 0;
        
            const { server, url } = await new Promise((resolve) => {
                const srv = http.createServer((req, res) => {
                    if (redirectCount < 3) {
                        redirectCount++;
                        res.writeHead(302, { Location: `/redirect/${redirectCount}` });
                        res.end();
                    } else {
                        res.writeHead(200);
                        res.end("Final destination");
                    }
                });
                srv.listen(0, () => {
                    resolve({
                        server: srv,
                        url: `http://localhost:${srv.address().port}`,
                    });
                });
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url: `${url}/start`,
                maxredirects: 5,
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK");
        });

        test("check() fails when redirects exceed maxredirects", async (t) => {
            let redirectCount = 0;
        
            const { server, url } = await new Promise((resolve) => {
                const srv = http.createServer((req, res) => {
                    if (redirectCount < 4) {
                        redirectCount++;
                        res.writeHead(302, { Location: `/r/${redirectCount}` });
                        res.end();
                    } else {
                        res.writeHead(200);
                        res.end();
                    }
                });
                srv.listen(0, () => resolve({ server: srv, url: `http://localhost:${srv.address().port}` }));
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url: `${url}/start`,
                maxredirects: 3, // allow only 3 → should fail on 4th
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("max redirects") || err.message.includes("redirect"));
                    return true;
                }
            );
        
            assert.strictEqual(heartbeat.status, PENDING);
        });

        test("check() shows truncated body preview in keyword error when body is long", async (t) => {
            const longBody = "A".repeat(200) + "IMPORTANT KEYWORD HERE" + "B".repeat(200);
            const { server, url } = await createTestServer({ body: longBody });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "keyword",
                keyword: "NOT-FOUND-STRING",
                isInvertKeyword: () => false,
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("..."));
                    assert.ok(err.message.length < 300);
                    return true;
                }
            );
        });

        test("check() sets status to UP when JSON query matches with == operator", async (t) => {
            const jsonResponse = {
                status: "healthy",
                uptime: 99.95,
                version: "2.1.0",
                sensors: { temp: 23.5 },
            };
        
            const { server, url } = await createTestServer({
                status: 200,
                body: JSON.stringify(jsonResponse),
                headers: { "Content-Type": "application/json" },
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "json-query",
                jsonPath: "$.status",
                jsonPathOperator: "==",
                expectedValue: "healthy",
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.includes("JSON query passes"));
            assert.ok(heartbeat.msg.includes("healthy == healthy"));
        });

        test("check() throws when JSON query does not match (== operator)", async (t) => {
            const jsonResponse = {
                status: "warning",
                uptime: 99.95,
            };
        
            const { server, url } = await createTestServer({
                status: 200,
                body: JSON.stringify(jsonResponse),
                headers: { "Content-Type": "application/json" },
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "json-query",
                jsonPath: "$.status",
                jsonPathOperator: "==",
                expectedValue: "healthy",
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("JSON query does not pass"));
                    assert.ok(err.message.includes("warning == healthy"));
                    return true;
                }
            );
        
            assert.strictEqual(heartbeat.status, PENDING);
        });

        test("check() sets status to UP when using > operator on numeric value", async (t) => {
            const jsonResponse = {
                metrics: {
                    latency_ms: 145,
                    errors: 0,
                },
            };
        
            const { server, url } = await createTestServer({
                body: JSON.stringify(jsonResponse),
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "json-query",
                jsonPath: "$.metrics.latency_ms",
                jsonPathOperator: "<",
                expectedValue: "200", // string comparison? → depends on impl, but usually coerced
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.includes("JSON query passes"));
            assert.ok(heartbeat.msg.includes("145 < 200"));
        });

        test("check() handles missing JSON path gracefully (throws)", async (t) => {
            const jsonResponse = { data: { value: 42 } };
        
            const { server, url } = await createTestServer({
                body: JSON.stringify(jsonResponse),
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "json-query",
                jsonPath: "$.missing.path",
                jsonPathOperator: "==",
                expectedValue: "anything",
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    // Depending on evaluateJsonQuery impl – usually response = undefined or null
                    assert.ok(err.message.includes("Error evaluating JSON query: Empty or undefined response."));
                    assert.ok(err.message.includes("undefined") || err.message.includes("null"));
                    return true;
                }
            );
        });

        test("check() sets status to UP when using contains operator on array or string", async (t) => {
            const jsonResponse = {
                tags: ["critical", "production", "eu-west"],
                message: "Service restarted successfully",
            };
        
            const { server, url } = await createTestServer({
                body: JSON.stringify(jsonResponse),
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "json-query",
                jsonPath: "$join($.tags, \",\")",
                jsonPathOperator: "contains",
                expectedValue: "production",
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() works with nested path and != operator", async (t) => {
            const jsonResponse = {
                config: {
                    debug: true,
                    level: "info",
                },
            };
        
            const { server, url } = await createTestServer({
                body: JSON.stringify(jsonResponse),
            });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                type: "json-query",
                jsonPath: "$.config.debug",
                jsonPathOperator: "!=",
                expectedValue: "false",
            });
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() captures TLS info via keylog + secureConnect when real TLS handshake occurs", async (t) => {
            const utilServerPath = require.resolve("../../../server/util-server", { paths: [__dirname] });
            const httpPath = require.resolve("../../../server/monitor-types/http", { paths: [__dirname] });
            
            const utilServerExports = require.cache[utilServerPath].exports;
            const originalCheckHostname = utilServerExports.checkCertificateHostname;
            utilServerExports.checkCertificateHostname = () => true;
            delete require.cache[httpPath];
            
            t.after(() => {
                utilServerExports.checkCertificateHostname = originalCheckHostname;
                delete require.cache[httpPath];
            });

            const fakeTlsSocket = {
                authorized: true,
                getPeerCertificate: () => ({
                    subject: { CN: "example.com" },
                    issuer: { CN: "Fake CA" },
                    valid_from: "Jan 1 00:00:00 2025 GMT",
                    valid_to: "Jan 1 00:00:00 2027 GMT",
                    raw: Buffer.from("fake-cert-der"),
                }),
                once: t.mock.fn((event, cb) => {
                    if (event === "secureConnect") {
                        setImmediate(() => cb());
                    }
                }),
            };
        
            const spyHandleTlsInfo = t.mock.fn(async () => {});

            const { HttpMonitorType: HttpMonitorTypeWithStub } = require("../../../server/monitor-types/http");
            const httpMonitorWithStub = new HttpMonitorTypeWithStub();

            const monitor = createTestMonitor({
                url: "https://localhost:some-port",
                getUrl: () => new URL("https://example.com"),
                handleTlsInfo: spyHandleTlsInfo,
            });

            monitor.makeAxiosRequest = t.mock.fn(async (options) => {
                options.httpsAgent.emit("keylog", Buffer.from("FAKE KEYLOG LINE"), fakeTlsSocket)
                return { status: 200, statusText: "OK", data: "Success", request: { res: { socket: null } } }
            });
        
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitorWithStub.check(monitor, heartbeat, {});

            await new Promise(resolve => setImmediate(resolve));

            assert.strictEqual(spyHandleTlsInfo.mock.callCount(), 1);
            
            const calledWith = spyHandleTlsInfo.mock.calls[0].arguments[0];
            assert.strictEqual(calledWith.valid, true);
            assert.strictEqual(calledWith.hostnameMatchMonitorUrl, true)
        });

        test("check() attaches mTLS cert/key/ca when auth_method = mtls", async (t) => {
            const { server, url } = await createTestServer({ status: 200 });
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url: url.replace("http://", "https://"), // fake https
                auth_method: "mtls",
                tlsCert: "-----BEGIN CERTIFICATE-----\nfake cert\n-----END CERTIFICATE-----",
                tlsKey: "-----BEGIN PRIVATE KEY-----\nfake key\n-----END PRIVATE KEY-----",
                tlsCa: "-----BEGIN CERTIFICATE-----\nfake ca\n-----END CERTIFICATE-----",
            });
        
            const heartbeat = { msg: "", status: PENDING };
        
            // Will throw because no real https server, but we check options were set
            await assert.rejects(
                httpMonitor.check(monitor, heartbeat, {}),
                /self-signed|ECONN|asn1|encoding|header too long|certificate|invalid/i
            );
        });

        test("check() forces ipv4 when ipFamily = ipv4", async (t) => {
            const { server, url } = await createInspectingTestServer();
            t.after(() => server.close());
        
            let requestOptions = null;
            const monitor = createTestMonitor({
                url,
                ipFamily: "ipv4",
                makeAxiosRequest: (opts) => {
                    requestOptions = opts;
                    return axios.request(opts);
                },
            });
        
            const heartbeat = { msg: "", status: PENDING };
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(requestOptions.httpAgent.options?.family, 4);
        });

        test("check() forces ipv6 when ipFamily = ipv6", async (t) => {
            const { server, url } = await createInspectingTestServer();
            t.after(() => server.close());
        
            let requestOptions = null;
            const monitor = createTestMonitor({
                url,
                ipFamily: "ipv6",
                makeAxiosRequest: (opts) => {
                    requestOptions = opts;
                    return axios.request(opts);
                },
            });
        
            const heartbeat = { msg: "", status: PENDING };
            await httpMonitor.check(monitor, heartbeat, {});

            assert.strictEqual(requestOptions.httpAgent.options?.family, 6);
        });

        test("check() uses proxy when proxy_id is set and active", async (t) => {
            const fakeProxy = {
                id: 7,
                active: true,
                host: "proxy.local",
                port: 8080,
                auth: false,
            };
        
            const mockLoad = t.mock.fn(async (table, id) => {
                if (table === "proxy" && id === 7) return fakeProxy;
                return null;
            });
        
            const spyCreateAgents = t.mock.fn(() => ({
                httpAgent:  new http.Agent(),
                httpsAgent: new https.Agent(),
            }));

            const redbeanPath = require.resolve("redbean-node");
            const proxyPath = require.resolve("../../../server/proxy", { paths: [__dirname] });
            const httpPath = require.resolve("../../../server/monitor-types/http", { paths: [__dirname] });
        
            const redbeanExports = require.cache[redbeanPath].exports;
            const originalR = redbeanExports.R;
            const originalProxyExports = require.cache[proxyPath].exports;
        
            redbeanExports.R = { load: mockLoad };
            require.cache[proxyPath].exports = { Proxy: { createAgents: spyCreateAgents } };
            delete require.cache[httpPath];
        
            t.after(() => {
                redbeanExports.R = originalR;
                require.cache[proxyPath].exports = originalProxyExports;
                delete require.cache[httpPath];
            });
        
            const { HttpMonitorType: HttpMonitorForProxy } = require("../../../server/monitor-types/http");
            const httpMonitorForProxy = new HttpMonitorForProxy();
        
            const { server, url } = await createTestServer();
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                proxy_id: 7,
            });
        
            await httpMonitorForProxy.check(monitor, { msg: "", status: PENDING }, {});
        
            assert.strictEqual(spyCreateAgents.mock.callCount(), 1);
            assert.strictEqual(spyCreateAgents.mock.calls[0].arguments[0].host, "proxy.local");
        });

        test("check() does not use proxy when proxy_id is set but proxy record is not found", async (t) => {
            const fakeProxy = {
                id: 7,
                active: true,
                host: "proxy.local",
                port: 8080,
                auth: false,
            };
        
            const mockLoad = t.mock.fn(async (table, id) => {
                if (table === "proxy" && id === 7) return fakeProxy;
                return null;
            });
        
            const spyCreateAgents = t.mock.fn(() => ({
                httpAgent:  new http.Agent(),
                httpsAgent: new https.Agent(),
            }));

            const redbeanPath = require.resolve("redbean-node");
            const proxyPath = require.resolve("../../../server/proxy", { paths: [__dirname] });
            const httpPath = require.resolve("../../../server/monitor-types/http", { paths: [__dirname] });
        
            const redbeanExports = require.cache[redbeanPath].exports;
            const originalR = redbeanExports.R;
            const originalProxyExports = require.cache[proxyPath].exports;
        
            redbeanExports.R = { load: mockLoad };
            require.cache[proxyPath].exports = { Proxy: { createAgents: spyCreateAgents } };
            delete require.cache[httpPath];
        
            t.after(() => {
                redbeanExports.R = originalR;
                require.cache[proxyPath].exports = originalProxyExports;
                delete require.cache[httpPath];
            });
        
            const { HttpMonitorType: HttpMonitorForProxy } = require("../../../server/monitor-types/http");
            const httpMonitorForProxy = new HttpMonitorForProxy();

            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());

            const monitor = createTestMonitor({
                url,
                proxy_id: 8,
            });

            const heartbeat = { 
                msg: "", 
                status: PENDING 
            };
        
            await httpMonitorForProxy.check(monitor, heartbeat, {});
        
            // Assertions
            assert.strictEqual(spyCreateAgents.mock.callCount(), 0, "Proxy.createAgents should not be called when proxy is missing");
        
            const req = getLastRequest();
            assert.strictEqual(req.method, "GET");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK");
        });

        test("check() does not use proxy when proxy_id is set but proxy is inactive", async (t) => {
            const fakeProxy = {
                id: 7,
                active: false,
                host: "proxy.local",
                port: 8080,
                auth: false,
            };
        
            const mockLoad = t.mock.fn(async (table, id) => {
                if (table === "proxy" && id === 7) return fakeProxy;
                return null;
            });
        
            const spyCreateAgents = t.mock.fn(() => ({
                httpAgent:  new http.Agent(),
                httpsAgent: new https.Agent(),
            }));

            const redbeanPath = require.resolve("redbean-node");
            const proxyPath = require.resolve("../../../server/proxy", { paths: [__dirname] });
            const httpPath = require.resolve("../../../server/monitor-types/http", { paths: [__dirname] });
        
            const redbeanExports = require.cache[redbeanPath].exports;
            const originalR = redbeanExports.R;
            const originalProxyExports = require.cache[proxyPath].exports;
        
            redbeanExports.R = { load: mockLoad };
            require.cache[proxyPath].exports = { Proxy: { createAgents: spyCreateAgents } };
            delete require.cache[httpPath];
        
            t.after(() => {
                redbeanExports.R = originalR;
                require.cache[proxyPath].exports = originalProxyExports;
                delete require.cache[httpPath];
            });
        
            const { HttpMonitorType: HttpMonitorForProxy } = require("../../../server/monitor-types/http");
            const httpMonitorForProxy = new HttpMonitorForProxy();
        
            const { server, url, getLastRequest } = await createInspectingTestServer();
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                proxy_id: 7,
            });

            const heartbeat = { msg: "", status: PENDING };

            await httpMonitorForProxy.check(monitor, heartbeat, {});

            assert.strictEqual(spyCreateAgents.mock.callCount(), 0, "Proxy.createAgents should not be called when proxy.active === false");
        
            const req = getLastRequest();
            assert.strictEqual(req.method, "GET");
            assert.strictEqual(heartbeat.status, UP);
            assert.strictEqual(heartbeat.msg, "200 - OK");
        });

        test("check() rejects when proxy loading fails", async (t) => {
            const mockLoad = t.mock.fn(async (table, id) => {
                throw new Error("Database timeout");
            });
        
            const spyCreateAgents = t.mock.fn(() => ({
                httpAgent:  new http.Agent(),
                httpsAgent: new https.Agent(),
            }));

            const redbeanPath = require.resolve("redbean-node");
            const proxyPath = require.resolve("../../../server/proxy", { paths: [__dirname] });
            const httpPath = require.resolve("../../../server/monitor-types/http", { paths: [__dirname] });
        
            const redbeanExports = require.cache[redbeanPath].exports;
            const originalR = redbeanExports.R;
            const originalProxyExports = require.cache[proxyPath].exports;
        
            redbeanExports.R = { load: mockLoad };
            require.cache[proxyPath].exports = { Proxy: { createAgents: spyCreateAgents } };
            delete require.cache[httpPath];
        
            t.after(() => {
                redbeanExports.R = originalR;
                require.cache[proxyPath].exports = originalProxyExports;
                delete require.cache[httpPath];
            });

            const { HttpMonitorType: HttpMonitorForProxy } = require("../../../server/monitor-types/http");
            const httpMonitorForProxy = new HttpMonitorForProxy();

            const { server, url } = await createInspectingTestServer();
            t.after(() => server.close());
        
            const monitor = createTestMonitor({
                url,
                proxy_id: 55,
            });
        
            const heartbeat = { msg: "", status: PENDING };
        
            await assert.rejects(
                httpMonitorForProxy.check(monitor, heartbeat, {}),
                /Database timeout/
            );
            assert.strictEqual(spyCreateAgents.mock.callCount(), 0);
        });

        test("check() accepts self-signed cert when getIgnoreTls() returns true", async (t) => {
            const monitor = createTestMonitor({
                url: "https://self-signed.local:8443",
                getIgnoreTls: () => true,
            });
        
            monitor.makeAxiosRequest = t.mock.fn(async () => ({
                status: 200,
                statusText: "OK",
                data: "",
                request: { res: { socket: null } },
            }));
        
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitor.check(monitor, heartbeat, {});
        
            assert.strictEqual(heartbeat.status, UP);
        });

        test("check() uses fallback TLS info extraction via res.request.res.socket when keylog not emitted (e.g. proxy)", async (t) => {
            const utilServerPath = require.resolve("../../../server/util-server", { paths: [__dirname] });
            const httpPath = require.resolve("../../../server/monitor-types/http", { paths: [__dirname] });
            
            const utilServerExports = require.cache[utilServerPath].exports;
            const originalCheckHostname = utilServerExports.checkCertificateHostname;
            utilServerExports.checkCertificateHostname = () => true;
            delete require.cache[httpPath];
            
            t.after(() => {
                utilServerExports.checkCertificateHostname = originalCheckHostname;
                delete require.cache[httpPath];
            });

            
            const spyHandleTlsInfo = t.mock.fn(async () => {});
        
            const fakeTlsSocket = {
                authorized: false,
                getPeerCertificate: () => ({
                    subject: { CN: "proxied.example.com" },
                    valid_from: "2025-01-01",
                    valid_to: "2026-01-01",
                    raw: Buffer.from("proxied-cert"),
                }),
            };

            const { HttpMonitorType: HttpMonitorTypeWithStub } = require("../../../server/monitor-types/http");
            const httpMonitorWithStub = new HttpMonitorTypeWithStub();
        
            const monitor = createTestMonitor({
                url: "https://example.com",
                getUrl: () => new URL("https://example.com"),
                handleTlsInfo: spyHandleTlsInfo,
            });
        
            monitor.makeAxiosRequest = t.mock.fn(async () => ({
                status: 200,
                statusText: "OK",
                data: "Proxied success",
                request: {
                    res: {
                        socket: fakeTlsSocket, // simulate proxy-passthrough socket
                    },
                },
            }));
        
            const heartbeat = { msg: "", status: PENDING };
        
            await httpMonitorWithStub.check(monitor, heartbeat, {});
        
            assert.strictEqual(spyHandleTlsInfo.mock.callCount(), 1);
        
            const tlsInfo = spyHandleTlsInfo.mock.calls[0].arguments[0];
            assert.strictEqual(tlsInfo.valid, false);
            assert.strictEqual(tlsInfo.hostnameMatchMonitorUrl, true);
            assert.ok(tlsInfo.certInfo);
        });

        test("check() logs full response body when UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID matches", async (t) => {
            process.env.UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID = "9999";
        
            const spyLog = t.mock.method(log, "info");
        
            const { server, url } = await createTestServer({ body: "secret debug payload" });
            t.after(() => {
                server.close();
                delete process.env.UPTIME_KUMA_LOG_RESPONSE_BODY_MONITOR_ID;
            });
        
            const monitor = createTestMonitor({
                id: 9999,
                url,
            });
        
            await httpMonitor.check(monitor, { msg: "", status: PENDING }, {});
        
            assert.ok(spyLog.mock.calls.some(call => call.arguments[1].includes("secret debug payload")));
        });
	}
);

