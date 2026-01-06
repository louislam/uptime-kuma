class TranslatableError extends Error {
    constructor(key) {
        super(key);
        this.msgi18n = true;
        this.key = key;
        Error.captureStackTrace(this, this.constructor);
    }
}
module.exports = TranslatableError;
