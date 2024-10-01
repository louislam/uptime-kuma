/**
 * Logs a step message to the console with a specific format.
 *
 * This function is primarily used for debugging or tracking the flow of execution
 * in an application. It outputs a message prefixed with a flag emoji to indicate
 * the current step being executed.
 * @param {string} text - The message to log, indicating the current step.
 * @returns {void} Indicates that this function does not return a value.
 */
export function step(text) {
    console.log(`🚩 STEP: ${text}`);
}
