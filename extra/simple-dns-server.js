/*
 * Simple DNS Server
 * For testing DNS monitoring type, dev only
 */
const dns2 = require("dns2");

const { Packet } = dns2;

const server = dns2.createServer({
    udp: true
});

server.on("request", (request, send, rinfo) => {
    for (let question of request.questions) {
        console.log(question.name, type(question.type), question.class);

        const response = Packet.createResponseFromRequest(request);

        if (question.name === "existing.com") {

            if (question.type === Packet.TYPE.A) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    address: "1.2.3.4"
                });
            } else if (question.type === Packet.TYPE.AAAA) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    address: "fe80::::1234:5678:abcd:ef00",
                });
            } else if (question.type === Packet.TYPE.CNAME) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    domain: "cname1.existing.com",
                });
            } else if (question.type === Packet.TYPE.MX) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    exchange: "mx1.existing.com",
                    priority: 5
                });
            } else if (question.type === Packet.TYPE.NS) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    ns: "ns1.existing.com",
                });
            } else if (question.type === Packet.TYPE.SOA) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    primary: "existing.com",
                    admin: "admin@existing.com",
                    serial: 2021082701,
                    refresh: 300,
                    retry: 3,
                    expiration: 10,
                    minimum: 10,
                });
            } else if (question.type === Packet.TYPE.SRV) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    priority: 5,
                    weight: 5,
                    port: 8080,
                    target: "srv1.existing.com",
                });
            } else if (question.type === Packet.TYPE.TXT) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    data: "#v=spf1 include:_spf.existing.com ~all",
                });
            } else if (question.type === Packet.TYPE.CAA) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    flags: 0,
                    tag: "issue",
                    value: "ca.existing.com",
                });
            }

        }

        if (question.name === "4.3.2.1.in-addr.arpa") {
            if (question.type === Packet.TYPE.PTR) {
                response.answers.push({
                    name: question.name,
                    type: question.type,
                    class: question.class,
                    ttl: 300,
                    domain: "ptr1.existing.com",
                });
            }
        }

        send(response);
    }
});

server.on("listening", () => {
    console.log("Listening");
    console.log(server.addresses());
});

server.on("close", () => {
    console.log("server closed");
});

server.listen({
    udp: 5300
});

/**
 * Get human readable request type from request code
 * @param {number} code Request code to translate
 * @returns {string|void} Human readable request type
 */
function type(code) {
    for (let name in Packet.TYPE) {
        if (Packet.TYPE[name] === code) {
            return name;
        }
    }
}
