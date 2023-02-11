const { R } = require("redbean-node");
const { log, sleep } = require("../src/util");

/**
 * DO NOT ADD ANYTHING HERE!
 * IF YOU NEED TO ADD SOMETHING, ADD IT TO ./db/knex_migrations
 * @returns {Promise<void>}
 */
async function createTables() {
    log.info("mariadb", "Creating basic tables for MariaDB");
    const knex = R.knex;

    // Up to `patch-add-google-analytics-status-page-tag.sql`

    // docker_host
    await knex.schema.createTable("docker_host", (table) => {
        table.increments("id");
        table.integer("user_id").unsigned().notNullable();
        table.string("docker_daemon", 255);
        table.string("docker_type", 255);
        table.string("name", 255);
    });

    // group
    await knex.schema.createTable("group", (table) => {
        table.increments("id");
        table.string("name", 255).notNullable();
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
        table.boolean("public").notNullable().defaultTo(false);
        table.boolean("active").notNullable().defaultTo(true);
        table.integer("weight").notNullable().defaultTo(1000);
    });

    // proxy
    await knex.schema.createTable("proxy", (table) => {
        table.increments("id");
        table.integer("user_id").unsigned().notNullable();
        table.string("protocol", 10).notNullable();
        table.string("host", 255).notNullable();
        table.smallint("port").notNullable();           // Maybe a issue with MariaDB, need migration to int
        table.boolean("auth").notNullable();
        table.string("username", 255).nullable();
        table.string("password", 255).nullable();
        table.boolean("active").notNullable().defaultTo(true);
        table.boolean("default").notNullable().defaultTo(false);
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());

        table.index("user_id", "proxy_user_id");
    });

    // user
    await knex.schema.createTable("user", (table) => {
        table.increments("id");
        table.string("username", 255).notNullable().unique().collate("utf8_general_ci");
        table.string("password", 255);
        table.boolean("active").notNullable().defaultTo(true);
        table.string("timezone", 150);
        table.string("twofa_secret", 64);
        table.boolean("twofa_status").notNullable().defaultTo(false);
        table.string("twofa_last_token", 6);
    });

    // monitor
    await knex.schema.createTable("monitor", (table) => {
        table.increments("id");
        table.string("name", 150);
        table.boolean("active").notNullable().defaultTo(true);
        table.integer("user_id").unsigned()
            .references("id").inTable("user")
            .onDelete("SET NULL")
            .onUpdate("CASCADE");
        table.integer("interval").notNullable().defaultTo(20);
        table.text("url");
        table.string("type", 20);
        table.integer("weight").defaultTo(2000);
        table.string("hostname", 255);
        table.integer("port");
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
        table.string("keyword", 255);
        table.integer("maxretries").notNullable().defaultTo(0);
        table.boolean("ignore_tls").notNullable().defaultTo(false);
        table.boolean("upside_down").notNullable().defaultTo(false);
        table.integer("maxredirects").notNullable().defaultTo(10);
        table.text("accepted_statuscodes_json").notNullable().defaultTo("[\"200-299\"]");
        table.string("dns_resolve_type", 5);
        table.string("dns_resolve_server", 255);
        table.string("dns_last_result", 255);
        table.integer("retry_interval").notNullable().defaultTo(0);
        table.string("push_token", 20).defaultTo(null);
        table.text("method").notNullable().defaultTo("GET");
        table.text("body").defaultTo(null);
        table.text("headers").defaultTo(null);
        table.text("basic_auth_user").defaultTo(null);
        table.text("basic_auth_pass").defaultTo(null);
        table.integer("docker_host").unsigned()
            .references("id").inTable("docker_host");
        table.string("docker_container", 255);
        table.integer("proxy_id").unsigned()
            .references("id").inTable("proxy");
        table.boolean("expiry_notification").defaultTo(true);
        table.text("mqtt_topic");
        table.string("mqtt_success_message", 255);
        table.string("mqtt_username", 255);
        table.string("mqtt_password", 255);
        table.string("database_connection_string", 2000);
        table.text("database_query");
        table.string("auth_method", 250);
        table.text("auth_domain");
        table.text("auth_workstation");
        table.string("grpc_url", 255).defaultTo(null);
        table.text("grpc_protobuf").defaultTo(null);
        table.text("grpc_body").defaultTo(null);
        table.text("grpc_metadata").defaultTo(null);
        table.text("grpc_method").defaultTo(null);
        table.text("grpc_service_name").defaultTo(null);
        table.boolean("grpc_enable_tls").notNullable().defaultTo(false);
        table.string("radius_username", 255);
        table.string("radius_password", 255);
        table.string("radius_calling_station_id", 50);
        table.string("radius_called_station_id", 50);
        table.string("radius_secret", 255);
        table.integer("resend_interval").notNullable().defaultTo(0);
        table.integer("packet_size").notNullable().defaultTo(56);
        table.string("game", 255);
    });

    // heartbeat
    await knex.schema.createTable("heartbeat", (table) => {
        table.increments("id");
        table.boolean("important").notNullable().defaultTo(false);
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.smallint("status").notNullable();

        table.text("msg");
        table.datetime("time").notNullable();
        table.integer("ping");
        table.integer("duration").notNullable().defaultTo(0);
        table.integer("down_count").notNullable().defaultTo(0);

        table.index("important");
        table.index([ "monitor_id", "time" ], "monitor_time_index");
        table.index("monitor_id");
        table.index([ "monitor_id", "important", "time" ], "monitor_important_time_index");
    });

    // incident
    await knex.schema.createTable("incident", (table) => {
        table.increments("id");
        table.string("title", 255).notNullable();
        table.text("content", 255).notNullable();
        table.string("style", 30).notNullable().defaultTo("warning");
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
        table.datetime("last_updated_date");
        table.boolean("pin").notNullable().defaultTo(true);
        table.boolean("active").notNullable().defaultTo(true);
        table.integer("status_page_id").unsigned();
    });

    // maintenance
    await knex.schema.createTable("maintenance", (table) => {
        table.increments("id");
        table.string("title", 150).notNullable();
        table.text("description").notNullable();
        table.integer("user_id").unsigned()
            .references("id").inTable("user")
            .onDelete("SET NULL")
            .onUpdate("CASCADE");
        table.boolean("active").notNullable().defaultTo(true);
        table.string("strategy", 50).notNullable().defaultTo("single");
        table.datetime("start_date");
        table.datetime("end_date");
        table.time("start_time");
        table.time("end_time");
        table.string("weekdays", 250).defaultTo("[]");
        table.text("days_of_month").defaultTo("[]");
        table.integer("interval_day");

        table.index("active");
        table.index([ "strategy", "active" ], "manual_active");
        table.index("user_id", "maintenance_user_id");
    });

    // maintenance_status_page
    // maintenance_timeslot
    // monitor_group
    // monitor_maintenance
    // monitor_notification
    // monitor_tag
    // monitor_tls_info
    // notification
    // notification_sent_history
    // setting
    await knex.schema.createTable("setting", (table) => {
        table.increments("id");
        table.string("key", 200).notNullable().unique().collate("utf8_general_ci");
        table.text("value");
        table.string("type", 20);
    });

    // status_page
    // status_page_cname
    // tag
    // user

    log.info("mariadb", "Created basic tables for MariaDB");
}

module.exports = {
    createTables,
};
