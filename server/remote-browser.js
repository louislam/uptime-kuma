const { getKnex } = require("./db");
const RemoteBrowserModel = require("./model/remote_browser");

class RemoteBrowser {
    /**
     * Gets remote browser from ID
     * @param {number} remoteBrowserID ID of the remote browser
     * @param {number} userID ID of the user who created the remote browser
     * @returns {Promise<import("./model/remote_browser")>} Remote Browser
     */
    static async get(remoteBrowserID, userID) {
        const bean = await RemoteBrowserModel.query().where({ id: remoteBrowserID,
            user_id: userID }).first();

        if (!bean) {
            throw new Error("Remote browser not found");
        }

        return bean;
    }

    /**
     * Save a Remote Browser
     * @param {object} remoteBrowser Remote Browser to save
     * @param {?number} remoteBrowserID ID of the Remote Browser to update
     * @param {number} userID ID of the user who adds the Remote Browser
     * @returns {Promise<import("./model/remote_browser")>} Updated Remote Browser
     */
    static async save(remoteBrowser, remoteBrowserID, userID) {
        const payload = {
            user_id: userID,
            name: remoteBrowser.name,
            url: remoteBrowser.url,
        };

        if (remoteBrowserID) {
            const existing = await RemoteBrowserModel.query().where({ id: remoteBrowserID,
                user_id: userID }).first();
            if (!existing) {
                throw new Error("Remote browser not found");
            }
            return RemoteBrowserModel.query().patchAndFetchById(remoteBrowserID, payload);
        }
        return RemoteBrowserModel.query().insertAndFetch(payload);
    }

    /**
     * Delete a Remote Browser
     * @param {number} remoteBrowserID ID of the Remote Browser to delete
     * @param {number} userID ID of the user who created the Remote Browser
     * @returns {Promise<void>}
     */
    static async delete(remoteBrowserID, userID) {
        const knex = getKnex();
        const existing = await knex("remote_browser").where({ id: remoteBrowserID,
            user_id: userID }).first();

        if (!existing) {
            throw new Error("Remote Browser not found");
        }

        // Detach removed remote browser from monitors
        await knex("monitor").where("remote_browser", remoteBrowserID).update({ remote_browser: null });

        await knex("remote_browser").where("id", remoteBrowserID).delete();
    }
}

module.exports = {
    RemoteBrowser,
};
