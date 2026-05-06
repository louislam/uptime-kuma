const { Dialect } = require("./dialect");
const { SqliteDialect } = require("./sqlite");
const { MariadbDialect } = require("./mariadb");
const { EmbeddedMariadbDialect } = require("./embedded-mariadb");
const { PostgresDialect } = require("./postgres");

const REGISTRY = new Map(
    [ SqliteDialect, MariadbDialect, EmbeddedMariadbDialect, PostgresDialect ].map((C) => [ C.type, C ])
);

/**
 * @returns {string[]} All registered dialect type identifiers
 */
function supportedTypes() {
    return [ ...REGISTRY.keys() ];
}

/**
 * Build the Dialect instance for a given dbConfig. Returns null when the
 * type is unknown so the caller can choose between a 400 response or a throw.
 * @param {object} dbConfig db-config.json contents
 * @returns {Dialect|null} Concrete Dialect or null
 */
function dialectFor(dbConfig) {
    const Cls = REGISTRY.get(dbConfig.type);
    if (!Cls) {
        return null;
    }
    return new Cls(dbConfig);
}

module.exports = {
    Dialect,
    SqliteDialect,
    MariadbDialect,
    EmbeddedMariadbDialect,
    PostgresDialect,
    dialectFor,
    supportedTypes,
};
