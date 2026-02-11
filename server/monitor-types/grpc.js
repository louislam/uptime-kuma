const { MonitorType } = require("./monitor-type");
const { UP, log } = require("../../src/util");
const dayjs = require("dayjs");
const grpc = require("@grpc/grpc-js");
const protojs = require("protobufjs");

class GrpcKeywordMonitorType extends MonitorType {
    name = "grpc-keyword";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        const startTime = dayjs().valueOf();
        const service = this.constructGrpcService(
            monitor.grpcUrl,
            monitor.grpcProtobuf,
            monitor.grpcServiceName,
            monitor.grpcEnableTls
        );
        let response = await this.grpcQuery(service, monitor.grpcMethod, monitor.grpcBody);
        heartbeat.ping = dayjs().valueOf() - startTime;
        log.debug(this.name, "gRPC response:", response);
        const { keyword} = monitor;
        let keywords = [];
        const keywordSeparator = ','; 
            // 处理关键词：兼容数组、分隔符字符串、单个字符串
        if (Array.isArray(keyword)) {
            // 1. 直接传入数组（优先级最高）
            keywords = keyword.filter(Boolean);
        } else if (typeof keyword === 'string' && keyword) {
            // 2. 字符串：按分隔符分割，同时清洗空格（比如 "success, 200" → ["success", "200"]）
            keywords = keyword.split(keywordSeparator).map(k => k.trim()).filter(Boolean);
        }
        // const keywords = Array.isArray(keyword) ? keyword : [keyword].filter(Boolean);
        // let keywordFound = false;
        if (keywords.length === 0) {
            heartbeat.status = UP;
            heartbeat.msg = `${response}, no keyword to check`;
            return;
        }


        const responseStr = response.toString(); 
        const matchedKeywords = keywords.filter(k => responseStr.includes(k));
        const keywordFound = matchedKeywords.length > 0; // 替代原有的some逻辑，结果一致


        keywordFound = keywords.some(k => responseStr.includes(k));
        if (keywordFound !== !monitor.isInvertKeyword()) {
            const matchedKeywordStr = matchedKeywords.length > 0 
            ? matchedKeywords.join(', ') 
            : "none";
            // const keywordStr = keywords.join(', ');
            log.debug(
                this.name,
                `GRPC response [${response}] , but keywords [${matchedKeywordStr}] are ${keywordFound ? "present" : "not"} in [${response}]`
            );
    

            let truncatedResponse = response.length > 50 ? response.toString().substring(0, 47) + "..." : response;

            throw new Error(
                `keywords [${matchedKeywordStr}] are ${keywordFound ? "present" : "not"} in [${truncatedResponse}]`
            );
        }
        const matchedKeywordStr = matchedKeywords.length > 0 
        ? matchedKeywords.join(', ') 
        : "none";
        // const keywordStr = keywords.join(', ');
        heartbeat.status = UP;
        heartbeat.msg = `${response}, keywords [${matchedKeywordStr}] ${keywordFound ? "is" : "not"} found `;
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
        return protoServiceObject.create(
            (method, requestData, cb) => {
                const fullServiceName = method.fullName;
                const serviceFQDN = fullServiceName.split(".");
                const serviceMethod = serviceFQDN.pop();
                const serviceMethodClientImpl = `/${serviceFQDN.slice(1).join(".")}/${serviceMethod}`;
                log.debug(this.name, `gRPC method ${serviceMethodClientImpl}`);
                client.makeUnaryRequest(
                    serviceMethodClientImpl,
                    (arg) => arg,
                    (arg) => arg,
                    requestData,
                    cb
                );
            },
            false,
            false
        );
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
                service[method](JSON.parse(body), (err, response) => {
                    if (err) {
                        if (err.code !== 1) {
                            reject(err);
                        }
                        log.debug(this.name, `ignoring ${err.code} ${err.details}, as code=1 is considered OK`);
                        resolve(`${err.code} is considered OK because ${err.details}`);
                    }
                    resolve(JSON.stringify(response));
                });
            } catch (err) {
                reject(err);
            }
        });
    }
}

module.exports = {
    GrpcKeywordMonitorType,
};
