/** Monitors whose 100-beat history was already requested */
export type RequestedHistory = Set<number>;

/**
 * Claim the history request of a monitor, so concurrent rows emit it only once.
 * @param requested Monitors whose history was already requested
 * @param monitorId Monitor id
 * @returns True when the caller should emit the request
 */
export function claimHeartbeatHistory(requested: RequestedHistory, monitorId: number): boolean {
    if (requested.has(monitorId)) {
        return false;
    }
    requested.add(monitorId);
    return true;
}

/**
 * Release the claim, so a later render can retry (socket not ready, request failed).
 * @param requested Monitors whose history was already requested
 * @param monitorId Monitor id
 * @returns void
 */
export function releaseHeartbeatHistory(requested: RequestedHistory, monitorId: number): void {
    requested.delete(monitorId);
}
