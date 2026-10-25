export interface CompactPreloadData {
    paths: Map<number, string[]>;
    activeStatus: Map<number, boolean>;
    childrenIDs: Map<number, number[]>;
    tags: Map<number, unknown[]>;
}

export interface CompactMonitor {
    id: number;
    name: string;
    type: string;
    active: boolean | undefined;
    parent: number | null;
    childrenIDs: number[];
    tags: unknown[];
    path: string[];
    pathName: string;
    interval: number;
    weight: number | null;
}

/**
 * Fields the dashboard needs for one monitor. toJSON() builds ~60 fields per
 * monitor, which costs over a second for thousands of monitors at login.
 * @param monitor Monitor bean
 * @param preloadData Data prepared for the whole list
 * @returns Slim monitor payload
 */
export function toCompactMonitor(
    monitor: {
        id: number;
        name: string;
        type: string;
        parent?: number | null;
        interval: number;
        weight?: number | null;
    },
    preloadData: CompactPreloadData
): CompactMonitor {
    const path = preloadData.paths.get(monitor.id) || [];

    return {
        id: monitor.id,
        name: monitor.name,
        type: monitor.type,
        active: preloadData.activeStatus.get(monitor.id),
        parent: monitor.parent ?? null,
        childrenIDs: preloadData.childrenIDs.get(monitor.id) || [],
        tags: preloadData.tags.get(monitor.id) || [],
        path,
        pathName: path.join(" / "),
        interval: monitor.interval,
        weight: monitor.weight ?? null,
    };
}
