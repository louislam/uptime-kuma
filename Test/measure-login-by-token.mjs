import { io } from "socket.io-client";
import jwt from "jsonwebtoken";
import crypto from "crypto";

const TARGET = process.env.KUMA_URL || "http://127.0.0.1:3011";
const USER = process.env.KUMA_USER || "Admin";
const SECRET = process.env.KUMA_JWT_SECRET;
const PASSWORD_HASH = process.env.KUMA_PWHASH;

if (!SECRET || !PASSWORD_HASH) {
    console.error("KUMA_JWT_SECRET and KUMA_PWHASH env vars required");
    process.exit(2);
}

const SHAKE256_LENGTH = 16;
const h = crypto.createHash("shake256", { outputLength: SHAKE256_LENGTH }).update(PASSWORD_HASH).digest("hex");
const token = jwt.sign({ username: USER, h }, SECRET);

const t0 = Date.now();
const socket = io(TARGET, { transports: ["websocket"], reconnection: false });

socket.on("connect", () => {
    const tConnect = Date.now() - t0;
    console.log(`[+${tConnect} ms] websocket connected`);
    const tLoginStart = Date.now();
    socket.emit("loginByToken", token, (res) => {
        const tLogin = Date.now() - tLoginStart;
        const tTotal = Date.now() - t0;
        console.log(`[+${tTotal} ms] loginByToken callback (server work = ${tLogin} ms): ok=${res?.ok ?? false}${res?.msg ? ` msg=${res.msg}` : ""}`);
        socket.close();
    });
});

socket.on("connect_error", (err) => {
    console.error("connect_error:", err.message);
    process.exit(1);
});

socket.on("disconnect", () => process.exit(0));

setTimeout(() => {
    console.error("TIMEOUT after 90s");
    socket.close();
    process.exit(1);
}, 90000);
