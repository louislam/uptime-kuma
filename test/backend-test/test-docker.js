const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const axios = require("axios");

const { DockerHost } = require("../../server/docker");

describe("DockerHost.testDockerHost", () => {
    let requestMock;

    beforeEach(() => {
        requestMock = mock.method(axios, "request");
    });

    afterEach(() => {
        mock.restoreAll();
    });

    it("should return the number of containers for a Docker socket", async () => {
        requestMock.mock.mockImplementation(async () => ({
            data: [
                { Id: "container-1", ImageID: "image-1" },
                { Id: "container-2", ImageID: "image-2" },
            ],
        }));

        const result = await DockerHost.testDockerHost({ dockerType: "socket", dockerDaemon: "/var/run/docker.sock" });

        assert.equal(result, 2);

        const options = requestMock.mock.calls[0].arguments[0];
        assert.equal(options.socketPath, "/var/run/docker.sock");
        assert.equal(options.url, "/containers/json?all=true");
        assert.equal(options.timeout, 5000);
    });

    it("should return zero when the Docker host has no containers", async () => {
        requestMock.mock.mockImplementation(async () => ({
            data: [],
        }));

        const result = await DockerHost.testDockerHost({ dockerType: "socket", dockerDaemon: "/var/run/docker.sock" });

        assert.equal(result, 0);
    });

    it("should normalize a TCP Docker URL and return the container count", async (t) => {
        const agentOptionsMock = mock.method(DockerHost, "getHttpsAgentOptions", async () => ({}));

        requestMock.mock.mockImplementation(async () => ({
            data: [
                { Id: "container-1", ImageID: "image-1" },
                { Id: "container-2", ImageID: "image-2" },
            ],
        }));

        const result = await DockerHost.testDockerHost({
            dockerType: "tcp",
            dockerDaemon: "tcp://docker.example.com:2375",
        });

        assert.equal(result, 2);

        const options = requestMock.mock.calls[0].arguments[0];
        assert.equal(options.baseURL, "http://docker.example.com:2375");
        assert.ok(options.httpsAgent);

        assert.equal(agentOptionsMock.mock.calls[0].arguments[1], "http://docker.example.com:2375");
    });

    it("should reject an invalid Docker response", async () => {
        requestMock.mock.mockImplementation(async () => ({
            data: { message: "not a container list" },
        }));

        await assert.rejects(
            DockerHost.testDockerHost({ dockerType: "socket", dockerDaemon: "/var/run/docker.sock" }),
            { message: "Invalid Docker response, is it Docker really a daemon?" }
        );
    });

    it("should reject response without ImageID", async () => {
        requestMock.mock.mockImplementation(async () => ({
            data: [{ Id: "container-1" }],
        }));

        await assert.rejects(
            DockerHost.testDockerHost({ dockerType: "socket", dockerDaemon: "/var/run/docker.sock" }),
            { message: "Invalid Docker response, is it Docker really a daemon?" }
        );
    });

    it("should convert connection timeouts into a descriptive error", async () => {
        const timeoutError = new Error("timeout");
        timeoutError.code = "ECONNABORTED";

        requestMock.mock.mockImplementation(async () => {
            throw timeoutError;
        });

        await assert.rejects(
            DockerHost.testDockerHost({ dockerType: "socket", dockerDaemon: "/var/run/docker.sock" }),
            { message: "Connection to Docker daemon timed out." }
        );
    });

    it("should propagate other connection errors", async () => {
        const connectionError = new Error("Connection refused");

        requestMock.mock.mockImplementation(async () => {
            throw connectionError;
        });

        await assert.rejects(
            DockerHost.testDockerHost({ dockerType: "socket", dockerDaemon: "/var/run/docker.sock" }),
            (error) => error === connectionError
        );
    });
});
