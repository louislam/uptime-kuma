import { DOWN, MAINTENANCE, PENDING, UP } from "./util";

export interface BeatStatusEntry {
    text: string;
    color: string;
}

/** Translator signature of the app ($t) */
export type Translate = (key: string) => string;

/**
 * Display text and color for a heartbeat status
 * @param translate Translation function
 * @param beat Latest heartbeat, if any
 * @returns Status entry for the dashboard
 */
export function beatStatusEntry(translate: Translate, beat: { status?: number } | undefined): BeatStatusEntry {
    if (!beat) {
        return { text: translate("Unknown"), color: "secondary" };
    }

    switch (beat.status) {
        case UP:
            return { text: translate("Up"), color: "primary" };
        case DOWN:
            return { text: translate("Down"), color: "danger" };
        case PENDING:
            return { text: translate("Pending"), color: "warning" };
        case MAINTENANCE:
            return { text: translate("statusMaintenance"), color: "maintenance" };
        default:
            return { text: translate("Unknown"), color: "secondary" };
    }
}

/** Reactive containers the socket mixin updates per beat */
export interface BeatState {
    lastHeartbeatList: Record<number, unknown>;
    statusList: Record<number, BeatStatusEntry>;
    lastBeatRaw: Record<number, unknown>;
}

/**
 * Store the newest beat of a monitor, in place, so a beat stays O(1)
 * @param state Mixin state
 * @param monitorID Monitor id
 * @param beat Latest heartbeat
 * @param entry Display status for the heartbeat
 * @returns void
 */
export function applyBeat(state: BeatState, monitorID: number, beat: unknown, entry: BeatStatusEntry): void {
    state.lastHeartbeatList[monitorID] = beat;
    state.statusList[monitorID] = entry;
    state.lastBeatRaw[monitorID] = beat;
}

/**
 * Store the latest-beat payload without shrinking a history that loaded first.
 * @param heartbeatList Heartbeats per monitor
 * @param monitorID Monitor id
 * @param beats Latest beats from the server
 * @returns void
 */
export function applyLatestBeats(
    heartbeatList: Record<number | string, unknown[]>,
    monitorID: number | string,
    beats: unknown[]
): void {
    const current = heartbeatList[monitorID];
    if (current && current.length > beats.length) {
        return;
    }
    heartbeatList[monitorID] = beats;
}
