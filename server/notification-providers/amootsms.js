const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class AmootSMS extends NotificationProvider {
    name = "amootsms";

    /**
     * @param {object} notification Notification configuration
     * @param {string} msg Notification message
     * @param {object|null} monitorJSON Monitor data
     * @param {object|null} heartbeatJSON Heartbeat data
     * @returns {Promise<string>} Result message
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const statusMessages = {
            "-300": "System_Disabled",
            "-208": "Token_NotAllowMethod",
            "-207": "Token_NotAllowIP",
            "-204": "Token_Expired",
            "-203": "Token_Disabled",
            "-202": "Token_Invalid",
            "-201": "Token_NotExists",
            "-109": "User_NotAllowHttp",
            "-108": "User_NotAllowMethod",
            "-107": "User_NotAllowIP",
            "-106": "User_NotAllowWebService",
            "-105": "User_WebServiceBanned",
            "-104": "User_Expired",
            "-103": "User_Disabled",
            "-102": "User_MobileNotVerified",
            "-1": "User_NotExists",
            0: "Failed",
            1: "Success",
            2: "AccountIsDemo",
            4: "CreditNotEnough",
            5: "LineNumber_NotExist",
            6: "BackupLineNumber_NotExist",
            7: "Avanak_NotAvailable",
            10: "UserName_Empty",
            11: "Password_Empty",
            12: "LineNumber_Empty",
            13: "BackupLineNumber_Empty",
            14: "SMSMessageText_Empty",
            15: "AvanakMessageText_Empty",
            16: "Mobile_Empty",
            17: "Mobiles_Empty",
            18: "Title_Empty",
            19: "FirstNameOrLastName_Empty",
            20: "URLAddress_Empty",
            100: "UserNameOrPassword_Invalid",
            101: "Mobile_Invalid",
            102: "Mobiles_Invalid",
            103: "Count_Invalid",
            104: "FromRow_Invalid",
            105: "FromDate_Invalid",
            106: "FromDateTime_Invalid",
            107: "ToDate_Invalid",
            108: "ToDateTime_Invalid",
            109: "FromDateIsAfterThanToDate",
            110: "FromDateTimeIsAfterThanToDateTime",
            111: "MessageID_Invalid",
            112: "BulkID_Invalid",
            113: "ContactID_Invalid",
            114: "ContactGroupID_Invalid",
            115: "CourseID_Invalid",
            116: "CourseGroupID_Invalid",
            117: "URLAddress_Duplicate",
            118: "RelayMessageDeliveryID_Invalid",
            119: "RelayRecieveMessageID_Invalid",
            120: "Length_Invalid",
            121: "Length_Exceeded",
            500: "ServerError",
        };

        const mobiles = String(notification.amootMobiles || "")
            .split(",")
            .map((mobile) => mobile.trim())
            .filter(Boolean);

        if (!notification.amootApiToken) {
            throw new Error("Amoot SMS API token is required.");
        }

        if (mobiles.length === 0) {
            throw new Error("At least one Amoot SMS recipient number is required.");
        }

        if (notification.amootUsePattern && !notification.amootPatternCodeId) {
            throw new Error("Amoot SMS Pattern Code ID is required.");
        }

        if ((!notification.amootUsePattern || notification.amootUseOwnLine) && !notification.amootLineNumber) {
            throw new Error("Amoot SMS line number is required.");
        }

        if (notification.amootUsePattern) {
            if (notification.amootUseOwnLine) {
                return this.sendWithPatternOwn(notification, msg, mobiles);
            }

            return this.sendWithPattern(notification, msg, mobiles);
        }

        const getIranDateTime = () => {
            const parts = new Intl.DateTimeFormat("en-US", {
                timeZone: "Asia/Tehran",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hourCycle: "h23",
            }).formatToParts(new Date());

            const values = {};

            for (const part of parts) {
                values[part.type] = part.value;
            }

            return `${values.year}-${values.month}-${values.day} ${values.hour}:${values.minute}:${values.second}`;
        };

        const data = new URLSearchParams();

        data.append("SendDateTime", getIranDateTime());
        data.append("SMSMessageText", msg);
        data.append("LineNumber", notification.amootLineNumber);
        data.append("Mobiles", mobiles.join(","));

        const config = {
            headers: {
                Authorization: notification.amootApiToken,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };

        try {
            const response = await axios.post(
                "https://portal.amootsms.com/rest/SendSimple",
                data,
                this.getAxiosConfigWithProxy(config)
            );

            const result = response.data;

            if (!result || typeof result !== "object") {
                throw new Error("Amoot SMS API returned an unexpected response.");
            }

            if (result.Status && result.Status !== "Success") {
                const errorMessage = result.ErrorMessage ? `: ${result.ErrorMessage}` : "";

                throw new Error(`Amoot SMS API error: ${result.Status}${errorMessage}`);
            }

            if (!Array.isArray(result.Data) || result.Data.length === 0) {
                throw new Error("Amoot SMS API returned an unexpected response.");
            }

            const failedMessage = result.Data.find((item) => {
                const status = item?.Status;

                return status !== 1 && status !== "1" && status !== "Success";
            });

            if (failedMessage) {
                const rawStatus = failedMessage.Status;
                const numericStatus = Number(rawStatus);

                if (!Number.isNaN(numericStatus)) {
                    const statusTitle = statusMessages[numericStatus] || "UnknownError";

                    throw new Error(`Amoot SMS API error: ${statusTitle} (${numericStatus})`);
                }

                throw new Error(`Amoot SMS API error: ${rawStatus}`);
            }

            return "Sent Successfully.";
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.throwGeneralAxiosError(error);
            }

            throw error;
        }
    }

    /**
     * Send an SMS notification using an Amoot SMS pattern.
     * @param {object} notification Notification configuration
     * @param {string} msg Notification message
     * @param {string[]} mobiles Recipient mobile numbers
     * @returns {Promise<string>} Result message
     */
    async sendWithPattern(notification, msg, mobiles) {
        const config = {
            headers: {
                Authorization: notification.amootApiToken,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        };

        try {
            for (const mobile of mobiles) {
                const data = new URLSearchParams();

                data.append("Token", notification.amootApiToken);
                data.append("Mobile", mobile);
                data.append("PatternCodeID", String(notification.amootPatternCodeId));
                data.append("PatternValues", msg);

                const response = await axios.post(
                    "https://portal.amootsms.com/rest/SendWithPattern",
                    data,
                    this.getAxiosConfigWithProxy(config)
                );

                const result = response.data;

                if (!result || typeof result !== "object") {
                    throw new Error("Amoot SMS API returned an unexpected response.");
                }

                if (result.Status && result.Status !== "Success") {
                    const errorMessage = result.ErrorMessage ? `: ${result.ErrorMessage}` : "";

                    throw new Error(`Amoot SMS API error: ${result.Status}${errorMessage}`);
                }
            }

            return "Sent Successfully.";
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.throwGeneralAxiosError(error);
            }

            throw error;
        }
    }

    /**
     * Send an SMS notification using an Amoot SMS pattern with an own line.
     * @param {object} notification Notification configuration
     * @param {string} msg Notification message
     * @param {string[]} mobiles Recipient mobile numbers
     * @returns {Promise<string>} Result message
     */
    async sendWithPatternOwn(notification, msg, mobiles) {
        const config = {
            headers: {
                Authorization: `Bearer ${notification.amootApiToken}`,
                "Content-Type": "application/json",
            },
        };

        try {
            for (const mobile of mobiles) {
                const data = {
                    Token: notification.amootApiToken,
                    LineNumber: notification.amootLineNumber,
                    Mobile: mobile,
                    PatternCodeID: Number(notification.amootPatternCodeId),
                    PatternValues: msg,
                };

                const response = await axios.post(
                    "https://portal.amootsms.com/rest/SendWithPatternOWN",
                    data,
                    this.getAxiosConfigWithProxy(config)
                );

                const result = response.data;

                if (!result || typeof result !== "object") {
                    throw new Error("Amoot SMS API returned an unexpected response.");
                }

                if (result.Status && result.Status !== "Success") {
                    const errorMessage = result.ErrorMessage ? `: ${result.ErrorMessage}` : "";

                    throw new Error(`Amoot SMS API error: ${result.Status}${errorMessage}`);
                }
            }

            return "Sent Successfully.";
        } catch (error) {
            if (axios.isAxiosError(error)) {
                this.throwGeneralAxiosError(error);
            }

            throw error;
        }
    }
}

module.exports = AmootSMS;
