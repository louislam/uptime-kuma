// src/util-color.js
/**
 * Color output utility that respects NO_COLOR environment variable
 * https://no-color.org/
 */

const colorsEnabled = !process.env.NO_COLOR;

/**
 * Wrap text with ANSI color codes if colors are enabled
 * @param {string} text - The text to colorize
 * @param {string} ansiCode - The ANSI escape code (without the \x1b prefix)
 * @returns {string} - Colorized or plain text
 */
function colorize(text, ansiCode) {
    if (!colorsEnabled) {
        return text;
    }
    return `\x1b[${ansiCode}m${text}\x1b[0m`;
}

// Export convenience functions for common colors
module.exports = {
    colorsEnabled,
    colorize,
    red: (text) => colorize(text, "31"),
    green: (text) => colorize(text, "32"),
    yellow: (text) => colorize(text, "33"),
    blue: (text) => colorize(text, "34"),
    magenta: (text) => colorize(text, "35"),
    cyan: (text) => colorize(text, "36"),
    bright: (text) => colorize(text, "1"),
    dim: (text) => colorize(text, "2"),
    underscore: (text) => colorize(text, "4"),
};
