/**
 * Split a list into batches of at most `size` items
 * @param items Items to split
 * @param size Maximum batch size
 * @returns Batches, in order
 */
export function chunk<T>(items: T[], size: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
        batches.push(items.slice(i, i + size));
    }
    return batches;
}

/**
 * Delay before the first check of a monitor, spread over its interval so a
 * server start does not check all monitors in the same second.
 * @param intervalSeconds Monitor interval in seconds
 * @param random Random source (tests)
 * @returns Delay in milliseconds, between 0 and the interval
 */
export function firstBeatDelayMs(intervalSeconds: number, random: () => number = Math.random): number {
    const max = Math.max(1, intervalSeconds) * 1000;
    // Same bounds as getRandomInt(0, max), which is inclusive; clamped for random() === 1
    return Math.min(max, Math.floor(random() * (max + 1)));
}
