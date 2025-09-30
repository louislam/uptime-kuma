// Knex migration: Add tenant_id to core tables and backfill to Default tenant
// Includes line-by-line comments for clarity

exports.up = async function (knex) {
    // Helper: get Default tenant id (assumes previous migration created it)
    const defaultTenant = await knex("tenant").where({ slug: "default" }).first("id");

    // A list of tables that should be directly tenant-scoped
    // Each entry defines how to add tenant_id and any backfill rule
    const scopedTables = [
        // Monitors are tenant scoped
        { name: "monitor" },
        // Heartbeats belong to a monitor and will be backfilled via monitor.tenant_id
        { name: "heartbeat" },
        // Tags are tenant scoped
        { name: "tag" },
        // Join table of monitor and tag (denormalized tenant_id for easier filtering)
        { name: "monitor_tag" },
        // Notifications configuration is tenant scoped
        { name: "notification" },
        // Relation between monitor and notification
        { name: "monitor_notification" },
        // API keys are tenant scoped
        { name: "api_key" },
        // Status pages are tenant scoped
        { name: "status_page" },
        // CNAMEs for status pages should also be scoped
        { name: "status_page_cname" },
        // Groups are tenant scoped
        { name: "group" },
        // Relation between monitor and group (denormalized tenant_id)
        { name: "monitor_group" },
        // Maintenance definitions are tenant scoped
        { name: "maintenance" },
        // Relation between maintenance and status_page
        { name: "maintenance_status_page" },
        // Monitor-maintenance relation (denormalized tenant_id)
        { name: "monitor_maintenance" },
        // Docker hosts are per tenant
        { name: "docker_host" },
        // Proxies are per tenant
        { name: "proxy" },
        // Incidents are per tenant
        { name: "incident" },
        // TLS info per monitor (denormalized tenant_id)
        { name: "monitor_tls_info" },
        // History of sent notifications (denormalized tenant_id)
        { name: "notification_sent_history" }
    ];

    // For each table, add the tenant_id column if it doesn't exist
    for (const table of scopedTables) {
        // Use alterTable to add the column and FK
        await knex.schema.alterTable(table.name, (t) => {
            // New unsigned integer tenant_id column
            t.integer("tenant_id").unsigned().nullable()
                .references("id").inTable("tenant")
                .onDelete("CASCADE")
                .onUpdate("CASCADE");
            // Index to speed up tenant filtering
            t.index(["tenant_id"], `${table.name}_tenant_idx`);
        });
    }

    // Backfill: set tenant_id for existing rows
    // Strategy:
    // 1) Set monitor.tenant_id to default tenant
    if (defaultTenant) {
        await knex("monitor").whereNull("tenant_id").update({ tenant_id: defaultTenant.id });
    }

    // 2) For tables that can derive tenant from monitor relation
    // heartbeat -> via monitor_id
    await knex.raw(`UPDATE heartbeat AS h
        SET tenant_id = (SELECT m.tenant_id FROM monitor m WHERE m.id = h.monitor_id)
        WHERE h.tenant_id IS NULL`);

    // monitor_tag -> via monitor_id
    await knex.raw(`UPDATE monitor_tag AS mt
        SET tenant_id = (SELECT m.tenant_id FROM monitor m WHERE m.id = mt.monitor_id)
        WHERE mt.tenant_id IS NULL`);

    // monitor_notification -> via monitor_id
    await knex.raw(`UPDATE monitor_notification AS mn
        SET tenant_id = (SELECT m.tenant_id FROM monitor m WHERE m.id = mn.monitor_id)
        WHERE mn.tenant_id IS NULL`);

    // monitor_group -> via monitor_id
    await knex.raw(`UPDATE monitor_group AS mg
        SET tenant_id = (SELECT m.tenant_id FROM monitor m WHERE m.id = mg.monitor_id)
        WHERE mg.tenant_id IS NULL`);

    // monitor_tls_info -> via monitor_id
    await knex.raw(`UPDATE monitor_tls_info AS ti
        SET tenant_id = (SELECT m.tenant_id FROM monitor m WHERE m.id = ti.monitor_id)
        WHERE ti.tenant_id IS NULL`);

    // maintenance_status_page -> via status_page_id
    await knex.raw(`UPDATE maintenance_status_page AS msp
        SET tenant_id = (SELECT sp.tenant_id FROM status_page sp WHERE sp.id = msp.status_page_id)
        WHERE msp.tenant_id IS NULL`);

    // 3) For independent tables, backfill to default tenant if still null
    const setDefaultIfNull = async (tbl) => {
        if (defaultTenant) {
            await knex(tbl).whereNull("tenant_id").update({ tenant_id: defaultTenant.id });
        }
    };

    await setDefaultIfNull("tag");
    await setDefaultIfNull("notification");
    await setDefaultIfNull("api_key");
    await setDefaultIfNull("status_page");
    await setDefaultIfNull("status_page_cname");
    await setDefaultIfNull("group");
    await setDefaultIfNull("maintenance");
    await setDefaultIfNull("monitor_maintenance");
    await setDefaultIfNull("docker_host");
    await setDefaultIfNull("proxy");
    await setDefaultIfNull("incident");
    await setDefaultIfNull("notification_sent_history");

    // Finally, enforce NOT NULL on core tables where tenant_id should always be set now
    const makeNotNull = async (tbl) => {
        await knex.schema.alterTable(tbl, (t) => {
            t.integer("tenant_id").unsigned().notNullable().alter();
        });
    };

    // Only enforce on the most critical tables for now to avoid SQLite limitations
    await makeNotNull("monitor");
    await makeNotNull("heartbeat");
};

exports.down = async function (knex) {
    // Rollback: drop tenant_id columns and indexes
    const tables = [
        "monitor","heartbeat","tag","monitor_tag","notification","monitor_notification",
        "api_key","status_page","status_page_cname","group","monitor_group","maintenance",
        "maintenance_status_page","monitor_maintenance","docker_host","proxy","incident","monitor_tls_info",
        "notification_sent_history"
    ];

    for (const name of tables) {
        // Try to drop index then column. Some dialects handle dropColumn implicitly removing index.
        try {
            await knex.schema.alterTable(name, (t) => {
                t.dropIndex(["tenant_id"], `${name}_tenant_idx`);
                t.dropColumn("tenant_id");
            });
        } catch (e) {
            // Best-effort rollback; SQLite may not support some ALTER operations depending on version
        }
    }
};
