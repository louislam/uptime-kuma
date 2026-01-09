const Database = require("./database");

/**
 * Check if an error is specifically from a database operation
 * This is more restrictive to avoid false positives (e.g., notification send failures)
 * @param {Error} error The error to check
 * @returns {boolean} True if this is a database error
 */
function isDatabaseError(error) {
    if (!error) {
        return false;
    }

    // Check for MySQL/MariaDB specific error codes (most reliable indicator)
    if (
        error.code &&
        (error.code.startsWith("ER_") || // MySQL/MariaDB error codes
            error.code === "PROTOCOL_CONNECTION_LOST" ||
            error.code === "PROTOCOL_ENQUEUE_AFTER_QUIT" ||
            error.code === "PROTOCOL_ENQUEUE_AFTER_FATAL_ERROR")
    ) {
        return true;
    }

    // Check if error originated from database operations by examining stack trace
    const stack = error.stack || "";
    const isFromDatabaseCode =
        stack.includes("redbean-node") ||
        stack.includes("/server/database.js") ||
        (stack.includes("/server/model/") && (stack.includes("R.") || stack.includes("knex")));

    // For connection errors, only consider them database errors if:
    // 1. They're from database code (stack trace check above), AND
    // 2. They match database connection patterns
    if (isFromDatabaseCode) {
        // Check for connection errors that could be database-related
        if (
            error.code &&
            (error.code === "EHOSTUNREACH" ||
                error.code === "ECONNREFUSED" ||
                error.code === "ETIMEDOUT" ||
                error.code === "ENOTFOUND")
        ) {
            // For MariaDB/MySQL, verify it's connecting to the actual database host/port
            if (Database.dbConfig && Database.dbConfig.type && Database.dbConfig.type.endsWith("mariadb")) {
                const dbPort = Database.dbConfig.port || 3306;
                const dbHost = Database.dbConfig.hostname;
                // Only match if port matches database port OR address matches database hostname
                if ((error.port && error.port === dbPort) || (error.address && error.address === dbHost)) {
                    return true;
                }
            }
            // For SQLite, connection errors from database code are database errors
            if (Database.dbConfig && Database.dbConfig.type === "sqlite" && error.syscall === "connect") {
                return true;
            }
        }

        // Check for database-specific error messages (only if from database code)
        if (
            error.message &&
            (error.message.includes("SQLITE_") ||
                error.message.includes("SQLITE_ERROR") ||
                error.message.includes("SQLITE_BUSY") ||
                error.message.includes("SQLITE_LOCKED") ||
                error.message.includes("database is locked") ||
                error.message.includes("no such table") ||
                (error.message.includes("Connection lost") && stack.includes("mysql")))
        ) {
            return true;
        }
    }

    return false;
}

module.exports = {
    isDatabaseError,
};
