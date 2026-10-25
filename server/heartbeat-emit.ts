import { getTotalClientInRoom } from "./util-server";

/**
 * Send a heartbeat to the dashboard, but only when someone is connected.
 * Socket.io still serializes and sends the event for empty rooms, which costs
 * time for thousands of monitors on every beat.
 * @param io Socket server
 * @param userID Room of the monitor owner
 * @param payload Heartbeat payload
 * @returns True when the event was emitted
 */
export function emitHeartbeat(
    io: { to: (room: string | number) => { emit: (event: string, payload: unknown) => unknown } },
    userID: string | number,
    payload: unknown
): boolean {
    if (getTotalClientInRoom(io, userID) <= 0) {
        return false;
    }
    io.to(userID).emit("heartbeat", payload);
    return true;
}
