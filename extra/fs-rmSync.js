const fs = require("fs");
/**
 * Detect if `fs.rmSync` is available
 * to avoid the runtime warning triggered for using `fs.rmdirSync` with `{ recursive: true }` in Node.js v16,
 * or the `recursive` property removing completely in the future Node.js version.
 * See the link below.
 * @link https://nodejs.org/docs/latest-v16.x/api/deprecations.html#dep0147-fsrmdirpath--recursive-true-
 * @param {fs.PathLike} path Valid types for path values in "fs".
 * @param {fs.RmDirOptions} [options] options for `fs.rmdirSync`, if `fs.rmSync` is available and property `recursive` is true, it will automatically have property `force` with value `true`.
 */
const rmSync = (path, options) => {
    if (typeof fs.rmSync === "function") {
        if (options.recursive) {
            options.force = true;
        }
        return fs.rmSync(path, options);
    }
    return fs.rmdirSync(path, options);
};
module.exports = rmSync;
