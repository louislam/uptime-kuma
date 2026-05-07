const { Dialect } = require("./dialect");
const { log } = require("../../src/util");

/**
 * Build the SSL options for the pg client. PostgreSQL accepts an object
 * (with optional CA) or `false` to disable.
 * @param {object} dbConfig db-config.json contents
 * @returns {object|boolean} pg ssl option
 */
function pgSsl(dbConfig) {
    if (!dbConfig.ssl) {
        return false;
    }
    return {
        rejectUnauthorized: true,
        ...(dbConfig.ca && dbConfig.ca.trim() !== "" ? { ca: dbConfig.ca } : {}),
    };
}

class PostgresDialect extends Dialect {
    static type = "postgres";
    static requiresExternal = true;
    static defaultPort = 5432;

    /**
     * @inheritdoc
     */
    async testConnection() {
        log.info("setup-database", "Testing PostgreSQL connection...");
        const { Client } = require("pg");
        const client = new Client({
            host: this.config.hostname,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            // Connect to the bootstrap "postgres" database to validate creds without
            // needing the target DB to exist yet.
            database: "postgres",
            ssl: pgSsl(this.config),
        });
        await client.connect();
        try {
            await client.query("SELECT 1");
        } finally {
            await client.end();
        }
    }

    /**
     * `CREATE DATABASE` is not transactional in PostgreSQL and IF NOT EXISTS
     * is not supported, so we attempt and swallow the "already exists" error.
     * @returns {Promise<void>}
     */
    async preConnect() {
        const port = this.config.port || PostgresDialect.defaultPort;
        const { Client } = require("pg");
        const adminClient = new Client({
            host: this.config.hostname,
            port,
            user: this.config.username,
            password: this.config.password,
            database: "postgres",
            ssl: pgSsl(this.config),
        });
        await adminClient.connect();
        try {
            const escapedDBName = '"' + String(this.config.dbName).replace(/"/g, '""') + '"';
            await adminClient.query(`CREATE DATABASE ${escapedDBName} ENCODING 'UTF8' TEMPLATE template0`);
            log.info("db", `Created PostgreSQL database ${this.config.dbName}`);
        } catch (e) {
            if (!String(e.message).includes("already exists")) {
                throw e;
            }
        } finally {
            await adminClient.end();
        }
    }

    /**
     * @inheritdoc
     */
    buildKnexConfig({ poolMaxConnections, acquireConnectionTimeout }) {
        const port = this.config.port || PostgresDialect.defaultPort;
        return {
            client: "pg",
            connection: {
                host: this.config.hostname,
                port,
                user: this.config.username,
                password: this.config.password,
                database: this.config.dbName,
                ssl: pgSsl(this.config),
            },
            pool: {
                min: 0,
                max: poolMaxConnections,
                idleTimeoutMillis: 30000,
                acquireTimeoutMillis: acquireConnectionTimeout,
                /**
                 * @inheritdoc
                 */
                afterCreate(conn, done) {
                    conn.query("SET timezone = 'UTC'", (err) => done(err, conn));
                },
            },
        };
    }

    /**
     * @inheritdoc
     */
    async postConnect(knex) {
        await this._initExternalDB(knex);
    }

    /**
     * @inheritdoc
     */
    sqlHourOffset() {
        return "(NOW() AT TIME ZONE 'UTC') + (? || ' hours')::interval";
    }
}

module.exports = { PostgresDialect };
