const mysql = require("mysql2/promise");
const SqlString = require("sqlstring");
const { Dialect } = require("./dialect");
const { log } = require("../../src/util");
const KumaColumnCompiler = require("../utils/knex/lib/dialects/mysql2/schema/mysql2-columncompiler");

/**
 * Build the SSL block for both the admin connect and the Knex pool.
 * @param {object} dbConfig db-config.json contents
 * @returns {object} SSL options or empty object
 */
function sslOptions(dbConfig) {
    if (!dbConfig.ssl) {
        return {};
    }
    return {
        ssl: {
            rejectUnauthorized: true,
            ...(dbConfig.ca && dbConfig.ca.trim() !== "" ? { ca: [dbConfig.ca] } : {}),
        },
    };
}

class MariadbDialect extends Dialect {
    static type = "mariadb";
    static requiresExternal = true;
    static defaultPort = 3306;

    /**
     * Validates either a socket path (when env-provided) or hostname+port
     * combo, then the DB name and credentials.
     * @throws {Error} When a required field is missing
     * @returns {void}
     */
    validateSetupConfig() {
        if (process.env.UPTIME_KUMA_DB_SOCKET?.trim().length > 0) {
            this.config.socketPath = process.env.UPTIME_KUMA_DB_SOCKET.trim();
        } else {
            if (!this.config.hostname) {
                throw new Error("Hostname is required");
            }
            if (!this.config.port) {
                throw new Error("Port is required");
            }
        }
        if (!this.config.dbName) {
            throw new Error("Database name is required");
        }
        if (!this.config.username) {
            throw new Error("Username is required");
        }
        if (!this.config.password) {
            throw new Error("Password is required");
        }
    }

    /**
     * @inheritdoc
     */
    async testConnection() {
        log.info("setup-database", "Testing database connection...");
        const connection = await mysql.createConnection({
            host: this.config.hostname,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            database: this.config.dbName,
            socketPath: this.config.socketPath,
            ...sslOptions(this.config),
        });
        try {
            await connection.execute("SELECT 1");
        } finally {
            await connection.end();
        }
    }

    /**
     * Patch knex's mysql2 dialect to use the Kuma column compiler. Idempotent
     * — rebinding to the same prototype property is harmless if the pool
     * reopens. Workaround: extending ColumnCompiler didn't work for unknown
     * reasons, so we override via prototype.
     * @returns {void}
     */
    static patchMysql2ColumnCompiler() {
        const { getDialectByNameOrAlias } = require("knex/lib/dialects");
        const mysql2 = getDialectByNameOrAlias("mysql2");
        mysql2.prototype.columnCompiler = function () {
            return new KumaColumnCompiler(this, ...arguments);
        };
    }

    /**
     * Connect briefly as the configured user and `CREATE DATABASE IF NOT EXISTS`.
     * Also patches knex's mysql2 column compiler so it emits Kuma-flavored DDL.
     * @returns {Promise<void>}
     */
    async preConnect() {
        MariadbDialect.patchMysql2ColumnCompiler();

        const connection = await mysql.createConnection({
            host: this.config.hostname,
            port: this.config.port,
            user: this.config.username,
            password: this.config.password,
            socketPath: this.config.socketPath,
            ...sslOptions(this.config),
        });
        // SqlString.escapeId(name, true) → `db.name` becomes `\`db.name\``,
        // not the unintended `\`db\`.\`name\``.
        const escapedDBName = SqlString.escapeId(this.config.dbName, true);
        await connection.execute("CREATE DATABASE IF NOT EXISTS " + escapedDBName + " CHARACTER SET utf8mb4");
        await connection.end();
    }

    /**
     * @inheritdoc
     */
    buildKnexConfig({ poolMaxConnections }) {
        return {
            client: "mysql2",
            connection: {
                host: this.config.hostname,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password,
                database: this.config.dbName,
                socketPath: this.config.socketPath,
                timezone: "Z",
                typeCast: function (field, next) {
                    if (field.type === "DATETIME") {
                        // Bypass mysql2's timezone conversion for DATETIME columns
                        return field.string();
                    }
                    return next();
                },
                ...sslOptions(this.config),
            },
            pool: {
                min: 0,
                max: poolMaxConnections,
                idleTimeoutMillis: 30000,
                /**
                 * @inheritdoc
                 */
                afterCreate(conn, done) {
                    conn.query("SET CHARACTER SET utf8mb4;", (err) => done(err, conn));
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
        return "DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? HOUR)";
    }
}

module.exports = { MariadbDialect };
