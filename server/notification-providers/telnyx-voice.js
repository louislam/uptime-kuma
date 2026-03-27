const NotificationProvider = require("./notification-provider");
const axios = require("axios");

/**
 * Telnyx Voice notification provider.
 * Uses the Telnyx Call Control API to place an outbound call and read the
 * alert message via text-to-speech when the call is answered.
 *
 * The static {@link TelnyxVoice.pendingCalls} map stores in-flight call state
 * so that the webhook handler in api-router can deliver the speak / hangup
 * commands once the call is answered.
 */
class TelnyxVoice extends NotificationProvider {
    name = "telnyxVoice";

    /**
     * Holds call state for in-progress voice calls, keyed by call_control_id.
     * Each entry is { speechText: string, apiKey: string }.
     * Entries are removed after the call ends or after a 5-minute safety timeout.
     * @type {Map<string, {speechText: string, apiKey: string}>}
     */
    static pendingCalls = new Map();

    /**
     * @inheritdoc
     */
    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        const okMsg = "Sent Successfully.";

        try {
            // Build the spoken text, substituting {kumaMessage} with the real alert.
            const templateText =
                notification.telnyxVoiceText && notification.telnyxVoiceText.trim()
                    ? notification.telnyxVoiceText
                    : "{kumaMessage}";
            const speechText = templateText.replace("{kumaMessage}", msg);

            const baseUrl = (notification.telnyxVoiceBaseUrl || "").replace(/\/+$/, "");
            const webhookUrl = baseUrl + "/api/telnyx-voice-callback";

            let config = {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: "Bearer " + notification.telnyxApiKey,
                },
            };
            config = this.getAxiosConfigWithProxy(config);

            const callResponse = await axios.post(
                "https://api.telnyx.com/v2/calls",
                {
                    connection_id: notification.telnyxVoiceAppId,
                    to: notification.telnyxToNumber,
                    from: notification.telnyxPhoneNumber,
                    webhook_url: webhookUrl,
                    webhook_url_method: "POST",
                },
                config
            );

            const callControlId = callResponse.data.data.call_control_id;

            TelnyxVoice.pendingCalls.set(callControlId, {
                speechText,
                apiKey: notification.telnyxApiKey,
            });

            // Safety clean-up: remove stale entry after 5 minutes in case
            // the call never reaches a terminal state.
            setTimeout(() => {
                TelnyxVoice.pendingCalls.delete(callControlId);
            }, 300000);

            return okMsg;
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }

    /**
     * Handle an incoming Telnyx Call Control webhook event.
     * Called by the /api/telnyx-voice-callback route in api-router.js.
     * @param {object} event The parsed JSON body from Telnyx
     * @returns {Promise<void>}
     */
    static async handleWebhook(event) {
        if (!event || !event.data || !event.data.payload) {
            return;
        }

        const eventType = event.data.event_type;
        const callControlId = event.data.payload.call_control_id;

        const pending = TelnyxVoice.pendingCalls.get(callControlId);
        if (!pending) {
            // Not an Uptime Kuma managed call; ignore.
            return;
        }

        const headers = {
            "Content-Type": "application/json",
            Authorization: "Bearer " + pending.apiKey,
        };

        if (eventType === "call.answered") {
            // Speak the alert message via text-to-speech.
            await axios.post(
                `https://api.telnyx.com/v2/calls/${callControlId}/actions/speak`,
                {
                    payload: pending.speechText,
                    payload_type: "text",
                    voice: "female",
                    language: "en-US",
                },
                { headers }
            );
        } else if (eventType === "call.speak.ended") {
            // Hang up once the message has finished.
            await axios.post(`https://api.telnyx.com/v2/calls/${callControlId}/actions/hangup`, {}, { headers });
            TelnyxVoice.pendingCalls.delete(callControlId);
        }
    }
}

module.exports = TelnyxVoice;
