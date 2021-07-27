const axios = require("axios");
const { R } = require("redbean-node");
const FormData = require("form-data");
const nodemailer = require("nodemailer");
const child_process = require("child_process");

class Notification {

    /**
     *
     * @param notification
     * @param msg
     * @param monitorJSON
     * @param heartbeatJSON
     * @returns {Promise<string>} Successful msg
     * Throw Error with fail msg
     */
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully. ";

        if (notification.type === "telegram") {
            try {
                await axios.get(`https://api.telegram.org/bot${notification.telegramBotToken}/sendMessage`, {
                    params: {
                        chat_id: notification.telegramChatID,
                        text: msg,
                    },
                })
                return okMsg;

            } catch (error) {
                let msg = (error.response.data.description) ? error.response.data.description : "Error without description"
                throw new Error(msg)
            }

        } else if (notification.type === "gotify") {
            try {
                if (notification.gotifyserverurl && notification.gotifyserverurl.endsWith("/")) {
                    notification.gotifyserverurl = notification.gotifyserverurl.slice(0, -1);
                }
                await axios.post(`${notification.gotifyserverurl}/message?token=${notification.gotifyapplicationToken}`, {
                    "message": msg,
                    "priority": notification.gotifyPriority || 8,
                    "title": "Uptime-Kuma",
                })

                return okMsg;

            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "webhook") {
            try {
                let data = {
                    heartbeat: heartbeatJSON,
                    monitor: monitorJSON,
                    msg,
                };
                let finalData;
                let config = {};

                if (notification.webhookContentType === "form-data") {
                    finalData = new FormData();
                    finalData.append("data", JSON.stringify(data));

                    config = {
                        headers: finalData.getHeaders(),
                    }

                } else {
                    finalData = data;
                }

                await axios.post(notification.webhookURL, finalData, config)
                return okMsg;

            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "smtp") {
            return await Notification.smtp(notification, msg)

        } else if (notification.type === "discord") {
            try {
                // If heartbeatJSON is null, assume we're testing.
                if (heartbeatJSON == null) {
                    let data = {
                        username: "Uptime-Kuma",
                        content: msg,
                    }
                    await axios.post(notification.discordWebhookUrl, data)
                    return okMsg;
                }
                // If heartbeatJSON is not null, we go into the normal alerting loop.
                if (heartbeatJSON["status"] == 0) {
                    var alertColor = "16711680";
                } else if (heartbeatJSON["status"] == 1) {
                    var alertColor = "65280";
                }
                let data = {
                    username: "Uptime-Kuma",
                    embeds: [{
                        title: "Uptime-Kuma Alert",
                        color: alertColor,
                        fields: [
                            {
                                name: "Time (UTC)",
                                value: heartbeatJSON["time"],
                            },
                            {
                                name: "Message",
                                value: msg,
                            },
                        ],
                    }],
                }
                await axios.post(notification.discordWebhookUrl, data)
                return okMsg;
            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "signal") {
            try {
                let data = {
                    "message": msg,
                    "number": notification.signalNumber,
                    "recipients": notification.signalRecipients.replace(/\s/g, "").split(","),
                };
                let config = {};

                await axios.post(notification.signalURL, data, config)
                return okMsg;
            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "slack") {
            try {
                if (heartbeatJSON == null) {
                    let data = {
                        "text": "Uptime Kuma Slack testing successful.",
                        "channel": notification.slackchannel,
                        "username": notification.slackusername,
                        "icon_emoji": notification.slackiconemo,
                    }
                    await axios.post(notification.slackwebhookURL, data)
                    return okMsg;
                }

                const time = heartbeatJSON["time"];
                let data = {
                    "text": "Uptime Kuma Alert",
                    "channel": notification.slackchannel,
                    "username": notification.slackusername,
                    "icon_emoji": notification.slackiconemo,
                    "blocks": [{
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "Uptime Kuma Alert",
                        },
                    },
                    {
                        "type": "section",
                        "fields": [{
                            "type": "mrkdwn",
                            "text": "*Message*\n" + msg,
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Time (UTC)*\n" + time,
                        }],
                    },
                    {
                        "type": "actions",
                        "elements": [
                            {
                                "type": "button",
                                "text": {
                                    "type": "plain_text",
                                    "text": "Visit Uptime Kuma",
                                },
                                "value": "Uptime-Kuma",
                                "url": notification.slackbutton || "https://github.com/louislam/uptime-kuma",
                            },
                        ],
                    }],
                }
                await axios.post(notification.slackwebhookURL, data)
                return okMsg;
            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "pushover") {
            let pushoverlink = "https://api.pushover.net/1/messages.json"
            try {
                if (heartbeatJSON == null) {
                    let data = {
                        "message": "<b>Uptime Kuma Pushover testing successful.</b>",
                        "user": notification.pushoveruserkey,
                        "token": notification.pushoverapptoken,
                        "sound": notification.pushoversounds,
                        "priority": notification.pushoverpriority,
                        "title": notification.pushovertitle,
                        "retry": "30",
                        "expire": "3600",
                        "html": 1,
                    }
                    await axios.post(pushoverlink, data)
                    return okMsg;
                }

                let data = {
                    "message": "<b>Uptime Kuma Alert</b>\n\n<b>Message</b>:" + msg + "\n<b>Time (UTC)</b>:" + heartbeatJSON["time"],
                    "user": notification.pushoveruserkey,
                    "token": notification.pushoverapptoken,
                    "sound": notification.pushoversounds,
                    "priority": notification.pushoverpriority,
                    "title": notification.pushovertitle,
                    "retry": "30",
                    "expire": "3600",
                    "html": 1,
                }
                await axios.post(pushoverlink, data)
                return okMsg;
            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "apprise") {

            return Notification.apprise(notification, msg)

        } else {
            throw new Error("Notification type is not supported")
        }
    }

    static async save(notification, notificationID, userID) {
        let bean

        if (notificationID) {
            bean = await R.findOne("notification", " id = ? AND user_id = ? ", [
                notificationID,
                userID,
            ])

            if (! bean) {
                throw new Error("notification not found")
            }

        } else {
            bean = R.dispense("notification")
        }

        bean.name = notification.name;
        bean.user_id = userID;
        bean.config = JSON.stringify(notification)
        await R.store(bean)
    }

    static async delete(notificationID, userID) {
        let bean = await R.findOne("notification", " id = ? AND user_id = ? ", [
            notificationID,
            userID,
        ])

        if (! bean) {
            throw new Error("notification not found")
        }

        await R.trash(bean)
    }

    static async smtp(notification, msg) {

        let transporter = nodemailer.createTransport({
            host: notification.smtpHost,
            port: notification.smtpPort,
            secure: notification.smtpSecure,
            auth: {
                user: notification.smtpUsername,
                pass: notification.smtpPassword,
            },
        });

        // send mail with defined transport object
        await transporter.sendMail({
            from: `"Uptime Kuma" <${notification.smtpFrom}>`,
            to: notification.smtpTo,
            subject: msg,
            text: msg,
        });

        return "Sent Successfully.";
    }

    static async apprise(notification, msg) {
        let s = child_process.spawnSync("apprise", [ "-vv", "-b", msg, notification.appriseURL])

        let output = (s.stdout) ? s.stdout.toString() : "ERROR: maybe apprise not found";

        if (output) {

            if (! output.includes("ERROR")) {
                return "Sent Successfully";
            }

            throw new Error(output)
        } else {
            return ""
        }
    }

    static checkApprise() {
        let commandExistsSync = require("command-exists").sync;
        let exists = commandExistsSync("apprise");
        return exists;
    }

}

function throwGeneralAxiosError(error) {
    let msg = "Error: " + error + " ";

    if (error.response && error.response.data) {
        if (typeof error.response.data === "string") {
            msg += error.response.data;
        } else {
            msg += JSON.stringify(error.response.data)
        }
    }

    throw new Error(msg)
}

module.exports = {
    Notification,
}
