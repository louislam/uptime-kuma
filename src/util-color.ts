// src/util-color.ts
export const colorsEnabled = !process.env.NO_COLOR;

export function colorize(text: string, ansiCode: string): string {
    if (!colorsEnabled) {
        return text;
    }
    return `\x1b[${ansiCode}m${text}\x1b[0m`;
}

export const red = (text: string) => colorize(text, "31");
export const green = (text: string) => colorize(text, "32");
export const yellow = (text: string) => colorize(text, "33");
export const blue = (text: string) => colorize(text, "34");
export const magenta = (text: string) => colorize(text, "35");
export const cyan = (text: string) => colorize(text, "36");
export const bright = (text: string) => colorize(text, "1");
export const dim = (text: string) => colorize(text, "2");
export const underscore = (text: string) => colorize(text, "4");
