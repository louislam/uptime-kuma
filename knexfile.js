// Update with your config settings.

const dbType = process.env.DB_TYPE || 'sqlite3';
const dbHost = process.env.DB_HOST;
const dbName = process.env.DB_NAME;
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
    
let database;

switch (dbType) {
    case 'sqlite3':
        const dialect = require("knex/lib/dialects/sqlite3/index.js");
        dialect.prototype._driver = () => require("@louislam/sqlite3");
        
        database = {
            client: dialect,
            connection: {
                filename: './data/kuma.db',
                acquireConnectionTimeout: 120 * 1000,
            },
            useNullAsDefault: true,
            pool: {
                min: 1,
                max: 1,
                idleTimeoutMillis: 120 * 1000,
                propagateCreateError: false,
                acquireTimeoutMillis: 120 * 1000,
            },
            migrations: {
                tableName: 'knex_migrations'
            }
        };
        break;
    
    case 'mysql':
        
        database = {
            client: "mysql",
            connection: {
                host: dbHost,
                user: dbUser,
                database: dbName,
                password: dbPass,
            }
        };
        break;
}

function setPath(path) {
    if (dbType !== 'sqlite')
        return;
    
    database.connection.filename = path;
}

function getDialect() {
    return dbType;
}

module.exports = {
    development: database,
    production: database,
    setPath: setPath,
    getDialect: getDialect,
};
