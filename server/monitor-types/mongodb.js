const { MonitorType } = require("./monitor-type");
const { UP } = require("../../src/util");
const { MongoClient } = require("mongodb");
const jsonata = require("jsonata");

class MongodbMonitorType extends MonitorType {

    name = "mongodb";

    /**
     * @inheritdoc
     */
    async check(monitor, heartbeat, _server) {
        let command = { "ping": 1 };

        if (monitor.databaseQuery) {
            command = JSON.parse(monitor.databaseQuery);
        }

        let result = await this.runMongodbCommand(monitor.databaseConnectionString, command);

        if (result["ok"] !== 1) {
            throw new Error("MongoDB command failed");
        }

        if (monitor.jsonPath) {
            let expression = jsonata(monitor.jsonPath);
            result = await expression.evaluate(result);
            if (!result) {
                throw new Error("Queried value not found.");
            }
        }

        if (monitor.expectedValue) {
            if (result.toString() === monitor.expectedValue) {
                heartbeat.msg = "Expected value found";
                heartbeat.status = UP;
            } else {
                throw new Error("Query executed, but value is not equal to expected value, value was: [" + JSON.stringify(result) + "]");
            }
        } else {
            heartbeat.msg = "";
            heartbeat.status = UP;
        }
    }

    /**
     * Connect to and ping a MongoDB database
     * @param {string} connectionString The database connection string
     * @param {object} command MongoDB command to run on the database
     * @returns {Promise<(string[] | object[] | object)>} Response from
     * server
     */
    async runMongodbCommand(connectionString, command) {
        let client = await MongoClient.connect(connectionString);
        let result = await client.db().command(command);
        await client.close();
        return result;
    }
}

module.exports = {
    MongodbMonitorType,
};
