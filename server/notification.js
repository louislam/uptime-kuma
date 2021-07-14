const axios = require("axios");
const { R } = require("redbean-node");
const FormData = require('form-data');
const nodemailer = require("nodemailer");

class Notification {
    static async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        if (notification.type === "telegram") {
            try {
                await axios.get(`https://api.telegram.org/bot${notification.telegramBotToken}/sendMessage`, {
                    params: {
                        chat_id: notification.telegramChatID,
                        text: msg,
                    }
                })
                return true;
            } catch (error) {
                console.log(error)
                return false;
            }

        } else if (notification.type === "gotify") {
            try {
                if (notification.gotifyserverurl.endsWith("/")) {
                    notification.gotifyserverurl = notification.gotifyserverurl.slice(0, -1);
                }
                await axios.post(`${notification.gotifyserverurl}/message?token=${notification.gotifyapplicationToken}`, {
                    "message": msg,
                    "priority": notification.gotifyPriority || 8,
                    "title": "Uptime-Kuma"
                })
                return true;
            } catch (error) {
                console.log(error)
                return false;
            }

        } else if (notification.type === "slack") {
            try {
                if (heartbeatJSON == null) {
                    let data = {
                        "blocks": [{
                            "type": "header",
                            "text": {
                                "type": "plain_text",
                                "text": "Uptime Kuma - Slack Testing"
                            }
                        },
                        {
                            "type": "section",
                            "fields": [{
                                "type": "mrkdwn",
                                "text": "*Message*\nSlack Testing"
                            },
                            {
                                "type": "mrkdwn",
                                "text": "*Time (UTC)*\nSlack Testing"
                            }
                            ]
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
                                    "url": notification.slackbutton
                                }
                            ]
                        }
                        ]
                    }
                    let res = await axios.post(notification.slackwebhookURL, data)
                    return true;
                }

                const time = heartbeatJSON["time"];
                let data = {
                    "blocks": [{
                        "type": "header",
                        "text": {
                            "type": "plain_text",
                            "text": "Uptime Kuma Alert"
                        }
                    },
                    {
                        "type": "section",
                        "fields": [{
                            "type": "mrkdwn",
                            "text": '*Message*\n' + msg
                        },
                        {
                            "type": "mrkdwn",
                            "text": "*Time (UTC)*\n" + time
                        }
                        ]
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
                                "url": notification.slackbutton
                            }
                        ]
                    }
                    ]
                }
                let res = await axios.post(notification.slackwebhookURL, data)
                return true;
            } catch (error) {
                console.log(error)
                return false;
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
                    finalData.append('data', JSON.stringify(data));

                    config = {
                        headers: finalData.getHeaders()
                    }

                } else {
                    finalData = data;
                }

                let res = await axios.post(notification.webhookURL, finalData, config)
                return true;
            } catch (error) {
                console.log(error)
                return false;
            }

        } else if (notification.type === "smtp") {
            return await Notification.smtp(notification, msg)

        } else if (notification.type === "discord") {
            try {
                // If heartbeatJSON is null, assume we're testing.
                if (heartbeatJSON == null) {
                    let data = {
                        username: 'Uptime-Kuma',
                        content: msg
                    }
                    let res = await axios.post(notification.discordWebhookUrl, data)
                    return true;
                }
                // If heartbeatJSON is not null, we go into the normal alerting loop.
                if (heartbeatJSON['status'] == 0) {
                    var alertColor = "16711680";
                } else if (heartbeatJSON['status'] == 1) {
                    var alertColor = "65280";
                }
                let data = {
                    username: 'Uptime-Kuma',
                    embeds: [{
                        title: "Uptime-Kuma Alert",
                        color: alertColor,
                        fields: [
                            {
                                name: "Time (UTC)",
                                value: heartbeatJSON["time"]
                            },
                            {
                                name: "Message",
                                value: msg
                            }
                        ]
                    }]
                }
                let res = await axios.post(notification.discordWebhookUrl, data)
                return true;
            } catch (error) {
                console.log(error)
                return false;
            }

        } else if (notification.type === "signal") {
            try {
                let data = {
                    "message": msg,
                    "number": notification.signalNumber,
                    "recipients": notification.signalRecipients.replace(/\s/g, '').split(",")
                };
                let config = {};

                let res = await axios.post(notification.signalURL, data, config)
                return true;
            } catch (error) {
                console.log(error)
                return false;
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

            if (!bean) {
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

        if (!bean) {
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
        let info = await transporter.sendMail({
            from: `"Uptime Kuma" <${notification.smtpFrom}>`,
            to: notification.smtpTo,
            subject: msg,
            text: msg,
        });

        return true;
    }

    static async discord(notification, msg) {
        const client = new Discord.Client();
        await client.login(notification.discordToken)

        const channel = await client.channels.fetch(notification.discordChannelID);
        await channel.send(msg);

        client.destroy()

        return true;
    }
}

module.exports = {
    Notification,
}
