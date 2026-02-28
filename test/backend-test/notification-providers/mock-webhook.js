const express = require("express");
const bodyParser = require("body-parser");

/**
 * @param {number} port Port number
 * @param {string} url Webhook URL
 * @param {number} timeout Timeout
 * @returns {Promise<object>} Webhook data
 */
async function mockWebhook(port, url, timeout = 2500) {
    return new Promise((resolve, reject) => {
        const app = express();
        const tmo = setTimeout(() => {
            server.close();
            reject({ reason: "Timeout" });
        }, timeout);
        app.use(bodyParser.json()); // Middleware to parse JSON bodies
        app.post(`/${url}`, (req, res) => {
            res.status(200).send("OK");
            server.close();
            tmo && clearTimeout(tmo);
            resolve(req.body);
        });
        const server = app.listen(port);
    });
}

module.exports = mockWebhook;
