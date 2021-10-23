const { log, exit, connectDb } = require("./util-worker");
const { R } = require("redbean-node");
const { setSetting, setting } = require("../util-server");

(async () => {
    await connectDb();

    console.log("Checking Certificate Expiry Date");

    // TODO: Query monitor_tls_info

    exit();
})();
