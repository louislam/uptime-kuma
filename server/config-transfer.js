const { R } = require("redbean-node");
const { z } = require("zod");
const { log } = require("../src/util");
const { Notification } = require("./notification");

/**
 * Identifier stored in exported files, so we can detect unknown files early.
 */
const CONFIG_FORMAT = "uptime-kuma-config";

/**
 * Current version of the exported configuration format.
 */
const CONFIG_VERSION = 1;

/**
 * Upper limit of monitors/notifications per import. This is mainly a protection
 * against accidentally selecting a non-Uptime-Kuma file.
 */
const MAX_ITEMS = 5000;

/**
 * Monitor columns that are not part of a monitor's portable configuration:
 * - id/user_id/created_date: instance specific
 * - last_check/dns_last_result: runtime state
 * - parent: exported separately as parentRef
 */
const EXCLUDED_MONITOR_COLUMNS = new Set(["id", "user_id", "created_date", "last_check", "dns_last_result", "parent"]);

/**
 * Monitor columns that reference data which is not part of the export
 * (proxies, docker hosts and remote browsers are instance specific).
 * They are cleared on import, otherwise the insert would point to unrelated data.
 */
const INSTANCE_REFERENCE_COLUMNS = ["proxy_id", "docker_host", "remote_browser"];

const monitorSchema = z.object({
    ref: z.string().min(1).max(128),
    parentRef: z.string().min(1).max(128).nullish(),
    notificationRefs: z.array(z.string().min(1).max(128)).max(MAX_ITEMS).default([]),
    config: z.record(z.string(), z.unknown()),
});

const notificationSchema = z.object({
    ref: z.string().min(1).max(128),
    name: z.string().min(1).max(255),
    // The type is only stored inside the notification config, it can be empty for corrupt rows.
    type: z.string().max(255).default(""),
    isDefault: z.boolean().default(false),
    config: z.record(z.string(), z.unknown()).default({}),
});

const configSchema = z.object({
    format: z.literal(CONFIG_FORMAT),
    version: z.number().int().min(1).max(CONFIG_VERSION),
    appVersion: z.string().max(64).optional(),
    exportedAt: z.string().max(64).optional(),
    monitors: z.array(monitorSchema).max(MAX_ITEMS),
    notifications: z.array(notificationSchema).max(MAX_ITEMS),
});

/**
 * Export and import of all monitors and notification providers.
 *
 * The exported file contains secrets (notification tokens, monitor passwords),
 * so it must be handled like a password database.
 */
class ConfigTransfer {
    /**
     * Export all monitors and notifications as a portable JSON object.
     * @returns {Promise<object>} Export payload
     */
    static async exportConfig() {
        const monitorRows = await R.getAll("SELECT * FROM monitor ORDER BY id");
        const notificationRows = await R.getAll("SELECT * FROM notification ORDER BY id");
        const links = await R.getAll("SELECT monitor_id, notification_id FROM monitor_notification");

        // Use file-local references instead of database ids, so a file can be
        // imported into any instance without id collisions.
        const monitorRefById = new Map();
        monitorRows.forEach((row, index) => {
            monitorRefById.set(row.id, `m${index + 1}`);
        });

        const notificationRefById = new Map();
        notificationRows.forEach((row, index) => {
            notificationRefById.set(row.id, `n${index + 1}`);
        });

        const notificationRefsByMonitor = new Map();
        for (const link of links) {
            const notificationRef = notificationRefById.get(link.notification_id);
            if (!notificationRef) {
                continue;
            }

            if (!notificationRefsByMonitor.has(link.monitor_id)) {
                notificationRefsByMonitor.set(link.monitor_id, []);
            }
            notificationRefsByMonitor.get(link.monitor_id).push(notificationRef);
        }

        const monitors = monitorRows.map((row) => {
            const config = {};
            for (const key of Object.keys(row)) {
                if (EXCLUDED_MONITOR_COLUMNS.has(key)) {
                    continue;
                }
                config[key] = row[key];
            }

            return {
                ref: monitorRefById.get(row.id),
                parentRef: monitorRefById.get(row.parent) ?? null,
                notificationRefs: notificationRefsByMonitor.get(row.id) ?? [],
                config,
            };
        });

        const notifications = notificationRows.map((row) => {
            let parsed = {};
            try {
                parsed = JSON.parse(row.config);
            } catch (e) {
                log.warn("config", `Notification ${row.id} has an invalid config, exporting it without settings`);
            }

            if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
                parsed = {};
            }

            // name/type/isDefault are stored twice, keep the file clean.
            const type = parsed.type;
            const config = {
                ...parsed,
            };
            delete config.name;
            delete config.type;
            delete config.isDefault;
            delete config.applyExisting;

            return {
                ref: notificationRefById.get(row.id),
                name: row.name,
                type: typeof type === "string" ? type : "",
                isDefault: Boolean(row.is_default),
                config,
            };
        });

