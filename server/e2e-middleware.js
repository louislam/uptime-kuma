const Database = require("./database");
const fs = require("fs");

/**
 * IMPORTANT: This middleware must only be applied when `process.env.NODE_ENV === "e2e"`.
 *
 * This middleware provides supplemental routes for E2E tests to call:
 * /_e2e/take-sqlite-snapshot
 * /_e2e/restore-sqlite-snapshot
 * @param {Request} req Request object
 * @param {Response} res Response object
 * @param {Function} next callable
 * @returns {void}
 */
const e2eMiddleware = async (req, res, next) => {
    // Super important. Ensure the middleware is only added to an e2e test environment.
    if (process.env.NODE_ENV !== "e2e") {
        throw new Error("Expected NODE_ENV=e2e");
    }

    if (req.path === "/_e2e/take-sqlite-snapshot") {
        await Database.close();
        try {
            fs.cpSync(Database.sqlitePath, `${Database.sqlitePath}.e2e-snapshot`);
        } catch (err) {
            throw new Error("Unable to copy SQLite DB.");
        }
        await Database.connect();

        res.send("Snapshot taken.");
        return;
    } else if (req.path === "/_e2e/restore-sqlite-snapshot") {
        if (!fs.existsSync(`${Database.sqlitePath}.e2e-snapshot`)) {
            throw new Error("Snapshot doesn't exist.");
        }

        await Database.close();
        try {
            fs.cpSync(`${Database.sqlitePath}.e2e-snapshot`, Database.sqlitePath);
        } catch (err) {
            throw new Error("Unable to copy snapshot file.");
        }
        await Database.connect();

        res.send("Snapshot restored.");
        return;
    }

    next();
};

module.exports = {
    e2eMiddleware,
};
