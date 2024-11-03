const ColumnCompilerMySQL = require("knex/lib/dialects/mysql/schema/mysql-columncompiler");
const { formatDefault } = require("knex/lib/formatter/formatterUtils");
const { log } = require("../../../../../../../src/util");

class KumaColumnCompiler extends ColumnCompilerMySQL {
    /**
     * Override defaultTo method to handle default value for TEXT fields
     * @param {any} value Value
     * @returns {string|void} Default value (Don't understand why it can return void or string, but it's the original code, lol)
     */
    defaultTo(value) {
        if (this.type === "text" && typeof value === "string") {
            log.debug("defaultTo", `${this.args[0]}: ${this.type} ${value} ${typeof value}`);
            // MySQL 8.0 is required and only if the value is written as an expression: https://dev.mysql.com/doc/refman/8.0/en/data-type-defaults.html
            // MariaDB 10.2 is required: https://mariadb.com/kb/en/text/
            return `default (${formatDefault(value, this.type, this.client)})`;
        }
        return super.defaultTo.apply(this, arguments);
    }
}

module.exports = KumaColumnCompiler;
