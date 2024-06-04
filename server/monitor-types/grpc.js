const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const dayjs = require("dayjs");
const grpc = require("@grpc/grpc-js");
const protojs = require("protobufjs");

export class GrpcKeywordMonitorType extends MonitorType {
    name = "grpc-keyword";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const startTime = dayjs().valueOf();
        const service = this.constructGrpcService(this.grpcUrl, this.grpcProtobuf, this.grpcServiceName, this.grpcEnableTls);
        let response = await this.grpcQuery(service, this.grpcMethod, this.grpcBody);
        heartbeat.ping = dayjs().valueOf() - startTime;
        log.debug(this.name, `gRPC response: ${response}`);
        if (response.length > 50) {
            response = response.toString().substring(0, 47) + "...";
        }
        let keywordFound = response.toString().includes(this.keyword);
        if (keywordFound !== !this.isInvertKeyword()) {
            log.debug(this.name, `GRPC response [${response}] + ", but keyword [${this.keyword}] is ${keywordFound ? "present" : "not"} in [" + ${response} + "]"`);
            throw new Error(`keyword [${this.keyword}] is ${keywordFound ? "present" : "not"} in [" + ${response} + "]`);
        }
        heartbeat.status = UP;
        heartbeat.msg = `${response}, keyword [${this.keyword}] ${keywordFound ? "is" : "not"} found`;
    }

    /**
     * Create gRPC client
     * @param {string} url grpc Url
     * @param {string} protobufData grpc ProtobufData
     * @param {string} serviceName grpc ServiceName
     * @param {string} enableTls grpc EnableTls
     * @returns {grpc.Service} grpc Service
     */
    constructGrpcService(url, protobufData, serviceName, enableTls) {
        const protocObject = protojs.parse(protobufData);
        const protoServiceObject = protocObject.root.lookupService(serviceName);
        const Client = grpc.makeGenericClientConstructor({});
        const credentials = enableTls ? grpc.credentials.createSsl() : grpc.credentials.createInsecure();
        const client = new Client(url, credentials);
        return protoServiceObject.create((method, requestData, cb) => {
            const fullServiceName = method.fullName;
            const serviceFQDN = fullServiceName.split(".");
            const serviceMethod = serviceFQDN.pop();
            const serviceMethodClientImpl = `/${serviceFQDN.slice(1).join(".")}/${serviceMethod}`;
            log.debug(this.name, `gRPC method ${serviceMethodClientImpl}`);
            client.makeUnaryRequest(
                serviceMethodClientImpl,
                arg => arg,
                arg => arg,
                requestData,
                cb);
        }, false, false);
    }

    /**
     * Create gRPC client stib
     * @param {grpc.Service} service grpc Url
     * @param {string} method grpc Method
     * @param {string} body grpc Body
     * @returns {Promise<string>} Result of gRPC query
     */
    async grpcQuery(service, method, body) {
        return new Promise((resolve, reject) => {
            try {
                service[`${method}`](JSON.parse(body), (err, response) => {
                    if (err) {
                        if (err.code !== 1) {
                            reject(`Error in send gRPC ${err.code} ${err.details}`);
                        }
                        log.debug(this.name, `ignoring ${err.code} ${err.details}, as code=1 is considered OK`);
                        resolve(`${err.code} is considered OK because ${err.details}`);
                    }
                    resolve(JSON.stringify(response));
                });
            } catch (err) {
                reject(`Error ${err}. Please review your gRPC configuration option. The service name must not include package name value, and the method name must follow camelCase format`);
            }

        });
    }
}
