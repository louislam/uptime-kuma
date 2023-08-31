const { ArrayWithKey } = require("./array-with-key");

/**
 * Limit Queue
 * The first element will be removed when the length exceeds the limit
 */
class LimitQueue extends ArrayWithKey {

    __limit;
    __onExceed = null;

    /**
     * @param {number} limit
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
