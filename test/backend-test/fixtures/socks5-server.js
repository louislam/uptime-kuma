const net = require("net");

const listenHost = process.env.SOCKS5_LISTEN_HOST || "0.0.0.0";
const listenPort = Number(process.env.SOCKS5_LISTEN_PORT || 1080);
const username = process.env.SOCKS5_USERNAME;
const password = process.env.SOCKS5_PASSWORD;
const requireAuth = username !== undefined || password !== undefined;

if (requireAuth && (!username || !password)) {
    throw new Error("SOCKS5_USERNAME and SOCKS5_PASSWORD must be provided together");
}

/**
 * @param socket
 * @param length
 */
function readExactly(socket, length) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let received = 0;
        const cleanup = () => {
            socket.off("data", onData);
            socket.off("close", onClose);
            socket.off("error", onError);
        };
        const onData = (chunk) => {
            chunks.push(chunk);
            received += chunk.length;
            if (received >= length) {
                cleanup();
                const data = Buffer.concat(chunks, received);
                if (data.length > length) {
                    socket.pause();
                    socket.unshift(data.subarray(length));
                }
                resolve(data.subarray(0, length));
            }
        };
        const onClose = () => {
            cleanup();
            reject(new Error("client closed"));
        };
        const onError = (error) => {
            cleanup();
            reject(error);
        };

        socket.on("data", onData);
        socket.once("close", onClose);
        socket.once("error", onError);
        socket.resume();
    });
}

/**
 * @param socket
 * @param addressType
 */
async function readAddress(socket, addressType) {
    if (addressType === 0x01) {
        return Array.from(await readExactly(socket, 4)).join(".");
    }
    if (addressType === 0x03) {
        const length = (await readExactly(socket, 1))[0];
        return (await readExactly(socket, length)).toString("ascii");
    }
    throw new Error("unsupported address type");
}

/**
 * @param client
 */
async function handleClient(client) {
    try {
        const greeting = await readExactly(client, 2);
        if (greeting[0] !== 0x05) {
            throw new Error("invalid SOCKS version");
        }
        const methods = await readExactly(client, greeting[1]);
        const requiredMethod = requireAuth ? 0x02 : 0x00;
        if (!methods.includes(requiredMethod)) {
            client.end(Buffer.from([0x05, 0xff]));
            return;
        }
        client.write(Buffer.from([0x05, requiredMethod]));

        if (requireAuth) {
            const authHeader = await readExactly(client, 2);
            const receivedUsername = (await readExactly(client, authHeader[1])).toString("utf8");
            const passwordLength = (await readExactly(client, 1))[0];
            const receivedPassword = (await readExactly(client, passwordLength)).toString("utf8");
            const authenticated =
                authHeader[0] === 0x01 && receivedUsername === username && receivedPassword === password;
            client.write(Buffer.from([0x01, authenticated ? 0x00 : 0x01]));
            if (!authenticated) {
                client.end();
                return;
            }
        }

        const request = await readExactly(client, 4);
        if (request[0] !== 0x05 || request[1] !== 0x01) {
            throw new Error("only SOCKS5 CONNECT is supported");
        }
        const host = await readAddress(client, request[3]);
        const portBytes = await readExactly(client, 2);
        const port = portBytes.readUInt16BE(0);
        const target = net.createConnection({ host, port, family: 4 });

        target.once("connect", () => {
            client.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 127, 0, 0, 1, 0, 0]));
            client.pipe(target);
            target.pipe(client);
        });
        target.once("error", () => {
            client.end(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
        });
        client.once("close", () => target.destroy());
    } catch (error) {
        if (error.message !== "client closed") {
            console.error(error.message);
        }
        client.destroy();
    }
}

const server = net.createServer((client) => {
    client.pause();
    handleClient(client);
});
server.listen(listenPort, listenHost, () => {
    console.log(`SOCKS5 fixture listening on ${listenHost}:${listenPort}`);
});
