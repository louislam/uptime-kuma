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
                const discordDisplayName = notification.discordUsername || "Uptime Kuma";

                // If heartbeatJSON is null, assume we're testing.
                if (heartbeatJSON == null) {
                    let discordtestdata = {
                        username: discordDisplayName,
                        content: msg,
                    }
                    await axios.post(notification.discordWebhookUrl, discordtestdata)
                    return okMsg;
                }

                let url;

                if (monitorJSON["type"] === "port") {
                    url = monitorJSON["hostname"];
                    if (monitorJSON["port"]) {
                        url += ":" + monitorJSON["port"];
                    }

                } else {
                    url = monitorJSON["url"];
                }

                // If heartbeatJSON is not null, we go into the normal alerting loop.
                if (heartbeatJSON["status"] == 0) {
                    let discorddowndata = {
                        username: discordDisplayName,
                        embeds: [{
                            title: "❌ Your service " + monitorJSON["name"] + " went down. ❌",
                            color: 16711680,
                            timestamp: heartbeatJSON["time"],
                            fields: [
                                {
                                    name: "Service Name",
                                    value: monitorJSON["name"],
                                },
                                {
                                    name: "Service URL",
                                    value: url,
                                },
                                {
                                    name: "Time (UTC)",
                                    value: heartbeatJSON["time"],
                                },
                                {
                                    name: "Error",
                                    value: heartbeatJSON["msg"],
                                },
                            ],
                        }],
                    }
                    await axios.post(notification.discordWebhookUrl, discorddowndata)
                    return okMsg;

                } else if (heartbeatJSON["status"] == 1) {
                    let discordupdata = {
                        username: discordDisplayName,
                        embeds: [{
                            title: "✅ Your service " + monitorJSON["name"] + " is up! ✅",
                            color: 65280,
                            timestamp: heartbeatJSON["time"],
                            fields: [
                                {
                                    name: "Service Name",
                                    value: monitorJSON["name"],
                                },
                                {
                                    name: "Service URL",
                                    value: url.startsWith("http") ? "[Visit Service](" + url + ")" : url,
                                },
                                {
                                    name: "Time (UTC)",
                                    value: heartbeatJSON["time"],
                                },
                                {
                                    name: "Ping",
                                    value: heartbeatJSON["ping"] + "ms",
                                },
                            ],
                        }],
                    }
                    await axios.post(notification.discordWebhookUrl, discordupdata)
                    return okMsg;
                }
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

        } else if (notification.type === "pushy") {
            try {
                await axios.post(`https://api.pushy.me/push?api_key=${notification.pushyAPIKey}`, {
                    "to": notification.pushyToken,
                    "data": {
                        "message": "Uptime-Kuma"
                    },
                    "notification": {
                        "body": msg,
                        "badge": 1,
                        "sound": "ping.aiff"
                    }
                })
                return true;
            } catch (error) {
                console.log(error)
                return false;
            }
        } else if (notification.type === "octopush") {
            try {
                let config = {
                    headers: {
                        "api-key": notification.octopushAPIKey,
                        "api-login": notification.octopushLogin,
                        "cache-control": "no-cache"
                    }
                };
                let data = {
                    "recipients": [
                        {
                            "phone_number": notification.octopushPhoneNumber
                        }
                    ],
                    //octopush not supporting non ascii char
                    "text": msg.replace(/[^\x00-\x7F]/g, ""),
                    "type": notification.octopushSMSType,
                    "purpose": "alert",
                    "sender": notification.octopushSenderName
                };

                await axios.post("https://api.octopush.com/v1/public/sms-campaign/send", data, config)
                return true;
            } catch (error) {
                console.log(error)
                return false;
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

        } else if (notification.type === "rocket.chat") {
            try {
                if (heartbeatJSON == null) {
                    let data = {
                        "text": "Uptime Kuma Rocket.chat testing successful.",
                        "channel": notification.rocketchannel,
                        "username": notification.rocketusername,
                        "icon_emoji": notification.rocketiconemo,
                    }
                    await axios.post(notification.rocketwebhookURL, data)
                    return okMsg;
                }

                const time = heartbeatJSON["time"];
                let data = {
                    "text": "Uptime Kuma Alert",
                    "channel": notification.rocketchannel,
                    "username": notification.rocketusername,
                    "icon_emoji": notification.rocketiconemo,
                    "attachments": [
                        {
                            "title": "Uptime Kuma Alert *Time (UTC)*\n" + time,
                            "title_link": notification.rocketbutton,
                            "text": "*Message*\n" + msg,
                            "color": "#32cd32"
                        }
                    ]
                }
                await axios.post(notification.rocketwebhookURL, data)
                return okMsg;
            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "mattermost") {
            try {
                const mattermostUserName = notification.mattermostusername || "Uptime Kuma";
                // If heartbeatJSON is null, assume we're testing.
                if (heartbeatJSON == null) {
                    let mattermostTestData = {
                        username: mattermostUserName,
                        text: msg,
                    }
                    await axios.post(notification.mattermostWebhookUrl, mattermostTestData)
                    return okMsg;
                }

                const mattermostChannel = notification.mattermostchannel;
                const mattermostIconEmoji = notification.mattermosticonemo;
                const mattermostIconUrl = notification.mattermosticonurl;

                if (heartbeatJSON["status"] == 0) {
                    let mattermostdowndata = {
                        username: mattermostUserName,
                        text: "Uptime Kuma Alert",
                        channel: mattermostChannel,
                        icon_emoji: mattermostIconEmoji,
                        icon_url: mattermostIconUrl,
                        attachments: [
                            {
                                fallback:
                                    "Your " +
                                    monitorJSON["name"] +
                                    " service went down.",
                                color: "#FF0000",
                                title:
                                    "❌ " +
                                    monitorJSON["name"] +
                                    " service went down. ❌",
                                title_link: monitorJSON["url"],
                                fields: [
                                    {
                                        short: true,
                                        title: "Service Name",
                                        value: monitorJSON["name"],
                                    },
                                    {
                                        short: true,
                                        title: "Time (UTC)",
                                        value: heartbeatJSON["time"],
                                    },
                                    {
                                        short: false,
                                        title: "Error",
                                        value: heartbeatJSON["msg"],
                                    },
                                ],
                            },
                        ],
                    };
                    await axios.post(
                        notification.mattermostWebhookUrl,
                        mattermostdowndata
                    );
                    return okMsg;
                } else if (heartbeatJSON["status"] == 1) {
                    let mattermostupdata = {
                        username: mattermostUserName,
                        text: "Uptime Kuma Alert",
                        channel: mattermostChannel,
                        icon_emoji: mattermostIconEmoji,
                        icon_url: mattermostIconUrl,
                        attachments: [
                            {
                                fallback:
                                    "Your " +
                                    monitorJSON["name"] +
                                    " service went up!",
                                color: "#32CD32",
                                title:
                                    "✅ " +
                                    monitorJSON["name"] +
                                    " service went up! ✅",
                                title_link: monitorJSON["url"],
                                fields: [
                                    {
                                        short: true,
                                        title: "Service Name",
                                        value: monitorJSON["name"],
                                    },
                                    {
                                        short: true,
                                        title: "Time (UTC)",
                                        value: heartbeatJSON["time"],
                                    },
                                    {
                                        short: false,
                                        title: "Ping",
                                        value: heartbeatJSON["ping"] + "ms",
                                    },
                                ],
                            },
                        ],
                    };
                    await axios.post(
                        notification.mattermostWebhookUrl,
                        mattermostupdata
                    );
                    return okMsg;
                }
            } catch (error) {
                throwGeneralAxiosError(error);
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

        } else if (notification.type === "lunasea") {
            let lunaseadevice = "https://notify.lunasea.app/v1/custom/device/" + notification.lunaseaDevice

            try {
                if (heartbeatJSON == null) {
                    let testdata = {
                        "title": "Uptime Kuma Alert",
                        "body": "Testing Successful.",
                    }
                    await axios.post(lunaseadevice, testdata)
                    return okMsg;
                }

                if (heartbeatJSON["status"] == 0) {
                    let downdata = {
                        "title": "UptimeKuma Alert: " + monitorJSON["name"],
                        "body": "[🔴 Down] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                    }
                    await axios.post(lunaseadevice, downdata)
                    return okMsg;
                }

                if (heartbeatJSON["status"] == 1) {
                    let updata = {
                        "title": "UptimeKuma Alert: " + monitorJSON["name"],
                        "body": "[✅ Up] " + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"],
                    }
                    await axios.post(lunaseadevice, updata)
                    return okMsg;
                }

            } catch (error) {
                throwGeneralAxiosError(error)
            }

        } else if (notification.type === "pushbullet") {
            try {
                let pushbulletUrl = "https://api.pushbullet.com/v2/pushes";
                let config = {
                    headers: {
                        "Access-Token": notification.pushbulletAccessToken,
                        "Content-Type": "application/json"
                    }
                };
                if (heartbeatJSON == null) {
                    let testdata = {
                        "type": "note",
                        "title": "Uptime Kuma Alert",
                        "body": "Testing Successful.",
                    }
                    await axios.post(pushbulletUrl, testdata, config)
                } else if (heartbeatJSON["status"] == 0) {
                    let downdata = {
                        "type": "note",
                        "title": "UptimeKuma Alert: " + monitorJSON["name"],
                        "body": "[🔴 Down]" + heartbeatJSON["msg"] + "\nTime (UTC):" + heartbeatJSON["time"],
                    }
                    await axios.post(pushbulletUrl, downdata, config)
                } else if (heartbeatJSON["status"] == 1) {
                    let updata = {
                        "type": "note",
                        "title": "UptimeKuma Alert: " + monitorJSON["name"],
                        "body": "[✅ Up]" + heartbeatJSON["msg"] + "\nTime (UTC):" + heartbeatJSON["time"],
                    }
                    await axios.post(pushbulletUrl, updata, config)
                }
                return okMsg;
            } catch (error) {
                throwGeneralAxiosError(error)
            }
        } else if (notification.type === "line") {
            try {
                let lineAPIUrl = "https://api.line.me/v2/bot/message/push";
                let config = {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": "Bearer " + notification.lineChannelAccessToken
                    }
                };
                if (heartbeatJSON == null) {
                    let testMessage = {
                        "to": notification.lineUserID,
                        "messages": [
                            {
                                "type": "text",
                                "text": "Test Successful!"
                            }
                        ]
                    }
                    await axios.post(lineAPIUrl, testMessage, config)
                } else if (heartbeatJSON["status"] == 0) {
                    let downMessage = {
                        "to": notification.lineUserID,
                        "messages": [
                            {
                                "type": "text",
                                "text": "UptimeKuma Alert: [🔴 Down]\n" + "Name: " + monitorJSON["name"] + " \n" + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"]
                            }
                        ]
                    }
                    await axios.post(lineAPIUrl, downMessage, config)
                } else if (heartbeatJSON["status"] == 1) {
                    let upMessage = {
                        "to": notification.lineUserID,
                        "messages": [
                            {
                                "type": "text",
                                "text": "UptimeKuma Alert: [✅ Up]\n" + "Name: " + monitorJSON["name"] + " \n" + heartbeatJSON["msg"] + "\nTime (UTC): " + heartbeatJSON["time"]
                            }
                        ]
                    }
                    await axios.post(lineAPIUrl, upMessage, config)
                }
                return okMsg;
            } catch (error) {
                throwGeneralAxiosError(error)
            }
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

        const config = {
            host: notification.smtpHost,
            port: notification.smtpPort,
            secure: notification.smtpSecure,
        };

        // Should fix the issue in https://github.com/louislam/uptime-kuma/issues/26#issuecomment-896373904
        if (notification.smtpUsername || notification.smtpPassword) {
            config.auth = {
                user: notification.smtpUsername,
                pass: notification.smtpPassword,
            };
        }

        let transporter = nodemailer.createTransport(config);

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
