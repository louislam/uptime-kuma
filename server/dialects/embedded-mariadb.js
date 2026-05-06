const { MariadbDialect } = require("./mariadb");
const { EmbeddedMariaDB } = require("../embedded-mariadb");
const { log } = require("../../src/util");

class EmbeddedMariadbDialect extends MariadbDialect {
    static type = "embedded-mariadb";
    /** Embedded MariaDB owns its own socket — no host/credentials in db-config.json. */
    static requiresExternal = false;

    /**
     * Skip the credential checks the parent enforces for an external server.
     * @returns {void}
     */
    validateSetupConfig() {}

    /**
     * Skip the external connection probe — the embedded server is started
     * by `preConnect`, not yet running at validation time.
     * @returns {Promise<void>}
     */
    async testConnection() {}

    /**
     * @inheritdoc
     */
    async preConnect() {
        MariadbDialect.patchMysql2ColumnCompiler();
        const embedded = EmbeddedMariaDB.getInstance();
        await embedded.start();
        log.info("mariadb", "Embedded MariaDB started");
    }

    /**
     * @inheritdoc
     */
    buildKnexConfig({ poolMaxConnections }) {
        const embedded = EmbeddedMariaDB.getInstance();
        return {
            client: "mysql2",
            connection: {
                socketPath: embedded.socketPath,
                user: embedded.username,
                database: "kuma",
                timezone: "Z",
                typeCast: function (field, next) {
                    if (field.type === "DATETIME") {
                        return field.string();
                    }
                    return next();
                },
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
}

module.exports = { EmbeddedMariadbDialect };
