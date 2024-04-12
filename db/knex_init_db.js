const { R } = require("redbean-node");
const { log } = require("../src/util");

/**
 * ⚠️⚠️⚠️⚠️⚠️⚠️ DO NOT ADD ANYTHING HERE!
 * IF YOU NEED TO ADD FIELDS, ADD IT TO ./db/knex_migrations
 * See ./db/knex_migrations/README.md for more information
 * @returns {Promise<void>}
 */
async function createTables() {
    log.info("mariadb", "Creating basic tables for MariaDB");
    const knex = R.knex;

    // TODO: Should check later if it is really the final patch sql file.

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
        table.integer("status_page_id").unsigned();
    });

    // proxy
    await knex.schema.createTable("proxy", (table) => {
        table.increments("id");
        table.integer("user_id").unsigned().notNullable();
        table.string("protocol", 10).notNullable();
        table.string("host", 255).notNullable();
        table.smallint("port").notNullable();           // TODO: Maybe a issue with MariaDB, need migration to int
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

    // status_page
    await knex.schema.createTable("status_page", (table) => {
        table.increments("id");
        table.string("slug", 255).notNullable().unique().collate("utf8_general_ci");
        table.string("title", 255).notNullable();
        table.text("description");
        table.string("icon", 255).notNullable();
        table.string("theme", 30).notNullable();
        table.boolean("published").notNullable().defaultTo(true);
        table.boolean("search_engine_index").notNullable().defaultTo(true);
        table.boolean("show_tags").notNullable().defaultTo(false);
        table.string("password");
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
        table.datetime("modified_date").notNullable().defaultTo(knex.fn.now());
        table.text("footer_text");
        table.text("custom_css");
        table.boolean("show_powered_by").notNullable().defaultTo(true);
        table.string("google_analytics_tag_id");
    });

    // maintenance_status_page
    await knex.schema.createTable("maintenance_status_page", (table) => {
        table.increments("id");

        table.integer("status_page_id").unsigned().notNullable()
            .references("id").inTable("status_page")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");

        table.integer("maintenance_id").unsigned().notNullable()
            .references("id").inTable("maintenance")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
    });

    // maintenance_timeslot
    await knex.schema.createTable("maintenance_timeslot", (table) => {
        table.increments("id");
        table.integer("maintenance_id").unsigned().notNullable()
            .references("id").inTable("maintenance")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.datetime("start_date").notNullable();
        table.datetime("end_date");
        table.boolean("generated_next").defaultTo(false);

        table.index("maintenance_id");
        table.index([ "maintenance_id", "start_date", "end_date" ], "active_timeslot_index");
        table.index("generated_next", "generated_next_index");
    });

    // monitor_group
    await knex.schema.createTable("monitor_group", (table) => {
        table.increments("id");
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.integer("group_id").unsigned().notNullable()
            .references("id").inTable("group")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.integer("weight").notNullable().defaultTo(1000);
        table.boolean("send_url").notNullable().defaultTo(false);

        table.index([ "monitor_id", "group_id" ], "fk");
    });
    // monitor_maintenance
    await knex.schema.createTable("monitor_maintenance", (table) => {
        table.increments("id");
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.integer("maintenance_id").unsigned().notNullable()
            .references("id").inTable("maintenance")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");

        table.index("maintenance_id", "maintenance_id_index2");
        table.index("monitor_id", "monitor_id_index");
    });

    // notification
    await knex.schema.createTable("notification", (table) => {
        table.increments("id");
        table.string("name", 255);
        table.boolean("active").notNullable().defaultTo(true);
        table.integer("user_id").unsigned();
        table.boolean("is_default").notNullable().defaultTo(false);
        table.text("config", "longtext");
    });

    // monitor_notification
    await knex.schema.createTable("monitor_notification", (table) => {
        table.increments("id").unsigned();      // TODO: no auto increment????
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.integer("notification_id").unsigned().notNullable()
            .references("id").inTable("notification")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");

        table.index([ "monitor_id", "notification_id" ], "monitor_notification_index");
    });

    // tag
    await knex.schema.createTable("tag", (table) => {
        table.increments("id");
        table.string("name", 255).notNullable();
        table.string("color", 255).notNullable();
        table.datetime("created_date").notNullable().defaultTo(knex.fn.now());
    });

    // monitor_tag
    await knex.schema.createTable("monitor_tag", (table) => {
        table.increments("id");
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.integer("tag_id").unsigned().notNullable()
            .references("id").inTable("tag")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.text("value");
    });

    // monitor_tls_info
    await knex.schema.createTable("monitor_tls_info", (table) => {
        table.increments("id");
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.text("info_json");
    });

    // notification_sent_history
    await knex.schema.createTable("notification_sent_history", (table) => {
        table.increments("id");
        table.string("type", 50).notNullable();
        table.integer("monitor_id").unsigned().notNullable();
        table.integer("days").notNullable();
        table.unique([ "type", "monitor_id", "days" ]);
        table.index([ "type", "monitor_id", "days" ], "good_index");
    });

    // setting
    await knex.schema.createTable("setting", (table) => {
        table.increments("id");
        table.string("key", 200).notNullable().unique().collate("utf8_general_ci");
        table.text("value");
        table.string("type", 20);
    });

    // status_page_cname
    await knex.schema.createTable("status_page_cname", (table) => {
        table.increments("id");
        table.integer("status_page_id").unsigned()
            .references("id").inTable("status_page")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.string("domain").notNullable().unique().collate("utf8_general_ci");
    });

    /*********************
    * Converted Patch here
    *********************/

    // 2023-06-30-1348-http-body-encoding.js
    // ALTER TABLE monitor ADD http_body_encoding VARCHAR(25);
    // UPDATE monitor SET http_body_encoding = 'json' WHERE (type = 'http' or type = 'keyword') AND http_body_encoding IS NULL;
    await knex.schema.table("monitor", function (table) {
        table.string("http_body_encoding", 25);
    });

    await knex("monitor")
        .where(function () {
            this.where("type", "http").orWhere("type", "keyword");
        })
        .whereNull("http_body_encoding")
        .update({
            http_body_encoding: "json",
        });

    // 2023-06-30-1354-add-description-monitor.js
    // ALTER TABLE monitor ADD description TEXT default null;
    await knex.schema.table("monitor", function (table) {
        table.text("description").defaultTo(null);
    });

    // 2023-06-30-1357-api-key-table.js
    /*
        CREATE TABLE [api_key] (
            [id] INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            [key] VARCHAR(255) NOT NULL,
            [name] VARCHAR(255) NOT NULL,
            [user_id] INTEGER NOT NULL,
            [created_date] DATETIME DEFAULT (DATETIME('now')) NOT NULL,
            [active] BOOLEAN DEFAULT 1 NOT NULL,
            [expires] DATETIME DEFAULT NULL,
            CONSTRAINT FK_user FOREIGN KEY ([user_id]) REFERENCES [user]([id]) ON DELETE CASCADE ON UPDATE CASCADE
        );
     */
    await knex.schema.createTable("api_key", function (table) {
        table.increments("id").primary();
        table.string("key", 255).notNullable();
        table.string("name", 255).notNullable();
        table.integer("user_id").unsigned().notNullable()
            .references("id").inTable("user")
            .onDelete("CASCADE")
            .onUpdate("CASCADE");
        table.dateTime("created_date").defaultTo(knex.fn.now()).notNullable();
        table.boolean("active").defaultTo(1).notNullable();
        table.dateTime("expires").defaultTo(null);
    });

    // 2023-06-30-1400-monitor-tls.js
    /*
    ALTER TABLE monitor
        ADD tls_ca TEXT default null;

    ALTER TABLE monitor
        ADD tls_cert TEXT default null;

    ALTER TABLE monitor
        ADD tls_key TEXT default null;
    */
    await knex.schema.table("monitor", function (table) {
        table.text("tls_ca").defaultTo(null);
        table.text("tls_cert").defaultTo(null);
        table.text("tls_key").defaultTo(null);
    });

    // 2023-06-30-1401-maintenance-cron.js
    /*
        -- 999 characters. https://stackoverflow.com/questions/46134830/maximum-length-for-cron-job
        DROP TABLE maintenance_timeslot;
        ALTER TABLE maintenance ADD cron TEXT;
        ALTER TABLE maintenance ADD timezone VARCHAR(255);
        ALTER TABLE maintenance ADD duration INTEGER;
    */
    await knex.schema
        .dropTableIfExists("maintenance_timeslot")
        .table("maintenance", function (table) {
            table.text("cron");
            table.string("timezone", 255);
            table.integer("duration");
        });

    // 2023-06-30-1413-add-parent-monitor.js.
    /*
        ALTER TABLE monitor
        ADD parent INTEGER REFERENCES [monitor] ([id]) ON DELETE SET NULL ON UPDATE CASCADE;
    */
    await knex.schema.table("monitor", function (table) {
        table.integer("parent").unsigned()
            .references("id").inTable("monitor")
            .onDelete("SET NULL")
            .onUpdate("CASCADE");
    });

    /*
        patch-add-invert-keyword.sql
        ALTER TABLE monitor
        ADD invert_keyword BOOLEAN default 0 not null;
     */
    await knex.schema.table("monitor", function (table) {
        table.boolean("invert_keyword").defaultTo(0).notNullable();
    });

    /*
        patch-added-json-query.sql
        ALTER TABLE monitor
	    ADD json_path TEXT;

        ALTER TABLE monitor
	    ADD expected_value VARCHAR(255);
     */
    await knex.schema.table("monitor", function (table) {
        table.text("json_path");
        table.string("expected_value", 255);
    });

    /*
    patch-added-kafka-producer.sql

    ALTER TABLE monitor
	ADD kafka_producer_topic VARCHAR(255);

ALTER TABLE monitor
	ADD kafka_producer_brokers TEXT;

ALTER TABLE monitor
	ADD kafka_producer_ssl INTEGER;

ALTER TABLE monitor
	ADD kafka_producer_allow_auto_topic_creation VARCHAR(255);

ALTER TABLE monitor
	ADD kafka_producer_sasl_options TEXT;

ALTER TABLE monitor
	ADD kafka_producer_message TEXT;
     */
    await knex.schema.table("monitor", function (table) {
        table.string("kafka_producer_topic", 255);
        table.text("kafka_producer_brokers");

        // patch-fix-kafka-producer-booleans.sql
        table.boolean("kafka_producer_ssl").defaultTo(0).notNullable();
        table.boolean("kafka_producer_allow_auto_topic_creation").defaultTo(0).notNullable();

        table.text("kafka_producer_sasl_options");
        table.text("kafka_producer_message");
    });

    /*
    patch-add-certificate-expiry-status-page.sql
    ALTER TABLE status_page
    ADD show_certificate_expiry BOOLEAN default 0 NOT NULL;
     */
    await knex.schema.table("status_page", function (table) {
        table.boolean("show_certificate_expiry").defaultTo(0).notNullable();
    });

    /*
    patch-monitor-oauth-cc.sql
    ALTER TABLE monitor
    ADD oauth_client_id TEXT default null;

ALTER TABLE monitor
    ADD oauth_client_secret TEXT default null;

ALTER TABLE monitor
    ADD oauth_token_url TEXT default null;

ALTER TABLE monitor
    ADD oauth_scopes TEXT default null;

ALTER TABLE monitor
    ADD oauth_auth_method TEXT default null;
     */
    await knex.schema.table("monitor", function (table) {
        table.text("oauth_client_id").defaultTo(null);
        table.text("oauth_client_secret").defaultTo(null);
        table.text("oauth_token_url").defaultTo(null);
        table.text("oauth_scopes").defaultTo(null);
        table.text("oauth_auth_method").defaultTo(null);
    });

    /*
    patch-add-timeout-monitor.sql
    ALTER TABLE monitor
    ADD timeout DOUBLE default 0 not null;
     */
    await knex.schema.table("monitor", function (table) {
        table.double("timeout").defaultTo(0).notNullable();
    });

    /*
    patch-add-gamedig-given-port.sql
    ALTER TABLE monitor
    ADD gamedig_given_port_only BOOLEAN default 1 not null;
     */
    await knex.schema.table("monitor", function (table) {
        table.boolean("gamedig_given_port_only").defaultTo(1).notNullable();
    });

    log.info("mariadb", "Created basic tables for MariaDB");
}

module.exports = {
    createTables,
};
