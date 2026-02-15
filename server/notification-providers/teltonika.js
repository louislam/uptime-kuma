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
        // Must be limited to _just_ the full origin, so:
        // proto://host:port
        // Everything else should be stripped. Best way to validate is to use URL().

        try {
            var passedUrl = new URL(notification.teltonikaUrl);
        } catch (error) {
            throw Error("Invalid URL: " + notification.teltonikaUrl);
        }

        const baseUrl = passedUrl.origin;
        const loginUrl = baseUrl + "/api/login";
        const smsUrl = baseUrl + "/api/messages/actions/send";

        // Performing some input validation and cleanup for the other fields.
        try {
            var cleanUser = notification.teltonikaUsername.replace(/[^\x20-\x7F]/g, "").substring(0, 40);
        } catch (error) {
            throw Error("Invalid input data for username.");
        }
        try {
            var cleanPass = notification.teltonikaPassword.replace(/[^\x20-\x7F]/g, "").substring(0, 40);
        } catch (error) {
            throw Error("Invalid input data for password.");
        }
        try {
            var cleanModem = notification.teltonikaModem.replace(/[^\x2A-\x39]/g, "").substring(0, 5);
        } catch (error) {
            throw Error("Invalid input data for modem.");
        }
        try {
            var cleanPhoneNumber = notification.teltonikaPhoneNumber.replace(/[^\x2A-\x39]/g, "").substring(0, 30);
        } catch (error) {
            throw Error("Invalid input data for phone number.");
        }

        // Many people who use a Teltonika router will not setup a proper
        // TLS certificate. I know that we all should and I hate that I'm
        // adding the option to disable cert validation, but here we are.
        // https://sslinsights.com/how-to-fix-axios-self-signed-certificate-errors/

        const unsafeAgent = new https.Agent({  
            rejectUnauthorized: false // ⚠️ Disables SSL verification  
        });

        try {
            // Logging in, to get an access token.
            // API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/authentication
            // Teltonika's API access tokens expire in 5 minutes.
            // Their documentation suggests performing a new login for every SMS.

            // The login API returns two things:
            // Set-Cookie: token=<32 chars hexadecimal>
            // JSON data object in body, with the username, expiry (299sec) and group.
            // We rely on the cookie, which should be passed by Axios' withCredentials=True.

            let loginData = { 
                "username": cleanUser,
                "password": cleanPass
            };

            let loginConfig = {
                httpsAgent: unsafeAgent,
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                },
            };
            loginConfig = this.getAxiosConfigWithProxy(loginConfig);

            let loginResp = await axios.post(loginUrl, loginData, loginConfig);

            if (loginResp.data.success !== true) {
                throw Error("Login failed: " + loginResp.data.errors.error);
            }

            var teltonikaToken = "Bearer " + loginResp.data.data.token;

            // Sending the SMS.
            // API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/messages
            // Teltonika SMS gateway supports a max of 160 chars.
            // Better to limit to ASCII characters as well.
            let cleanMsg = msg.replace(/[^\x20-\x7F]/g, "").substring(0, 159);

            let smsData = { 
                data:{
                    "modem": cleanModem,
                    "number": cleanPhoneNumber,
                    "message": cleanMsg,
                 }
            };

            let smsConfig = {
                httpsAgent: unsafeAgent,
                withCredentials: true,
                headers: {
                    "Authorization": teltonikaToken,
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                },
            };
            smsConfig = this.getAxiosConfigWithProxy(smsConfig);

            let smsResp = await axios.post(smsUrl, smsData, smsConfig);

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
