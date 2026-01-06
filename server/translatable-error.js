class TranslatableError extends Error {
    /**
     * Error whose message is a translation key.
     * @augments Error
     */
    /**
     * Create a TranslatableError.
     * @param {string} key - Translation key present in src/lang/en.json
     */
    constructor(key) {
        super(key);
        this.msgi18n = true;
        this.key = key;
        Error.captureStackTrace(this, this.constructor);
    }
}
module.exports = TranslatableError;
