const { ArrayWithKey } = require("./array-with-key");

/**
 * Limit Queue
 * The first element will be removed when the length exceeds the limit
 */
class LimitQueue extends ArrayWithKey {

    /**
     * The limit of the queue after which the first element will be removed
     * @private
     * @type {number}
     */
    __limit;
    /**
     * The callback function when the queue exceeds the limit
     * @private
     * @callback onExceedCallback
     * @param {{key:K,value:V}|nul} item
     */
    __onExceed = null;

    /**
     * @param {number} limit The limit of the queue after which the first element will be removed
     */
    constructor(limit) {
        super();
        this.__limit = limit;
    }

    /**
     * @inheritDoc
     */
    push(key, value) {
        super.push(key, value);
        if (this.length() > this.__limit) {
            let item = this.shift();
            if (this.__onExceed) {
                this.__onExceed(item);
            }
        }
    }

}

module.exports = {
    LimitQueue
};
