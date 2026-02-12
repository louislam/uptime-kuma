const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const axios = require("axios");
const dayjs = require("dayjs");
const https = require("https");
const http = require("http");
const { CookieJar } = require("tough-cookie");
const { HttpsCookieAgent } = require("http-cookie-agent/http");
const { createCookieAgent } = require("http-cookie-agent/http");

const HttpCookieAgent = createCookieAgent(http.Agent);

class LoginMonitorType extends MonitorType {
    name = "login";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const loginUrl = monitor.url;
        const username = monitor.login_username;
        const password = monitor.login_password;
        const successKeyword = monitor.login_success_keyword;

        if (!loginUrl) {
            throw new Error("Login URL is required");
        }

        if (!username || !password) {
            throw new Error("Login username and password are required");
        }

        if (!successKeyword) {
            throw new Error("Success keyword is required to verify login");
        }

        const startTime = dayjs().valueOf();

        // Create a shared cookie jar so session cookies carry across requests
        const jar = new CookieJar();

        const cookieOptions = { cookies: { jar } };

        const httpAgent = new HttpCookieAgent(cookieOptions);
        const httpsAgent = new HttpsCookieAgent({
            ...cookieOptions,
            rejectUnauthorized: !monitor.getIgnoreTls(),
        });

        const commonHeaders = {
            "User-Agent": "Uptime-Kuma",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        };

        const timeoutMs = (monitor.timeout || 30) * 1000;

        log.debug("monitor", `[${monitor.name}] Login monitor: POSTing credentials to ${loginUrl}`);

        // POST login credentials as form-encoded data
        const formBody = new URLSearchParams();
        formBody.append(monitor.login_username_field || "username", username);
        formBody.append(monitor.login_password_field || "password", password);

        const loginResponse = await axios.request({
            url: loginUrl,
            method: "POST",
            data: formBody.toString(),
            timeout: timeoutMs,
            httpAgent,
            httpsAgent,
            maxRedirects: monitor.maxredirects || 10,
            headers: {
                ...commonHeaders,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            // Accept any status code so we can inspect the response
            validateStatus: () => true,
        });

        heartbeat.ping = dayjs().valueOf() - startTime;

        // Check the response body for the success keyword
        let responseData = loginResponse.data;
        if (typeof responseData !== "string") {
            responseData = JSON.stringify(responseData);
        }

        const keywordFound = responseData.includes(successKeyword);

        if (keywordFound) {
            heartbeat.msg = `Login successful (${loginResponse.status}), keyword "${successKeyword}" found`;
            heartbeat.status = UP;
        } else {
            // Truncate response for error message
            let truncated = responseData.replace(/<[^>]*>?|[\n\r]|\s+/gm, " ").trim();
            if (truncated.length > 100) {
                truncated = truncated.substring(0, 97) + "...";
            }
            throw new Error(
                `Login failed (${loginResponse.status}): keyword "${successKeyword}" not found in response [${truncated}]`
            );
        }
    }
}

module.exports = {
    LoginMonitorType,
};
