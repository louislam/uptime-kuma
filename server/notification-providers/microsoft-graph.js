const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class MicrosoftGraph extends NotificationProvider {
    name = "MicrosoftGraph";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        const toRecipients = this.parseRecipients(notification.msGraphTo);
        const ccRecipients = this.parseRecipients(notification.msGraphCC);
        const bccRecipients = this.parseRecipients(notification.msGraphBCC);
        if (toRecipients.length + ccRecipients.length + bccRecipients.length === 0) {
            throw new Error("At least one recipient (To, CC or BCC) is required");
        }

        const mailbox = notification.msGraphMailbox?.trim();
        if (!mailbox) {
            throw new Error("Sender mailbox is required");
        }

        // default values in case the user does not want to template
        let subject = msg;
        let body = msg;
        let useHTMLBody = false;
        if (heartbeatJSON) {
            body = `${msg}\nTime (${heartbeatJSON["timezone"]}): ${heartbeatJSON["localDateTime"]}`;
        }
        if ((monitorJSON && heartbeatJSON) || msg.endsWith("Testing")) {
            const customSubject = notification.customSubject?.trim() || "";
            const customBody = notification.customBody?.trim() || "";
            if (customSubject !== "") {
                subject = await this.renderTemplate(customSubject, msg, monitorJSON, heartbeatJSON);
            }
            if (customBody !== "") {
                useHTMLBody = notification.htmlBody || false;
                body = await this.renderTemplate(customBody, msg, monitorJSON, heartbeatJSON);
            }
        }

        try {
            const accessToken = await this.getAccessToken(notification);

            const data = {
                message: {
                    subject,
                    body: {
                        contentType: useHTMLBody ? "HTML" : "Text",
                        content: body,
                    },
                    toRecipients,
                    ccRecipients,
                    bccRecipients,
                },
                saveToSentItems: false,
            };

            const config = this.getAxiosConfigWithProxy({
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json",
                },
            });

            await axios.post(
                `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(mailbox)}/sendMail`,
                data,
                config
            );
            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Acquires an access token using the OAuth2 client credentials flow
     * @param {object} notification Notification settings
     * @returns {Promise<string>} Access token
     * @throws {Error} When the token response does not contain an access token
     */
    async getAccessToken(notification) {
        const tenantId = notification.msGraphTenantId?.trim();
        const params = new URLSearchParams({
            client_id: notification.msGraphClientId?.trim() || "",
            client_secret: notification.msGraphClientSecret || "",
            scope: "https://graph.microsoft.com/.default",
            grant_type: "client_credentials",
        });

        const config = this.getAxiosConfigWithProxy({
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });

        const res = await axios.post(
            `https://login.microsoftonline.com/${encodeURIComponent(tenantId || "")}/oauth2/v2.0/token`,
            params.toString(),
            config
        );

        if (!res.data?.access_token) {
            throw new Error("Failed to obtain access token from Microsoft Entra ID");
        }
        return res.data.access_token;
    }

    /**
     * Parses a comma or semicolon separated list of e-mail addresses into Graph recipients
     * @param {string} value Address list
     * @returns {Array<{emailAddress: {address: string}}>} Graph recipient objects
     */
    parseRecipients(value) {
        if (!value) {
            return [];
        }
        return String(value)
            .split(/[,;]/)
            .map((address) => address.trim())
            .filter((address) => address !== "")
            .map((address) => ({ emailAddress: { address } }));
    }
}

module.exports = MicrosoftGraph;
