const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN } = require("../../src/util");

class Telegram extends NotificationProvider {

    name = "telegram";


    /**
     * @private
     *
     * @param {string} name service name
     * @param {number} status 1 or 0
     * @return {string} 
     * @memberof Telegram
     */
    getTitle(name, status) {
        const emoji = status ? "✅" : "❌"
        return status ? `${emoji} Your Service [${name}] is UP! ${emoji}` : `${emoji} Your Service [${name}] is DOWN! ${emoji}`
    }

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";
        const inlineKeyboard = [
            [
                {
                    text: this.getTitle(monitorJSON?.name, heartbeatJSON?.status),
                    callback_data: "nothing",
                },
            ],
            [
                {
                    text: `Ping - ${heartbeatJSON?.ping}ms`,
                    callback_data: "nothing",
                }
            ],
            [
                {
                    text: heartbeatJSON?.time,
                    callback_data: "nothing",
                }
            ]
        ]

        // add error text to message
        if (heartbeatJSON?.status === DOWN) {
            inlineKeyboard.push([
                {
                    text: `Error: ${heartbeatJSON?.msg}`,
                    callback_data: "nothing"
                }
            ])
        }

        // Add link to website to message
        if (monitorJSON?.type === "http") {
            inlineKeyboard.push([
                {
                    text: `Open [${monitorJSON?.name}]`,
                    url: monitorJSON?.url
                }
            ])
        }

        try {
            // https://core.telegram.org/bots/api#sendmessage
            await axios.get(`https://api.telegram.org/bot${notification.telegramBotToken}/sendMessage`, {
                params: {
                    chat_id: notification.telegramChatID,
                    text: "­", // ALT + 0173 (that string isn't empty!)
                    parse_mode: "markdown",
                    reply_markup: {
                        // https://core.telegram.org/bots/api#inlinekeyboardmarkup
                        // https://core.telegram.org/bots/api#inlinekeyboardbutton
                        inline_keyboard: inlineKeyboard
                    }
                },
            });
            return okMsg;

        } catch (error) {
            let msg = (error.response.data.description) ? error.response.data.description : "Error without description";
            throw new Error(msg);
        }
    }
}

module.exports = Telegram;
