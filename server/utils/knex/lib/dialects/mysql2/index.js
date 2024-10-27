const ClientMySQL2 = require("knex/lib/dialects/mysql2/index");
const KumaColumnCompiler = require("./schema/mysql2-columncompiler");

/**
 * Fixed MySQL2 client class.
 * - Fix: Default value for TEXT fields is not supported.
 */
class KumaMySQL2 extends ClientMySQL2 {

    driverName = "mysql2";

    /**
     *
     */
    columnCompiler() {
        return new KumaColumnCompiler(this, ...arguments);
    }
}

module.exports = KumaMySQL2;
