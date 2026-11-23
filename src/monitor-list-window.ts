/** Height used for a row until the component has measured it */
export const DEFAULT_ROW_HEIGHT = 58;

/** Rows mounted above and below the viewport */
const OVERSCAN = 300;

export interface RowMetrics {
    heights: number[];
    offsets: number[];
    total: number;
}

export interface ListWindow {
    start: number;
    end: number;
    top: number;
    bottom: number;
}

/**
 * Cumulative offsets of the monitor rows, used to window the list.
 * @param ids Monitor ids, in display order
 * @param rowHeights Measured row heights by monitor id
 * @param defaultHeight Height for rows that were not measured yet
 * @returns Row heights, offsets and total height
 */
export function computeRowMetrics(
    ids: Array<number | string>,
    rowHeights: Record<string, number>,
    defaultHeight = DEFAULT_ROW_HEIGHT
): RowMetrics {
    const heights: number[] = [];
    const offsets: number[] = [];
    let total = 0;

    for (const id of ids) {
        offsets.push(total);
        const height = rowHeights[id] ?? defaultHeight;
        heights.push(height);
        total += height;
    }

    return { heights, offsets, total };
}

/**
 * Rows to mount for the current scroll offset, plus the spacer heights that keep
 * the scrollbar proportional to the full list.
 * @param offsets Cumulative row offsets
 * @param heights Row heights
 * @param total Total height of all rows
 * @param scrollTop Current scroll offset
 * @param viewportHeight Visible height (0 falls back to 800)
 * @param overscan Extra pixels mounted above and below the viewport
 * @returns Window bounds and spacer heights
 */
export function computeListWindow(
    offsets: number[],
    heights: number[],
    total: number,
    scrollTop: number,
    viewportHeight: number,
    overscan = OVERSCAN
): ListWindow {
    if (offsets.length === 0) {
        return { start: 0, end: 0, top: 0, bottom: 0 };
    }

    const viewport = viewportHeight || 800;
    const startY = Math.max(0, scrollTop - overscan);
    const endY = scrollTop + viewport + overscan;

    let start = 0;
    while (start < offsets.length - 1 && offsets[start] + heights[start] < startY) {
        start++;
    }

    let end = start;
    while (end < offsets.length && offsets[end] < endY) {
        end++;
    }

    const last = end - 1;

    return {
        start,
        end,
        top: offsets[start],
        bottom: total - (offsets[last] + heights[last]),
    };
}
