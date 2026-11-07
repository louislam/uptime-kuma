type Rgb = readonly number[];

const failureRatioPerStop = 20 / 1440;

/**
 * Interpolate from green to yellow, orange and red in 20-minute daily equivalents.
 * @param {number} failureRatio Share of checks that failed
 * @param {readonly [Rgb, Rgb, Rgb, Rgb]} palette Green, yellow, orange and red RGB channels
 * @returns {string} CSS color for the bucket
 */
export function getHeartbeatSeverityColor(failureRatio: number, palette: readonly [Rgb, Rgb, Rgb, Rgb]): string {
    const position = Math.min(failureRatio / failureRatioPerStop, 3);
    const index = Math.min(Math.floor(position), 2);
    const fraction = position - index;
    const from = palette[index];
    const to = palette[index + 1];
    const rgb = from.map((channel, i) => Math.round(channel + (to[i] - channel) * fraction));
    return `rgb(${rgb.join(", ")})`;
}
