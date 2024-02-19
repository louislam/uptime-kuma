/**
 * An object that can be used as an array with a key
 * Like PHP's array
 * @template K
 * @template V
 */
class ArrayWithKey {
    /**
     * All keys that are stored in the current object
     * @type {K[]}
     * @private
     */
    __stack = [];

    /**
     * Push an element to the end of the array
     * @param {K} key The key of the element
     * @param {V} value The value of the element
     * @returns {void}
     */
    push(key, value) {
        this[key] = value;
        this.__stack.push(key);
    }

    /**
     * Get the last element and remove it from the array
     * @returns {V|undefined} The first value, or undefined if there is no element to pop
     */
    pop() {
        let key = this.__stack.pop();
        let prop = this[key];
        delete this[key];
        return prop;
    }

    /**
     * Get the last key
     * @returns {K|null} The last key, or null if the array is empty
     */
    getLastKey() {
        if (this.__stack.length === 0) {
            return null;
        }
        return this.__stack[this.__stack.length - 1];
    }

    /**
     * Get the first element
     * @returns {{key:K,value:V}|null} The first element, or null if the array is empty
     */
    shift() {
        let key = this.__stack.shift();
        let value = this[key];
        delete this[key];
        return {
            key,
            value,
        };
    }

    /**
     * Get the length of the array
     * @returns {number} Amount of elements stored
     */
    length() {
        return this.__stack.length;
    }

    /**
     * Get the last value
     * @returns {V|null} The last element without removing it, or null if the array is empty
     */
    last() {
        let key = this.getLastKey();
        if (key === null) {
            return null;
        }
        return this[key];
    }
}

module.exports = {
    ArrayWithKey
};