        return {
            format: CONFIG_FORMAT,
            version: CONFIG_VERSION,
            appVersion: require("../package.json").version,
            exportedAt: new Date().toISOString(),
            monitors,
            notifications,
        };
    }

    /**
     * Validate an import payload and return the normalized data.
     * @param {object|string} payload Parsed JSON object or raw JSON string
     * @returns {object} Validated payload
     * @throws {Error} If the payload is not a valid Uptime Kuma configuration file
     */
    static validatePayload(payload) {
        let data = payload;

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (e) {
                throw new Error("Invalid configuration file: it is not valid JSON");
            }
        }

        if (data === null || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("Invalid configuration file: expected an object");
        }

        const parsed = configSchema.safeParse(data);
        if (!parsed.success) {
            const issue = parsed.error.issues[0];
            const path = issue.path.length > 0 ? issue.path.join(".") : "root";
            throw new Error(`Invalid configuration file: ${path}: ${issue.message}`);
        }

        const result = parsed.data;

        const monitorRefs = new Set();
        for (const monitor of result.monitors) {
            if (monitorRefs.has(monitor.ref)) {
                throw new Error(`Invalid configuration file: duplicate monitor reference "${monitor.ref}"`);
            }
            monitorRefs.add(monitor.ref);
        }

        for (const monitor of result.monitors) {
            if (monitor.parentRef && !monitorRefs.has(monitor.parentRef)) {
                throw new Error(
                    `Invalid configuration file: monitor "${monitor.ref}" references unknown parent "${monitor.parentRef}"`
                );
            }
        }

        // A parent cycle would break the monitor tree (and its recursive helpers)
        const parentByRef = new Map();
        for (const monitor of result.monitors) {
            if (monitor.parentRef) {
                parentByRef.set(monitor.ref, monitor.parentRef);
            }
        }
        for (const monitor of result.monitors) {
            const visited = new Set([monitor.ref]);
            let parentRef = parentByRef.get(monitor.ref);
            while (parentRef) {
                if (visited.has(parentRef)) {
                    throw new Error(`Invalid configuration file: monitor "${monitor.ref}" is part of a parent cycle`);
                }
                visited.add(parentRef);
                parentRef = parentByRef.get(parentRef);
            }
        }

        const notificationRefs = new Set();
        for (const notification of result.notifications) {
            if (notificationRefs.has(notification.ref)) {
                throw new Error(`Invalid configuration file: duplicate notification reference "${notification.ref}"`);
            }
            notificationRefs.add(notification.ref);
        }

        return result;
    }

    /**
     * Import monitors and notifications from a previously exported payload.
     * @param {object|string} payload Export payload
     * @param {object} options Options
     * @param {(number|string|null)} options.userID Owner of the imported monitors/notifications
     * @param {"merge"|"replace"} options.mode "merge" keeps existing data, "replace" deletes all existing monitors/notifications first
     * @returns {Promise<object>} Import summary
     */
    static async importConfig(payload, { userID = null, mode = "merge" } = {}) {
        if (mode !== "merge" && mode !== "replace") {
            throw new Error("Invalid import mode");
        }

        // Validate everything before touching the database, so a broken file can
        // never wipe an existing setup.
        const data = ConfigTransfer.validatePayload(payload);

        const warnings = [];
        const result = {
            monitors: {
                imported: 0,
                skipped: 0,
            },
            notifications: {
                imported: 0,
                skipped: 0,
            },
            importedMonitorIDs: [],
            warnings,
        };

        const monitorColumns = await getMonitorColumns();
        const knownNotificationTypes = Object.keys(Notification.providerList);

        await R.knex.transaction(async (trx) => {
            if (mode === "replace") {
                await trx("monitor_notification").del();
                await trx("monitor").del();
                await trx("notification").del();
            }

            // 1) Notifications
            const notificationIDByRef = new Map();
            for (const item of data.notifications) {
                if (!item.type) {
                    warnings.push(`Notification "${item.name}" has no type and was skipped`);
                    result.notifications.skipped++;
                    continue;
                }

                if (knownNotificationTypes.length > 0 && !knownNotificationTypes.includes(item.type)) {
                    warnings.push(
                        `Notification "${item.name}" uses the unsupported type "${item.type}" and was skipped`
                    );
                    result.notifications.skipped++;
                    continue;
                }

                const [notificationID] = await trx("notification").insert({
                    name: item.name,
                    active: 1,
                    user_id: userID,
                    is_default: item.isDefault ? 1 : 0,
                    config: JSON.stringify({
                        ...item.config,
                        name: item.name,
                        type: item.type,
                        isDefault: Boolean(item.isDefault),
                        applyExisting: false,
                    }),
                });

                notificationIDByRef.set(item.ref, notificationID);
                result.notifications.imported++;
            }

            // 2) Monitors (without parent, it can only be set after all monitors exist)
            const monitorIDByRef = new Map();
            const parentUpdates = [];

            for (const item of data.monitors) {
                const type = item.config.type;
                if (typeof type !== "string" || type === "") {
                    warnings.push(`Monitor "${item.config.name ?? item.ref}" has no type and was skipped`);
                    result.monitors.skipped++;
                    continue;
                }

                const row = {};
                for (const [key, value] of Object.entries(item.config)) {
                    if (!monitorColumns.has(key) || EXCLUDED_MONITOR_COLUMNS.has(key) || value === undefined) {
                        continue;
                    }
                    row[key] = value;
                }
                row.user_id = userID;
                row.parent = null;

                for (const column of INSTANCE_REFERENCE_COLUMNS) {
                    if (row[column] !== undefined && row[column] !== null) {
                        warnings.push(
                            `Monitor "${row.name}" referenced a ${column} that is not part of the export, the reference was cleared`
                        );
                        row[column] = null;
                    }
                }

                const [monitorID] = await trx("monitor").insert(row);
                monitorIDByRef.set(item.ref, monitorID);
                result.importedMonitorIDs.push(monitorID);
                result.monitors.imported++;

                if (item.parentRef) {
                    parentUpdates.push([monitorID, item.parentRef]);
                }
            }

            // 3) Group hierarchy
            for (const [monitorID, parentRef] of parentUpdates) {
                const parentID = monitorIDByRef.get(parentRef);
                if (parentID === undefined) {
                    warnings.push(`Monitor ${monitorID} references a parent that was skipped`);
                    continue;
                }
                await trx("monitor").where({ id: monitorID }).update({ parent: parentID });
            }

            // 4) Monitor <-> notification links
            for (const item of data.monitors) {
                const monitorID = monitorIDByRef.get(item.ref);
                if (monitorID === undefined) {
                    continue;
                }

                for (const ref of new Set(item.notificationRefs)) {
                    const notificationID = notificationIDByRef.get(ref);
                    if (notificationID === undefined) {
                        warnings.push(`Monitor ${monitorID} references a notification that was skipped`);
                        continue;
                    }
                    await trx("monitor_notification").insert({
                        monitor_id: monitorID,
                        notification_id: notificationID,
                    });
                }
            }
        });

        log.info(
            "config",
            `Imported ${result.monitors.imported} monitors and ${result.notifications.imported} notifications (${mode})`
        );

        return result;
    }
}

/**
 * Get all columns of the monitor table for the current database.
 * Used to ignore unknown columns when importing a file from another version.
 * @returns {Promise<Set<string>>} Column names
 */
async function getMonitorColumns() {
    const columnInfo = await R.knex("monitor").columnInfo();
    return new Set(Object.keys(columnInfo));
}

module.exports = ConfigTransfer;
