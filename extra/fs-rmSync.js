const fs = require("fs");
/**
 * Detect if `fs.rmSync` is available
 * to avoid the runtime deprecation warning triggered for using `fs.rmdirSync` with `{ recursive: true }` in Node.js v16,
 * or the `recursive` property removing completely in the future Node.js version.
 * See the link below.
 *
 * @todo Once we drop the support for Node.js v14 (or at least versions before v14.14.0), we can safely replace this function with `fs.rmSync`, since `fs.rmSync` was add in Node.js v14.14.0 and currently we supports all the Node.js v14 versions that include the versions before the v14.14.0, and this function have almost the same signature with `fs.rmSync`.
 * @link https://nodejs.org/docs/latest-v16.x/api/deprecations.html#dep0147-fsrmdirpath--recursive-true- the deprecation infomation of `fs.rmdirSync`
 * @link https://nodejs.org/docs/latest-v16.x/api/fs.html#fsrmsyncpath-options the document of `fs.rmSync`
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
