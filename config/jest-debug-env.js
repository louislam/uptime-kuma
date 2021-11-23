const PuppeteerEnvironment = require("jest-environment-puppeteer");
const util = require("util");

class DebugEnv extends PuppeteerEnvironment {
    async handleTestEvent(event, state) {
        const ignoredEvents = [
            "setup",
            "add_hook",
            "start_describe_definition",
            "add_test",
            "finish_describe_definition",
            "run_start",
            "run_describe_start",
            "test_start",
            "hook_start",
            "hook_success",
            "test_fn_start",
            "test_fn_success",
            "test_done",
            "run_describe_finish",
            "run_finish",
            "teardown",
            "test_fn_failure",
        ];
        if (!ignoredEvents.includes(event.name)) {
            console.log(
                new Date().toString() + ` Unhandled event [${event.name}] ` + util.inspect(event)
            );
        }
    }
}

module.exports = DebugEnv;
