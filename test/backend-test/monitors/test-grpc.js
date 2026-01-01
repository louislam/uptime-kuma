const { describe, test } = require("node:test");
const assert = require("node:assert");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { GrpcKeywordMonitorType } = require("../../server/monitor-types/grpc");
const { UP, PENDING } = require("../../src/util");
const fs = require("fs");
const path = require("path");
const os = require("os");

const testProto = `
syntax = "proto3";
package test;

service TestService {
    rpc Echo (EchoRequest) returns (EchoResponse);
}

message EchoRequest {
    string message = 1;
}

message EchoResponse {
    string message = 1;
}
`;

/**
 * Create a gRPC server for testing
 * @param {number} port Port to listen on
 * @param {object} methodHandlers Object with method handlers
 * @returns {Promise<grpc.Server>} gRPC server instance
 */
async function createTestGrpcServer(port, methodHandlers) {
    // Write proto to temp file
    const tmpDir = os.tmpdir();
    const protoPath = path.join(tmpDir, `test-${port}.proto`);
    fs.writeFileSync(protoPath, testProto);

    // Load proto file
    const packageDefinition = protoLoader.loadSync(protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
    const testPackage = protoDescriptor.test;

    const server = new grpc.Server();

    // Add service implementation
    server.addService(testPackage.TestService.service, {
        Echo: (call, callback) => {
            if (methodHandlers.Echo) {
                methodHandlers.Echo(call, callback);
            } else {
                callback(null, { message: call.request.message });
            }
        },
    });

    return new Promise((resolve, reject) => {
        server.bindAsync(
            `0.0.0.0:${port}`,
            grpc.ServerCredentials.createInsecure(),
            (err) => {
                if (err) {
                    reject(err);
                } else {
                    server.start();
                    // Clean up temp file
                    fs.unlinkSync(protoPath);
                    resolve(server);
                }
            }
        );
    });
}

describe("GrpcKeywordMonitorType", {
    skip: !!process.env.CI && (process.platform !== "linux" || process.arch !== "x64"),
}, () => {
    test("gRPC keyword found in response", async () => {
        const port = 50051;
        const server = await createTestGrpcServer(port, {
            Echo: (call, callback) => {
                callback(null, { message: "Hello World with SUCCESS keyword" });
            }
        });

        const grpcMonitor = new GrpcKeywordMonitorType();
        const monitor = {
            grpcUrl: `localhost:${port}`,
            grpcProtobuf: testProto,
            grpcServiceName: "test.TestService",
            grpcMethod: "echo",
            grpcBody: JSON.stringify({ message: "test" }),
            keyword: "SUCCESS",
            invertKeyword: false,
            grpcEnableTls: false,
            isInvertKeyword: () => false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await grpcMonitor.check(monitor, heartbeat, {});
            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.includes("SUCCESS"));
            assert.ok(heartbeat.msg.includes("is"));
        } finally {
            server.forceShutdown();
        }
    });

    test("gRPC keyword not found in response", async () => {
        const port = 50052;
        const server = await createTestGrpcServer(port, {
            Echo: (call, callback) => {
                callback(null, { message: "Hello World without the expected keyword" });
            }
        });

        const grpcMonitor = new GrpcKeywordMonitorType();
        const monitor = {
            grpcUrl: `localhost:${port}`,
            grpcProtobuf: testProto,
            grpcServiceName: "test.TestService",
            grpcMethod: "echo",
            grpcBody: JSON.stringify({ message: "test" }),
            keyword: "MISSING",
            invertKeyword: false,
            grpcEnableTls: false,
            isInvertKeyword: () => false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await assert.rejects(
                grpcMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("MISSING"));
                    assert.ok(err.message.includes("not"));
                    return true;
                }
            );
        } finally {
            server.forceShutdown();
        }
    });

    test("gRPC inverted keyword - keyword present (should fail)", async () => {
        const port = 50053;
        const server = await createTestGrpcServer(port, {
            Echo: (call, callback) => {
                callback(null, { message: "Response with ERROR keyword" });
            }
        });

        const grpcMonitor = new GrpcKeywordMonitorType();
        const monitor = {
            grpcUrl: `localhost:${port}`,
            grpcProtobuf: testProto,
            grpcServiceName: "test.TestService",
            grpcMethod: "echo",
            grpcBody: JSON.stringify({ message: "test" }),
            keyword: "ERROR",
            invertKeyword: true,
            grpcEnableTls: false,
            isInvertKeyword: () => true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await assert.rejects(
                grpcMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    assert.ok(err.message.includes("ERROR"));
                    assert.ok(err.message.includes("present"));
                    return true;
                }
            );
        } finally {
            server.forceShutdown();
        }
    });

    test("gRPC inverted keyword - keyword not present (should pass)", async () => {
        const port = 50054;
        const server = await createTestGrpcServer(port, {
            Echo: (call, callback) => {
                callback(null, { message: "Response without error keyword" });
            }
        });

        const grpcMonitor = new GrpcKeywordMonitorType();
        const monitor = {
            grpcUrl: `localhost:${port}`,
            grpcProtobuf: testProto,
            grpcServiceName: "test.TestService",
            grpcMethod: "echo",
            grpcBody: JSON.stringify({ message: "test" }),
            keyword: "ERROR",
            invertKeyword: true,
            grpcEnableTls: false,
            isInvertKeyword: () => true,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await grpcMonitor.check(monitor, heartbeat, {});
            assert.strictEqual(heartbeat.status, UP);
            assert.ok(heartbeat.msg.includes("ERROR"));
            assert.ok(heartbeat.msg.includes("not"));
        } finally {
            server.forceShutdown();
        }
    });

    test("gRPC connection failure", async () => {
        const grpcMonitor = new GrpcKeywordMonitorType();
        const monitor = {
            grpcUrl: "localhost:50099",
            grpcProtobuf: testProto,
            grpcServiceName: "test.TestService",
            grpcMethod: "echo",
            grpcBody: JSON.stringify({ message: "test" }),
            keyword: "SUCCESS",
            invertKeyword: false,
            grpcEnableTls: false,
            isInvertKeyword: () => false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        await assert.rejects(
            grpcMonitor.check(monitor, heartbeat, {}),
            (err) => {
                // Should fail with connection error
                return true;
            }
        );
    });

    test("gRPC response truncation for long messages", async () => {
        const port = 50055;
        const longMessage = "A".repeat(100) + " with SUCCESS keyword";

        const server = await createTestGrpcServer(port, {
            Echo: (call, callback) => {
                callback(null, { message: longMessage });
            }
        });

        const grpcMonitor = new GrpcKeywordMonitorType();
        const monitor = {
            grpcUrl: `localhost:${port}`,
            grpcProtobuf: testProto,
            grpcServiceName: "test.TestService",
            grpcMethod: "echo",
            grpcBody: JSON.stringify({ message: "test" }),
            keyword: "MISSING",
            invertKeyword: false,
            grpcEnableTls: false,
            isInvertKeyword: () => false,
        };

        const heartbeat = {
            msg: "",
            status: PENDING,
        };

        try {
            await assert.rejects(
                grpcMonitor.check(monitor, heartbeat, {}),
                (err) => {
                    // Should truncate message to 50 characters with "..."
                    assert.ok(err.message.includes("..."));
                    return true;
                }
            );
        } finally {
            server.forceShutdown();
        }
    });
});
