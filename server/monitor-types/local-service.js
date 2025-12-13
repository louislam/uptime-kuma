const { MonitorType } = require("./monitor-type");
const { exec } = require("child_process");
const { DOWN, UP, evaluateJsonQuery } = require("../../src/util");

class LocalServiceMonitorType extends MonitorType {
    name = "local-service";
    description = "Checks if a local service is running by executing a command.";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, server) {
        return new Promise((resolve, reject) => {
            exec(monitor.local_service_command, async (error, stdout, stderr) => {
                if (error) {
                    heartbeat.status = DOWN;
                    heartbeat.msg = `Error executing command: ${error.message}`;
                    reject(new Error(heartbeat.msg));
                    return;
                }

                const output = stdout.trim();

                if (monitor.local_service_check_type === "keyword") {
                    if (monitor.local_service_expected_output) {
                        if (output.includes(monitor.local_service_expected_output)) {
                            heartbeat.status = UP;
                            heartbeat.msg = `OK - Output contains "${monitor.local_service_expected_output}"`;
                            resolve();
                        } else {
                            heartbeat.status = DOWN;
                            heartbeat.msg = `Output did not contain "${monitor.local_service_expected_output}"`;
                            reject(new Error(heartbeat.msg));
                        }
                    } else {
                        heartbeat.status = UP;
                        heartbeat.msg = "OK - Command executed successfully";
                        resolve();
                    }
                } else if (monitor.local_service_check_type === "json-query") {
                    try {
                        const data = JSON.parse(output);
                        const { status, response } = await evaluateJsonQuery(data, monitor.jsonPath, monitor.jsonPathOperator, monitor.expectedValue);

                        if (status) {
                            heartbeat.status = UP;
                            heartbeat.msg = `JSON query passes (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`;
                            resolve();
                        } else {
                            throw new Error(`JSON query does not pass (comparing ${response} ${monitor.jsonPathOperator} ${monitor.expectedValue})`);
                        }
                    } catch (e) {
                        heartbeat.status = DOWN;
                        heartbeat.msg = e.message;
                        reject(e);
                    }
                }
            });
        });
    }
}

module.exports = {
    LocalServiceMonitorType,
};
