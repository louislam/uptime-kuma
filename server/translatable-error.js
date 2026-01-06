class TranslatableError extends Error {
    /**
     * @param key
     */
    constructor(key) {
        super(key);
        this.msgi18n = true;
        this.key = key;
        Error.captureStackTrace(this, this.constructor);
    }
}
module.exports = TranslatableError;
