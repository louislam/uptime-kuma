const ColumnCompilerMySQL = require("knex/lib/dialects/mysql/schema/mysql-columncompiler");
const { isObject } = require("knex/lib/util/is");

class KumaColumnCompiler extends ColumnCompilerMySQL {
    /**
     * Diff: Override defaultTo method to handle default value for TEXT fields
     * @param {any} value Value
     * @returns {string|void} Default value (Don't understand why it can return void or string, but it's the original code, lol)
     */
    defaultTo(value) {
        // MySQL defaults to null by default, but breaks down if you pass it explicitly
        // Note that in MySQL versions up to 5.7, logic related to updating
        // timestamps when no explicit value is passed is quite insane - https://dev.mysql.com/doc/refman/5.7/en/server-system-variables.html#sysvar_explicit_defaults_for_timestamp
        if (value === null || value === undefined) {
            return;
        }
        if ((this.type === "json" || this.type === "jsonb") && isObject(value)) {
            // Default value for json will work only it is an expression
            return `default ('${JSON.stringify(value)}')`;
        }
        const defaultVal = super.defaultTo.apply(this, arguments);

        // louislam deleted: (this.type !== "blob" && this.type.indexOf("text") === -1)
        // Other code is the same as the original code
        // See: https://github.com/louislam/uptime-kuma/pull/5048#discussion_r1818076626
        return defaultVal;
    }
}

module.exports = KumaColumnCompiler;
