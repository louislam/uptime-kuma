import { io } from "socket.io-client";

const TARGET = process.env.KUMA_URL || "http://127.0.0.1:3011";
const USER = process.env.KUMA_USER || "Admin";
const PASS = process.env.KUMA_PASS;

if (!PASS) {
    console.error("KUMA_PASS env var is required");
    process.exit(2);
}

const t0 = Date.now();
const socket = io(TARGET, {
    transports: ["websocket"],
    reconnection: false,
});

socket.on("connect", () => {
    const tConnect = Date.now() - t0;
    console.log(`[+${tConnect} ms] websocket connected`);

    const tLoginStart = Date.now();
    socket.emit("login", { username: USER, password: PASS, token: "" }, (res) => {
        const tLogin = Date.now() - tLoginStart;
        const tTotal = Date.now() - t0;
        console.log(`[+${tTotal} ms] login callback (server work = ${tLogin} ms): ok=${res?.ok} tokenSet=${!!res?.token}`);
        socket.close();
    });
});

socket.on("connect_error", (err) => {
    console.error("connect_error:", err.message);
    process.exit(1);
});

setTimeout(() => {
    console.error("TIMEOUT after 90s");
    socket.close();
    process.exit(1);
}, 90000);
