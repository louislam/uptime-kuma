const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");
const dayjs = require("dayjs");
dayjs.extend(require("dayjs/plugin/utc"));
const { log } = require("../../src/util");

const VALID_TYPES = [ "maintenance", "incident" ];
const MAX_TITLE_LENGTH = 255;
const MAX_CONTENT_LENGTH = 20000;

class GroupLogEntry extends BeanModel {
    /**
     * Return an object ready to parse to JSON for public consumption
     * @returns {object} Object ready to parse
     */
    toPublicJSON() {
        return {
            id: this.id,
            type: this.type,
            title: this.title,
            content: this.content,
            createdDate: this.created_date,
            updatedDate: this.updated_date,
        };
    }

    /**
     * List a public group's log entries, most recent first.
     * Returns an empty list if the group doesn't exist or isn't public -
     * anti-enumeration, consistent with the rest of the public endpoints.
     * @param {number} groupId Group id
     * @returns {Promise<object[]>} Public log entries
     */
    static async listPublicByGroup(groupId) {
        const group = await R.findOne("group", " id = ? AND public = 1 ", [parseInt(groupId, 10)]);
        if (!group) {
            return [];
        }

        // Secondary sort by id breaks ties for entries created within the
        // same second (created_date has only second-level precision), so
        // insertion order is still preserved for near-simultaneous entries.
        const rows = await R.getAll(
            "SELECT id, type, title, content, created_date, updated_date FROM group_log_entry WHERE group_id = ? ORDER BY created_date DESC, id DESC LIMIT 200",
            [group.id]
        );

        return rows.map((row) => ({
            id: row.id,
            type: row.type,
            title: row.title,
            content: row.content,
            createdDate: row.created_date,
            updatedDate: row.updated_date,
        }));
    }

    /**
     * Create a new log entry. This is authenticated admin input, so
     * validation failures throw directly (unlike the public subscribe flow,
     * which never surfaces distinguishing errors).
     * @param {object} data Entry data
     * @param {number} data.groupId Group the entry belongs to
     * @param {string} data.type "maintenance" or "incident"
     * @param {string} data.title Entry title
     * @param {string} data.content Entry content (markdown)
     * @param {string} data.source "manual" (default) or "auto"
     * @param {number|null} data.sourceMaintenanceId Originating maintenance id, if auto-generated
     * @param {number|null} data.sourceIncidentId Originating incident id, if auto-generated
     * @returns {Promise<GroupLogEntry>} The created bean
     * @throws {Error} If validation fails
     */
    static async create({
        groupId,
        type,
        title,
        content,
        source = "manual",
        sourceMaintenanceId = null,
        sourceIncidentId = null,
    }) {
        GroupLogEntry._validate(type, title, content);

        const bean = R.dispense("group_log_entry");
        bean.group_id = groupId;
        bean.type = type;
        bean.source = source;
        bean.title = title.trim();
        bean.content = content.trim();
        bean.source_maintenance_id = sourceMaintenanceId;
        bean.source_incident_id = sourceIncidentId;
        bean.created_date = R.isoDateTime(dayjs.utc());

        await R.store(bean);
        return bean;
    }

    /**
     * Update a log entry's editable fields, scoped to the group it belongs
     * to (defense in depth against cross-group tampering).
     * @param {number} id Entry id
     * @param {number} groupId Group the entry must belong to
     * @param {object} data Fields to update
     * @param {string} data.title New title
     * @param {string} data.content New content
     * @param {string} data.type New type
     * @returns {Promise<GroupLogEntry>} The updated bean
     * @throws {Error} If validation fails or the entry isn't found
     */
    static async update(id, groupId, { title, content, type }) {
        GroupLogEntry._validate(type, title, content);

        const bean = await R.findOne("group_log_entry", " id = ? AND group_id = ? ", [id, groupId]);
        if (!bean) {
            throw new Error("Log entry not found");
        }

        bean.title = title.trim();
        bean.content = content.trim();
        bean.type = type;
        bean.updated_date = R.isoDateTime(dayjs.utc());

        await R.store(bean);
        return bean;
    }

