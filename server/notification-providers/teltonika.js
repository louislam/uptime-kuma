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

        let passedUrl = "";
        try {
            passedUrl = new URL(notification.teltonikaUrl);
        } catch (error) {
            throw Error("Invalid URL: " + notification.teltonikaUrl);
        }

        const baseUrl = passedUrl.origin;
        const loginUrl = baseUrl + "/api/login";
        const smsUrl = baseUrl + "/api/messages/actions/send";

        // Performing some input validation and cleanup for the other fields.
        let cleanUser = "";
        try {
            cleanUser = notification.teltonikaUsername.replace(/[^\x20-\x7F]/g, "").substring(0, 30);
            if (cleanUser.length >= 30) {
                throw Error("Username is longer than 30.");
            } else if (cleanUser.length < 1) {
                throw Error("Username is empty.");
            }

        } catch (error) {
            throw Error("Invalid input data for username.");
        }

        let cleanPass = "";
        try {
            cleanPass = notification.teltonikaPassword.replace(/[^\x20-\x7F]/g, "").substring(0, 40);

            if (cleanPass.length >= 30) {
                throw Error("Password is longer than 30.");
            } else if (cleanPass.length < 1) {
                throw Error("Password is empty.");
            }

        } catch (error) {
            throw Error("Invalid input data for password.");
        }

        let cleanModem = "";
        try {
            cleanModem = notification.teltonikaModem.replace(/[^\x2A-\x39]/g, "").substring(0, 5);

            if (cleanModem.length >= 5) {
                throw Error("Modem identifier is too long.");
            } else if (cleanModem.length < 1) {
                throw Error("Modem identifier is empty.");
            }

        } catch (error) {
            throw Error("Invalid input data for modem.");
        }

        let cleanPhoneNumber = "";
        try {
            cleanPhoneNumber = notification.teltonikaPhoneNumber.replace(/[^\x2A-\x39]/g, "").substring(0, 30);

            if (cleanPhoneNumber.length >= 30) {
                throw Error("Phone number is too long.");
            } else if (cleanPhoneNumber.length < 1) {
                throw Error("Phone number is empty.");
            }

        } catch (error) {
            throw Error("Invalid input data for phone number.");
        }

        // Many people who use a Teltonika router will not setup a proper
        // TLS certificate. I know that we all should and I hate that I'm
        // adding the option to disable cert validation, but here we are.
        // https://sslinsights.com/how-to-fix-axios-self-signed-certificate-errors/

        if (notification.teltonikaUnsafeTls === true) {
            var unsafeAgent = new https.Agent({  
                rejectUnauthorized: false // ⚠️ Disables SSL verification  
            });
        }

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
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                },
            };

            if (notification.teltonikaUnsafeTls === true) {
                loginConfig.httpsAgent = unsafeAgent;
            }

            loginConfig = this.getAxiosConfigWithProxy(loginConfig);

            let loginResp = await axios.post(loginUrl, loginData, loginConfig);

            if (loginResp.data.success !== true) {
                throw Error("Login failed: " + loginResp.data.errors.error);
            }

            const teltonikaToken = "Bearer " + loginResp.data.data.token;

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
                headers: {
                    "Authorization": teltonikaToken,
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    "Accept": "application/json",
                },
            };

            if (notification.teltonikaUnsafeTls === true) {
                smsConfig.httpsAgent = unsafeAgent;
            }

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
