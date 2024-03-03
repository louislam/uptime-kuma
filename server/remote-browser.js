const { R } = require("redbean-node");

class RemoteBrowser {

    /**
     * Gets remote browser from ID
     * @param {number} remoteBrowserID ID of the remote browser
     * @param {number} userID ID of the user who created the remote browser
     * @returns {Promise<Bean>} Remote Browser
     */
    static async get(remoteBrowserID, userID) {
        let bean = await R.findOne("remote_browser", " id = ? AND user_id = ? ", [ remoteBrowserID, userID ]);

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
     * @returns {Promise<Bean>} Updated Remote Browser
     */
    static async save(remoteBrowser, remoteBrowserID, userID) {
        let bean;

        if (remoteBrowserID) {
            bean = await R.findOne("remote_browser", " id = ? AND user_id = ? ", [ remoteBrowserID, userID ]);

            if (!bean) {
                throw new Error("Remote browser not found");
            }

        } else {
            bean = R.dispense("remote_browser");
        }

        bean.user_id = userID;
        bean.name = remoteBrowser.name;
        bean.url = remoteBrowser.url;

        await R.store(bean);

        return bean;
    }

    /**
     * Delete a Remote Browser
     * @param {number} remoteBrowserID ID of the Remote Browser to delete
     * @param {number} userID ID of the user who created the Remote Browser
     * @returns {Promise<void>}
     */
    static async delete(remoteBrowserID, userID) {
        let bean = await R.findOne("remote_browser", " id = ? AND user_id = ? ", [ remoteBrowserID, userID ]);

        if (!bean) {
            throw new Error("Remote Browser not found");
        }

        // Delete removed remote browser from monitors if exists
        await R.exec("UPDATE monitor SET remote_browser = null WHERE remote_browser = ?", [ remoteBrowserID ]);

        await R.trash(bean);
    }

}

module.exports = {
    RemoteBrowser,
};
