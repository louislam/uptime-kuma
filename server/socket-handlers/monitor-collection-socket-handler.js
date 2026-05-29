const { checkLogin, isAdmin, getAccessibleMonitorIDs, canAccessMonitor } = require("../util-server");
const { R } = require("redbean-node");
const { log } = require("../../src/util");
const { PERMISSIONS } = require("../permissions");

async function requireAdmin(socket) {
    checkLogin(socket);
    if (!(await isAdmin(socket.userID))) {
        throw new Error("Requires admin privileges.");
    }
}

/**
 * Returns true if the user can manage (edit) the given collection.
 * Admins always can; non-admins need the MANAGE_MONITOR_COLLECTIONS permission
 * AND must be in a user group that owns the collection.
 * @param {object} socket
 * @param {number} collectionID
 * @returns {Promise<boolean>}
 */
async function canManageCollection(socket, collectionID) {
    if (await isAdmin(socket.userID)) {
        return true;
    }
    const row = await R.getRow(
        `SELECT cug.id
         FROM monitor_collection_user_group cug
         INNER JOIN user_group_member ugm ON ugm.group_id = cug.group_id
         INNER JOIN user_group_permission ugp ON ugp.group_id = ugm.group_id
         WHERE ugm.user_id = ? AND cug.collection_id = ? AND ugp.permission = ?`,
        [socket.userID, collectionID, PERMISSIONS.MANAGE_MONITOR_COLLECTIONS]
    );
    return !!row;
}

/**
 * Notify all sockets belonging to affected users to reload their monitor list
 * and re-join per-monitor rooms. Emits recomputeAccessibleMonitors.
 * @param {Server} io
 * @param {number} collectionID
 */
async function notifyAffectedUsers(io, collectionID) {
    const rows = await R.getAll(
        `SELECT DISTINCT ugm.user_id FROM user_group_member ugm
         INNER JOIN monitor_collection_user_group cug ON cug.group_id = ugm.group_id
         WHERE cug.collection_id = ?`,
        [collectionID]
    );
    for (const { user_id } of rows) {
        io.to(user_id).emit("recomputeAccessibleMonitors");
    }
}

