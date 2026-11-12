import express from "express";
import fs from "node:fs";
import { R } from "redbean-node";
import * as Database from "../../server/database.js";
import { auth } from "../../server/better-auth";
import { MonitorStats } from "../../server/monitor-stats";

export const e2eRouter = express.Router();

e2eRouter.get("/_e2e/take-sqlite-snapshot", async (request, response) => {
    // Checkpoint WAL to flush all data to the main .db file, then copy.
    // No close/reopen needed — the file is consistent after checkpoint.
    await R.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    fs.cpSync(Database.sqlitePath, `${Database.sqlitePath}.e2e-snapshot`);
    response.send("Snapshot taken.");
});

e2eRouter.get("/_e2e/restore-sqlite-snapshot", async (request, response) => {
    if (!fs.existsSync(`${Database.sqlitePath}.e2e-snapshot`)) {
        throw new Error("Snapshot doesn't exist.");
    }

    await Database.close();
    try {
        fs.cpSync(`${Database.sqlitePath}.e2e-snapshot`, Database.sqlitePath);
    } catch {
        throw new Error("Unable to copy snapshot file.");
    }
    await Database.connect();
    // Rebuild better-auth for the reopened database connection
    auth(true);

    // Cached stats belong to the database that was just replaced
    MonitorStats.cache.clear();
    MonitorStats.windows.clear();
    MonitorStats.lastRefresh = 0;

    response.send("Snapshot restored.");
});
