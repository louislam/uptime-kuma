const { log } = require("../../src/util");
const { loadDeployBoardConfig } = require("./config");
const { DeployBoardStore } = require("./store");
const { broadcastToLoggedIn } = require("./broadcast");

/**
 * The deploy board: configuration, state and (from phase 2 on) the sources that feed it.
 */
class DeployBoard {
    /**
     * @param {object} options Options.
     * @param {object} options.env Environment (process.env by default).
     * @param {DeployBoardStore} options.store State (a new one by default).
     */
    constructor({ env = process.env, store = new DeployBoardStore() } = {}) {
        this.env = env;
        this.store = store;
        this.config = null;
        this.configStatus = "missing";
        this.started = false;
    }

    /**
     * Load the configuration and start broadcasting. Safe to call more than once.
     *
     * Never throws: a broken deploy board must not take the monitors down with it. Every source
     * starts as "unconfigured"; the collectors of the next phases switch on the ones they serve.
     * @param {object|null} io Socket.io server, to broadcast to logged-in sockets.
     * @returns {void}
     */
    start(io = null) {
        if (this.started) {
            return;
        }
        this.started = true;

        try {
            const loaded = loadDeployBoardConfig(this.env);
            this.configStatus = loaded.status;
            this.config = loaded.config;

            if (loaded.status === "invalid") {
                log.error("deploy-board", `Configuration ignored, every deploy source is off. ${loaded.error}`);
            } else if (loaded.status === "missing") {
                log.info("deploy-board", "DEPLOY_BOARD_CONFIG is not set; every deploy source is off.");
            } else {
                log.info("deploy-board", `Configuration loaded from ${loaded.path}`);
            }
        } catch (e) {
            this.configStatus = "invalid";
            this.config = null;
            log.error("deploy-board", `Could not start: ${e.message}`);
        }

        if (io) {
            this.store.onChange((snapshot) => broadcastToLoggedIn(io, snapshot));
        }
    }

    /**
     * @returns {object} Current board state for the browser.
     */
    getSnapshot() {
        return this.store.snapshot();
    }
}

const deployBoard = new DeployBoard();

module.exports = {
    DeployBoard,
    deployBoard,
};
