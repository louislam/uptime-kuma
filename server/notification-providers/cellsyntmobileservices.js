const NotificationProvider = require("./notification-provider");
const axios = require("axios");

class CellsyntMobileServices extends NotificationProvider {

    name = "cellsyntmobileservices";

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "Sent Successfully.";

        try {
            let config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Basic " + Buffer.from(notification.clicksendsmsLogin + ":" + notification.clicksendsmsPassword).toString("base64"),
                    "Accept": "text/json",
                }
            };
            let data = {
               /* messages: [
                    {
                        "body": msg.replace(/[^\x00-\x7F]/g, ""),
                        "to": notification.clicksendsmsToNumber,
                        "source": "uptime-kuma",
                        "from": notification.clicksendsmsSenderName,
                    }
                ]*/
                messages: [
                    {
                        //"from": notification.clicksendsmsSenderName,

                        /* Your username (received when account is setup). 
                        */
                        "username": "abc123",

                        /* Your password to use together with the username for
                           authentication (received when account is setup). 
                        */
                        "password": "abc123",

                        /*  Recipient's telephone number on international format with
                            leading 00 followed by country code, e.g. 00447920110000 for
                            UK number 07920 110 000 (max 17 digits in total).
                            To send the same message to multiple recipients, separate
                            numbers with comma. Max 25000 recipients per HTTP request. 
                        */
                        "destination": "0046738387444",

                        "text": msg.replace(/[^\x00-\x7F]/g, ""),
                        /* Character set text and other data is sent as in the HTTP
                           request. Possible values: ISO-8859-1 (default) and UTF-8 
                        */
                        "charset": "UTF-8",

                        /* Controls the originator type the message should be sent with.
                           Possible values: numeric, shortcode and alpha. 
                        */
                        "originatortype": "alpha",
                        
                        /* Identifier which will be visible on recipient's mobile phone as
                           originator of the message. Allowed values and function depends
                           on parameter originatortype's value according to below:
                           ** numeric **
                           Numeric value (max 15 digits) with telephone number on
                           international format without leading 00 (example UK number
                           07920 110 000 should be set as 447920110000). Receiving
                           mobile phone will add a leading + sign and thus see the
                           originator as a normal mobile phone number (+447920110000).
                           Therefore it is also possible to reply to the message.
                           ** shortcode **
                           Numerical value (max 15 digits). Used to set a shortcode in an
                           operator network as originator (i.e. will be shown without leading
                           + sign, e.g. 72456).
                           ** alpha **
                           3Send SMS
                           Alphanumeric string (max 11 characters). The following
                           characters are guaranteed to work: a-z, A-Z and 0-9. Other
                           characters may work but functionality can not be guaranteed.
                           Recipients can not reply to messages with alphanumeric
                           originators 
                        */
                        //"originator": "uptime-kuma",
                        "originator": notification.clicksendsmsSenderName,
                        /* Type of message that should be sent. Possible values: text
                           (default), binary and unicode */
                        "type": "text",

                        /* Maximum number of SMS permitted to be linked together when
                           needed (default value is 1, see Long SMS). Maximum value is 6
                          (i.e. max 153 x 6 = 918 characters).
                        */
                        "allowconcat": 1,

                        /* Can be used if you want to prevent a message from being
                           delivered after a certain time, e.g. 9 PM the same evening if
                           information thereafter is considered invalid / outdated. If
                           message has not been delivered after the set time (e.g. mobile
                           phone was switched off) you will get a delivery receipt with
                           status "failed".
                           Value should be given as a Unix timestamp. Different operators
                           permit different allowed max values (e.g. 3 days expiry time). If
                           a value is set that is above an operator's max allowed time it will
                           be adjusted to the highest possible value.
                        */
                        //"expiry": "9 PM",

                        /* Value can be set to true if message should be sent as "flash
                           message", i.e. displayed directly on phone screen instead of
                           being saved to inbox. This is identical to setting class=0.
                           Please note that support for flash messages cannot be
                           guaranteed to all operator networks. If flash is not supported the
                           message will be sent as a regular text message instead
                           (class=1).
                        */
                        //"flash": "",
                        
                        /* Message class can be set to 0 (flash message), 1 (default, MEspecific), 2 (SIM-specific) or 3 (TE-specific).
                        */
                       //"class": "",

                        /* UDH (User Data Header) can be used to send concatenated
                           SMS, contain formatting information, convey port numbers as a
                           mean to cause start of an application etc. The value should be
                           given on hexadecimal format for the corresponding bytes you
                           wish to send (e.g. AABBCC).
                        */
                        //"udh": "",

                        /* Protocol Identifier (specified in GSM 03.40) says how the
                           message should be interpreted. Value should be given on
                           hexadecimal format, e.g. 00 for a regular message and 7D
                           (decimal 125) for a configuration message ("ME Data
                           download").
                        */
                        //"pid": "",
                    }
                ]
            };
            let resp = await axios.post("https://se-1.cellsynt.net/sms.php", data, config);
            console.log(resp);
            if (resp.data.data.messages[0].status !== "SUCCESS") {
                let error = "Something gone wrong. Api returned " + resp.data.data.messages[0].status + ".";
                this.throwGeneralAxiosError(error);
            }

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = CellsyntMobileServices;