    /**
     * Remove a log entry, scoped to the group it belongs to.
     * @param {number} id Entry id
     * @param {number} groupId Group the entry must belong to
     * @returns {Promise<void>}
     */
    static async remove(id, groupId) {
        await R.exec("DELETE FROM group_log_entry WHERE id = ? AND group_id = ?", [id, groupId]);
    }

    /**
     * Auto-create a log entry on every public group of a status page when a
     * new incident is posted. Never throws - a failure here must not break
     * the admin's post-incident action, mirroring notifyIncidentSubscribers.
     * @param {number} statusPageId Status page the incident belongs to
     * @param {object} incidentBean The newly posted incident
     * @returns {Promise<void>}
     */
    static async createAutoEntriesForIncident(statusPageId, incidentBean) {
        try {
            const groups = await R.getAll("SELECT id FROM `group` WHERE status_page_id = ? AND public = 1", [
                statusPageId,
            ]);

            for (const g of groups) {
                try {
                    await GroupLogEntry.create({
                        groupId: g.id,
                        type: "incident",
                        source: "auto",
                        title: incidentBean.title,
                        content: incidentBean.content,
                        sourceIncidentId: incidentBean.id,
                    });
                } catch (e) {
                    log.error("group-log-entry", `Failed to create auto log entry for group ${g.id}: ${e.message}`);
                }
            }
        } catch (e) {
            log.error("group-log-entry", "Failed to create auto log entries for incident");
            log.error("group-log-entry", e);
        }
    }

    /**
     * Auto-create a log entry on every distinct public group a maintenance's
     * monitors belong to. Never throws - a failure here must not break the
     * admin's maintenance save.
     * @param {object} maintenanceBean The maintenance that was scheduled
     * @param {number[]} monitorIds Ids of monitors attached to the maintenance
     * @returns {Promise<void>}
     */
    static async createAutoEntriesForMaintenance(maintenanceBean, monitorIds) {
        try {
            if (!monitorIds || monitorIds.length === 0) {
                return;
            }

            const placeholders = monitorIds.map(() => "?").join(",");
            const groups = await R.getAll(
                `SELECT DISTINCT g.id AS id
                 FROM monitor_group mg
                 JOIN \`group\` g ON mg.group_id = g.id
                 WHERE mg.monitor_id IN (${placeholders}) AND g.public = 1`,
                monitorIds
            );

            for (const g of groups) {
                try {
                    await GroupLogEntry.create({
                        groupId: g.id,
                        type: "maintenance",
                        source: "auto",
                        title: maintenanceBean.title,
                        content: maintenanceBean.description?.trim() || "Maintenance scheduled.",
                        sourceMaintenanceId: maintenanceBean.id,
                    });
                } catch (e) {
                    log.error("group-log-entry", `Failed to create auto log entry for group ${g.id}: ${e.message}`);
                }
            }
        } catch (e) {
            log.error("group-log-entry", "Failed to create auto log entries for maintenance");
            log.error("group-log-entry", e);
        }
    }

    /**
     * Validate log entry fields, throwing a descriptive error for the first
     * problem found. Used for authenticated admin input only.
     * @param {string} type Entry type
     * @param {string} title Entry title
     * @param {string} content Entry content
     * @returns {void}
     * @throws {Error} If any field is invalid
     */
    static _validate(type, title, content) {
        if (!VALID_TYPES.includes(type)) {
            throw new Error("Invalid log entry type");
        }
        if (typeof title !== "string" || title.trim().length === 0) {
            throw new Error("Title is required");
        }
        if (title.trim().length > MAX_TITLE_LENGTH) {
            throw new Error(`Title must be ${MAX_TITLE_LENGTH} characters or fewer`);
        }
        if (typeof content !== "string" || content.trim().length === 0) {
            throw new Error("Content is required");
        }
        if (content.trim().length > MAX_CONTENT_LENGTH) {
            throw new Error(`Content must be ${MAX_CONTENT_LENGTH} characters or fewer`);
        }
    }
}

module.exports = GroupLogEntry;
