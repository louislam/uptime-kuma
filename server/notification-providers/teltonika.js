// This notification provider is only compatible with Teltonika RMS >= 7.14.0 devices.
// See: https://community.teltonika.lt/t/implementation-of-read-only-system-files-and-mobile-and-i-o-post-get-service-removal-with-rutos-7-14/12470
// API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/messages

const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const https = require("https");

class Teltonika extends NotificationProvider {
    name = "Teltonika";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        // baseUrl is passed via the configuration screen.
        // Must be limited to _just_ the full origin, so: proto://host:port.
        // Everything else should be stripped. Best way to validate is to use URL().

        let passedUrl = "";
        try {
            passedUrl = new URL(notification.teltonikaUrl);
        } catch (error) {
            throw Error("Invalid URL: " + notification.teltonikaUrl);
        }

        const baseUrl = passedUrl.origin;
        const loginUrl = baseUrl + "/api/login";
        const smsUrl = baseUrl + "/api/messages/actions/send";

        // Teltonika SMS gateway supports a max of 160 chars for its messages.
        const cleanMsg = msg.substring(0, 159);

        // Starting communications with the API from here on out.
        try {
            let axiosConfig = {
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    Accept: "application/json",
                },
            };

            // In many cases, Teltonika routers will be setup using a self-signed
            // certificate. Here we give them an option to disable certificate
            // validation. It's not desirable, but sometimes the only option.
            if (notification.teltonikaUnsafeTls) {
                axiosConfig.httpsAgent = new https.Agent({
                    rejectUnauthorized: false, // Danger! Disables SSL verification
                });
            }

            axiosConfig = this.getAxiosConfigWithProxy(axiosConfig);

            // Logging in, to get an access token.
            // API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/authentication
            // Teltonika's API access tokens expire in 5 minutes, so we always get a new one.
            let loginData = {
                username: notification.teltonikaUsername,
                password: notification.teltonikaPassword,
            };

            let loginResp = await axios.post(loginUrl, loginData, axiosConfig);

            if (loginResp.data.success !== true) {
                throw Error("Login failed: " + loginResp.data.errors.error);
            }

            // Sending the SMS.
            let smsData = {
                data: {
                    modem: notification.teltonikaModem,
                    number: notification.teltonikaPhoneNumber,
                    message: cleanMsg,
                },
            };

            axiosConfig.headers.Authorization = "Bearer " + loginResp.data.data.token;

            let smsResp = await axios.post(smsUrl, smsData, axiosConfig);

            if (smsResp.data.success !== true) {
                throw Error("Api returned: ", smsResp.data.errors.error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Teltonika;
