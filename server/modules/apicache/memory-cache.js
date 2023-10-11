function MemoryCache() {
    this.cache = {};
    this.size = 0;
}

/**
 * 
 * @param {string} key Key to store cache as
 * @param {any} value Value to store
 * @param {number} time Time to store for
 * @param {function(any, string)} timeoutCallback Callback to call in
 * case of timeout
 * @returns {Object}
 */
MemoryCache.prototype.add = function (key, value, time, timeoutCallback) {
    let old = this.cache[key];
    let instance = this;

    let entry = {
        value: value,
        expire: time + Date.now(),
        timeout: setTimeout(function () {
            instance.delete(key);
            return timeoutCallback && typeof timeoutCallback === "function" && timeoutCallback(value, key);
        }, time)
    };

    this.cache[key] = entry;
    this.size = Object.keys(this.cache).length;

    return entry;
};

/**
 * Delete a cache entry
 * @param {string} key Key to delete
 * @returns {null}
 */
MemoryCache.prototype.delete = function (key) {
    let entry = this.cache[key];

    if (entry) {
        clearTimeout(entry.timeout);
    }

    delete this.cache[key];

    this.size = Object.keys(this.cache).length;

    return null;
};

/**
 * Get value of key
 * @param {string} key 
 * @returns {Object}
 */
MemoryCache.prototype.get = function (key) {
    let entry = this.cache[key];

    return entry;
};

/**
 * Get value of cache entry
 * @param {string} key 
 * @returns {any}
 */
MemoryCache.prototype.getValue = function (key) {
    let entry = this.get(key);

    return entry && entry.value;
};

/**
 * Clear cache
 * @returns {boolean}
 */
MemoryCache.prototype.clear = function () {
    Object.keys(this.cache).forEach(function (key) {
        this.delete(key);
    }, this);

    return true;
};

module.exports = MemoryCache;
