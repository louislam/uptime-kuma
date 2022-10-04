const setupTask = require("../tasks/setup-task");
class Actor {
    constructor() {
        this.setupTask = new setupTask.SetupTask();
    }
}
const actor = new Actor();
exports.actor = actor;
