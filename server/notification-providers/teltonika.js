const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const https = require("https");

class Teltonika extends NotificationProvider {
    name = "Teltonika";
    // This notification provider is only compatible with Teltonika RMS >= 7.14.0 devices.
    // See: https://community.teltonika.lt/t/implementation-of-read-only-system-files-and-mobile-and-i-o-post-get-service-removal-with-rutos-7-14/12470
    // API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/messages

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

        // Performing input validation and cleanup for the other fields.

        // According to Teltonika's UI, a valid username is:
        //   A string of lowercase Latin letters, numbers, -, . and _ characters is accepted. 
        //   First character must be a lowercase Latin letter. Length between 1 and 32 characters.
        const userRegex = /^[a-z][a-zA-Z0-9-._]{0,31}$/;
        const cleanUser = userRegex.exec(notification.teltonikaUsername);
        if (!cleanUser) {
            throw Error("Username is empty.");
        }

        // According to Teltonika's UI, a valid username is:
        //   Min length is 15, max is 256. Must contain digit, uppercase letter, special symbol.
        const passRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[!@#$%^&*()_=+{}|;:,<.>?[\]\/\\\\]).{15,256}$/;
        const cleanPass = passRegex.exec(notification.teltonikaPassword);
        if (!cleanPass) {
            throw Error("Password is empty, or does not follow Teltonika requirements.");
        }

        const modemRegex = /[1-9][0-9]?-[1-9][0-9]?/;          // matches 1-1, 10-1, 10-10, etc.
        const cleanModem = modemRegex.exec(notification.teltonikaModem);
        if (!cleanModem) {
            throw Error("Modem is empty.");
        }

        const phoneRegex = /^\+(?:[0-9] ?){6,14}[0-9]$/;     // regex for ITU-T E.123 international phone number
        const cleanPhoneNumber = phoneRegex.exec(notification.teltonikaPhoneNumber);
        if (!cleanPhoneNumber) {
            throw Error("Phone number is empty.");
        }

        // Teltonika SMS gateway supports a max of 160 chars for its messages.
        const msgRegex = /^(?=.*?[A-Z])(?=.*?[a-z])(?=.*?[0-9])(?=.*?[!@#$%^&*()_=+{}|;:,<.>?[\]\/\\\\]).{1,159}$/;
        const cleanMsg = msgRegex.exec(msg);
        if (!cleanMsg) {
            throw Error("Message is empty.");
        }

        // Starting communications with the API from here on out.
        try {
            let axiosConfig = {
                headers: {
                    "Content-Type": "application/json",
                    "cache-control": "no-cache",
                    Accept: "application/json",
                },
            };

            // Many people who use a Teltonika router will not setup a proper
            // TLS certificate. I know that we all should and I hate that I'm
            // adding the option to disable cert validation, but here we are.
            // https://sslinsights.com/how-to-fix-axios-self-signed-certificate-errors/

            let unsafeAgent = "";
            if (notification.teltonikaUnsafeTls === true) {
                unsafeAgent = new https.Agent({
                    rejectUnauthorized: false, // Danger! Disables SSL verification
                });

                axiosConfig.httpsAgent = unsafeAgent;
            } else {
                unsafeAgent = undefined;
            }

            axiosConfig = this.getAxiosConfigWithProxy(axiosConfig);

            // Logging in, to get an access token.
            // API reference https://developers.teltonika-networks.com/reference/rut241/7.19.4/v1.11.1/authentication
            // Teltonika's API access tokens expire in 5 minutes.
            // Their documentation suggests performing a new login for every SMS.

            // The login API returns two things:
            // Set-Cookie: token=<32 chars hexadecimal>
            // JSON data object in body, with the username, expiry (299sec) and group.
            // We rely on the cookie, which should be passed by Axios' withCredentials=True.
            let loginData = {
                username: cleanUser[0],    // regex object [0] is the username
                password: cleanPass[0],    // regex object [0] is the password
            };

            let loginResp = await axios.post(loginUrl, loginData, axiosConfig);

            if (loginResp.data.success !== true) {
                throw Error("Login failed: " + loginResp.data.errors.error);
            }

            const teltonikaToken = "Bearer " + loginResp.data.data.token;

            // Sending the SMS.
            let smsData = {
                data: {
                    modem: cleanModem[0],           // regex object [0] is the modem
                    number: cleanPhoneNumber[0],    // regex object [0] is the phonenum
                    message: cleanMsg[0],           // regex object [0] is the message
                },
            };

            //axiosConfig.headers += {
            //        Authorization: teltonikaToken,
            //};
            axiosConfig.headers.Authorization = teltonikaToken;

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
