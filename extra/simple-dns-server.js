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
            }

            // TODO: all other types

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

function type(code) {
    for (let name in Packet.TYPE) {
        if (Packet.TYPE[name] === code) {
            return name;
        }
    }
}