module.exports.monitorCollectionSocketHandler = (socket, io) => {

    socket.on("getMonitorCollectionMap", async (callback) => {
        try {
            checkLogin(socket);
            // Returns { monitorID: [collectionName, ...] } for all monitors the user can see
            let rows;
            if (await isAdmin(socket.userID)) {
                rows = await R.getAll(
                    `SELECT cm.monitor_id, c.name
                     FROM monitor_collection_monitor cm
                     INNER JOIN monitor_collection c ON c.id = cm.collection_id`
                );
            } else {
                rows = await R.getAll(
                    `SELECT cm.monitor_id, c.name
                     FROM monitor_collection_monitor cm
                     INNER JOIN monitor_collection c ON c.id = cm.collection_id
                     INNER JOIN monitor_collection_user_group cug ON cug.collection_id = c.id
                     INNER JOIN user_group_member ugm ON ugm.group_id = cug.group_id
                     WHERE ugm.user_id = ?`,
                    [socket.userID]
                );
            }
            const map = {};
            for (const { monitor_id, name } of rows) {
                if (!map[monitor_id]) {
                    map[monitor_id] = [];
                }
                map[monitor_id].push(name);
            }
            callback({ ok: true, map });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("getMonitorCollections", async (callback) => {
        try {
            checkLogin(socket);
            let rows;
            if (await isAdmin(socket.userID)) {
                rows = await R.getAll(
                    `SELECT c.*,
                        (SELECT COUNT(*) FROM monitor_collection_monitor WHERE collection_id = c.id) AS monitorCount,
                        (SELECT COUNT(*) FROM monitor_collection_user_group WHERE collection_id = c.id) AS groupCount
                     FROM monitor_collection c
                     ORDER BY c.name`
                );
            } else {
                rows = await R.getAll(
                    `SELECT DISTINCT c.*,
                        (SELECT COUNT(*) FROM monitor_collection_monitor WHERE collection_id = c.id) AS monitorCount,
                        (SELECT COUNT(*) FROM monitor_collection_user_group WHERE collection_id = c.id) AS groupCount
                     FROM monitor_collection c
                     INNER JOIN monitor_collection_user_group cug ON cug.collection_id = c.id
                     INNER JOIN user_group_member ugm ON ugm.group_id = cug.group_id
                     WHERE ugm.user_id = ?
                     ORDER BY c.name`,
                    [socket.userID]
                );
            }
            callback({ ok: true, collections: rows });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("addMonitorCollection", async ({ name, description }, callback) => {
        try {
            await requireAdmin(socket);
            const bean = R.dispense("monitor_collection");
            bean.name = name;
            bean.description = description || null;
            bean.created_by = socket.userID;
            const id = await R.store(bean);
            log.info("monitor-collection", `Created collection "${name}" (ID ${id}) by user ${socket.userID}`);
            callback({ ok: true, id });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("editMonitorCollection", async ({ id, name, description }, callback) => {
        try {
            checkLogin(socket);
            if (!(await canManageCollection(socket, id))) {
                throw new Error("Permission denied.");
            }
            await R.exec(
                "UPDATE monitor_collection SET name = ?, description = ? WHERE id = ?",
                [name, description || null, id]
            );
            log.info("monitor-collection", `Edited collection ID ${id} by user ${socket.userID}`);
            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("deleteMonitorCollection", async (collectionID, callback) => {
        try {
            await requireAdmin(socket);
            await notifyAffectedUsers(io, collectionID);
            await R.exec("DELETE FROM monitor_collection WHERE id = ?", [collectionID]);
            log.info("monitor-collection", `Deleted collection ID ${collectionID} by user ${socket.userID}`);
            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("getCollectionMonitors", async (collectionID, callback) => {
        try {
            checkLogin(socket);
            if (!(await canManageCollection(socket, collectionID))) {
                throw new Error("Permission denied.");
            }
            const rows = await R.getAll(
                `SELECT m.id, m.name, m.active FROM monitor m
                 INNER JOIN monitor_collection_monitor cm ON cm.monitor_id = m.id
                 WHERE cm.collection_id = ?
                 ORDER BY m.name`,
                [collectionID]
            );
            callback({ ok: true, monitors: rows });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("addMonitorToCollection", async ({ collectionID, monitorID }, callback) => {
        try {
            checkLogin(socket);
            if (!(await canManageCollection(socket, collectionID))) {
                throw new Error("Permission denied.");
            }
            await R.knex("monitor_collection_monitor")
                .insert({ collection_id: collectionID, monitor_id: monitorID })
                .onConflict(["collection_id", "monitor_id"]).ignore();
            await notifyAffectedUsers(io, collectionID);
            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("removeMonitorFromCollection", async ({ collectionID, monitorID }, callback) => {
        try {
            checkLogin(socket);
            if (!(await canManageCollection(socket, collectionID))) {
                throw new Error("Permission denied.");
            }
            await R.exec(
                "DELETE FROM monitor_collection_monitor WHERE collection_id = ? AND monitor_id = ?",
                [collectionID, monitorID]
            );
            await notifyAffectedUsers(io, collectionID);
            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("setCollectionMonitors", async ({ collectionID, monitorIDs }, callback) => {
        try {
            checkLogin(socket);
            if (!(await canManageCollection(socket, collectionID))) {
                throw new Error("Permission denied.");
            }
            await R.exec("DELETE FROM monitor_collection_monitor WHERE collection_id = ?", [collectionID]);
            if (monitorIDs && monitorIDs.length > 0) {
                const rows = monitorIDs.map((mid) => ({ collection_id: collectionID, monitor_id: mid }));
                await R.knex("monitor_collection_monitor").insert(rows).onConflict(["collection_id", "monitor_id"]).ignore();
            }
            await notifyAffectedUsers(io, collectionID);
            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("getCollectionUserGroups", async (collectionID, callback) => {
        try {
            await requireAdmin(socket);
            const rows = await R.getAll(
                `SELECT ug.id, ug.name FROM user_group ug
                 INNER JOIN monitor_collection_user_group cug ON cug.group_id = ug.id
                 WHERE cug.collection_id = ?
                 ORDER BY ug.name`,
                [collectionID]
            );
            callback({ ok: true, groups: rows });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("setCollectionUserGroups", async ({ collectionID, groupIDs }, callback) => {
        try {
            await requireAdmin(socket);
            await R.exec("DELETE FROM monitor_collection_user_group WHERE collection_id = ?", [collectionID]);
            if (groupIDs && groupIDs.length > 0) {
                const rows = groupIDs.map((gid) => ({ collection_id: collectionID, group_id: gid }));
                await R.knex("monitor_collection_user_group").insert(rows).onConflict(["collection_id", "group_id"]).ignore();
            }
            await notifyAffectedUsers(io, collectionID);
            log.info("monitor-collection", `Set user groups for collection ID ${collectionID} by user ${socket.userID}`);
            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("getMonitorCollectionMembership", async (monitorID, callback) => {
        try {
            checkLogin(socket);
            const monitor = await R.findOne("monitor", " id = ? ", [monitorID]);
            const isCreator = monitor && monitor.user_id === socket.userID;
            if (!isCreator && !(await canAccessMonitor(socket.userID, monitorID))) {
                throw new Error("You do not have access to this monitor.");
            }
            const rows = await R.getAll(
                "SELECT collection_id FROM monitor_collection_monitor WHERE monitor_id = ?",
                [monitorID]
            );
            callback({ ok: true, collectionIDs: rows.map((r) => r.collection_id) });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

    socket.on("setMonitorCollections", async ({ monitorID, collectionIDs }, callback) => {
        try {
            checkLogin(socket);
            // Allow the creator to assign collections even before the monitor is in any collection
            const monitor = await R.findOne("monitor", " id = ? ", [monitorID]);
            const isCreator = monitor && monitor.user_id === socket.userID;
            if (!isCreator && !(await canAccessMonitor(socket.userID, monitorID))) {
                throw new Error("You do not have access to this monitor.");
            }
            // Verify manage permission on each target collection
            for (const cid of (collectionIDs || [])) {
                if (!(await canManageCollection(socket, cid))) {
                    throw new Error(`Permission denied for collection ${cid}.`);
                }
            }
            await R.exec("DELETE FROM monitor_collection_monitor WHERE monitor_id = ?", [monitorID]);
            if (collectionIDs && collectionIDs.length > 0) {
                const rows = collectionIDs.map((cid) => ({ collection_id: cid, monitor_id: monitorID }));
                await R.knex("monitor_collection_monitor").insert(rows).onConflict(["collection_id", "monitor_id"]).ignore();
            }
            for (const cid of (collectionIDs || [])) {
                await notifyAffectedUsers(io, cid);
            }
            callback({ ok: true });
        } catch (e) {
            callback({ ok: false, msg: e.message });
        }
    });

};
