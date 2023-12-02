const { MonitorType } = require("./monitor-type");
const { UP, DOWN } = require("../../src/util");
const axios = require("axios");

class ZabbixTriggerMonitorType extends MonitorType {

    name = "zabbix-trigger";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {

        // Make Request
        const options = {
            method: "post",
            url: monitor.zabbixInstanceUrl,
            data: {
                "jsonrpc": "2.0",
                "method": "trigger.get",
                "params": {
                    "triggerids": monitor.zabbixTriggerId,
                    "output": "extend",
                    "selectFunctions": "extend",
                },
                // Will be deprecated, but Bearer Auth is currently not working
                "auth": monitor.zabbixAuthToken,
                "id": 1
            },
            headers: {
                "Content-Type": "application/json-rpc",
                // In the future Authentication will use Bearer Token
                "Authorization": `Bearer ${monitor.zabbixAuthToken}`,
            }
        };

        // Send Request & Convert Data
        let res = await axios(options);
        let data = res.data;

        // convert data to object
        if (typeof data === "string") {
            data = JSON.parse(data);
        }
        let trigger = data.result[0];

        /*
            Zabbix Trigger Value Mapping
            Value 0 - ok
            value 1 - Firing
        */
        if ( trigger.value === "0" ) {
            heartbeat.status = UP;
            heartbeat.msg = `OK - ${ trigger.description }`;
        } else {
            heartbeat.status = DOWN;
            heartbeat.msg = trigger.comments;
        }
    }
}

module.exports = {
    ZabbixTriggerMonitorType,
};
