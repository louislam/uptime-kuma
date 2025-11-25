const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const packageDef = protoLoader.loadSync("echo.proto", {});
const grpcObject = grpc.loadPackageDefinition(packageDef);
const { echo } = grpcObject;

/**
 * Echo service implementation
 * @param {object} call Call object
 * @param {Function} callback Callback function
 * @returns {void}
 */
function Echo(call, callback) {
    callback(null, { message: call.request.message });
}

const server = new grpc.Server();
server.addService(echo.EchoService.service, { Echo });
server.bindAsync("0.0.0.0:50051", grpc.ServerCredentials.createInsecure(), () => {
    console.log("gRPC server running on :50051");
    server.start();
});
