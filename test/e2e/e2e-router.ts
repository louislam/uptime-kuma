import express from "express";
import fs from "node:fs";
import { randomBytes } from "node:crypto";
import { R } from "redbean-node";
import * as Database from "../../server/database.js";
import { auth } from "../../server/better-auth";
import { MonitorStats } from "../../server/monitor-stats";
import { Settings } from "../../server/settings";
import passwordHash from "../../server/password-hash";

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

    // Settings read before the restore must not survive the database swap
    Settings.deleteCache(Object.keys(Settings.cacheList));

    // Cached stats belong to the database that was just replaced
    MonitorStats.cache.clear();
    MonitorStats.windows.clear();
    MonitorStats.lastRefresh = 0;

    response.send("Snapshot restored.");
});

e2eRouter.post("/_e2e/add-legacy-api-key", async (request, response) => {
    try {
        const name = request.body?.name || "e2e-legacy-key";
        const clearKey = randomBytes(8).toString("hex");
        // api_key.user_id references better_auth_user, which is empty until the admin is migrated
        const userID = (await R.getRow("SELECT id FROM better_auth_user LIMIT 1"))?.id ?? null;

        const apiKey = R.dispense("api_key");
        apiKey.key = await passwordHash.generate(clearKey);
        apiKey.name = name;
        apiKey.user_id = userID;
        apiKey.active = request.body?.active ?? 1;
        apiKey.expires = null;
        await R.store(apiKey);

        response.json({
            ok: true,
            id: apiKey.id,
            // The format 2.x used: uk<id>_<clear>
            key: `uk${apiKey.id}_${clearKey}`,
        });
    } catch (error) {
        response.status(500).json({
            ok: false,
            msg: error.message,
        });
    }
});
