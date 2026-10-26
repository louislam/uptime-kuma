import { getTotalClientInRoom } from "./util-server";

/**
 * Room every logged-in socket joins; v3 has a single dashboard.
 */
export const socketRoom = "dashboard";

/**
 * Send a heartbeat to the dashboard, but only when someone is connected.
 * Socket.io still serializes and sends the event for empty rooms, which costs
 * time for thousands of monitors on every beat.
 * @param io Socket server
 * @param payload Heartbeat payload
 * @returns True when the event was emitted
 */
export function emitHeartbeat(
    io: { to: (room: string) => { emit: (event: string, payload: unknown) => unknown } },
    payload: unknown
): boolean {
    if (getTotalClientInRoom(io, socketRoom) <= 0) {
        return false;
    }
    io.to(socketRoom).emit("heartbeat", payload);
    return true;
}
