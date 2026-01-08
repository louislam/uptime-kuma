/**
 * Error whose message is a translation key.
 * @augments Error
 */
class TranslatableError extends Error {
    /**
     * Indicates that the error message is a translation key.
     */
    msgi18n = true;

    /**
     * Create a TranslatableError.
     * @param {string} key - Translation key present in src/lang/en.json
     * @param {object} meta Arbitrary metadata
     */
    constructor(key, meta = {}) {
        super(key);
        this.meta = meta;
        Error.captureStackTrace(this, this.constructor);
    }
}
module.exports = TranslatableError;
