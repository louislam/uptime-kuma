const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class Teltonika extends NotificationProvider {
    name = "Teltonika";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";
        
        // baseUrl is passed via the configuration screen. 
        // Must be limited to _just_ the full origin, so:
        // proto://host:port
        // Everything else should be stripped. Best way to validate is to use URL().

        try {
            const passedUrl = new URL(notification.teltonikaUrl);
        } catch (error) {
            throw Error("Invalid URL: " + notification.teltonikaUrl);
        }

        const passedUrl = new URL(notification.teltonikaUrl);
        const baseUrl = passedUrl.origin;
        const loginUrl = baseUrl + "/api/login";
        const smsUrl = baseUrl + "/api/messages/actions/send";

        try {
            // Logging in, to get an access token.
            // API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/authentication
            // Teltonika's API access tokens expire in 5 minutes.
            // Their documentation suggests performing a new login for every SMS.

            // The login API returns two things:
            // Set-Cookie: token=<32 chars hexadecimal>
            // JSON data object in body, with the username, expiry (299sec) and group.
            // We rely on the cookie, which should be passed by Axios' withCredentials=True.

            let data = { 
                "data":{
                    "username": notification.teltonikaUsername,
                    "password": notification.teltonikaPassword,
                 }
            };
            console.log("Data: " + data);

            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            console.log("Login URL: " + loginUrl);
            let resp = await axios.post(loginUrl, data, config);

            console.log("Response: " + resp.data);
            if (resp.data.success !== true) {
                throw Error(`Login failed,${resp.data.response.status}.`);
            }

        } catch (error) {
            this.throwGeneralAxiosError(error);
        }

        try {
            // Sending the SMS.
            // API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/messages
            // Teltonika SMS gateway supports a max of 160 chars.
            // Better to limit to ASCII characters as well.s
            let cleanMsg = msg.replace(/[^\x00-\x7F]/g, "").substring(0, 159);

            let data = { 
                "data":{
                    "modem": notification.teltonikaModem,
                    "number": notification.teltonikaPhoneNumber,
                    "message": cleanMsg,
                 }
            };
            console.log("Data: " + data);

            let config = {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            console.log("SMS URL: " + smsUrl);
            let resp = await axios.post(smsUrl, data, config);

            cosole.log("Response: " + resp.data);
            if (resp.data.success !== true) {
                throw Error(`Api returned ${resp.data.response.status}.`);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = Teltonika;
