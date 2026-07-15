import { Socket } from "socket.io";
import { needSetup } from "../routers/better-auth-router";

/**
 * For better-auth, or setup
 * @param socket Socket.io
 */
export function betterAuthSocketHandler(socket: Socket): void {
    socket.on("needSetup", async (callback) => {
        callback(await needSetup());
    });
}
