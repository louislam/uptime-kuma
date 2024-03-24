<template>
    <div class="mb-3">
        <label for="cellsynt-login" class="form-label">{{ $t("Username") }}</label>
        <input id="cellsynt-login" v-model="$parent.notification.cellsyntLogin" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="cellsynt-key" class="form-label">{{ $t("Password") }}</label>
        <HiddenInput id="cellsynt-key" v-model="$parent.notification.cellsyntPassword" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="cellsynt-Originatortype" class="form-label">{{ $t("Originator type") }}</label>
        <select id="cellsynt-Originatortype" v-model="$parent.notification.cellsyntOriginatortype" :required="true" class="form-select">
            <option value="numeric">{{ $t("Numeric") }}</option>
            <option value="shortcode">{{ $t("Shortcode") }}</option>
            <option value="alpha">{{ $t("Alpha") }}</option>
        </select>
        <div class="form-text">
            <p><b>Numeric:</b><br>
                Numeric value (max 15 digits) with telephone number on
                international format without leading 00 (example UK number
                07920 110 000 should be set as 447920110000). Receiving
                mobile phone will add a leading + sign and thus see the
                originator as a normal mobile phone number (+447920110000).
                Therefore it is also possible to reply to the message.</p>
                <p><b>Shortcode:</b><br>
                Numerical value (max 15 digits). Used to set a shortcode in an
                operator network as originator (i.e. will be shown without leading
                + sign, e.g. 72456).</p>
                <p><b>Alpha:</b><br>
                Alphanumeric string (max 11 characters). The following
                characters are guaranteed to work: a-z, A-Z and 0-9. Other
                characters may work but functionality can not be guaranteed.
                Recipients can not reply to messages with alphanumeric
                originators.</p>
        </div>
    </div>
    <div class="mb-3">
        <label for="cellsynt-originator" class="form-label">{{ $t("Originator") }}</label>
        <input id="cellsynt-originator" v-model="$parent.notification.cellsyntOriginator" type="text" class="form-control" required>
        <div class="form-text"><p>Identifier which will be visible on recipient's mobile phone as
        originator of the message. Allowed values and function depends
        on parameter originatortype</p></div>
    </div>
    <div class="mb-3">
        <label for="cellsynt-destination" class="form-label">{{ $t("Destination") }}</label>
        <input id="cellsynt-destination" v-model="$parent.notification.cellsyntDestination" type="text" class="form-control" required>
        <div class="form-text"><p>Recipient's telephone number on international format with
leading 00 followed by country code, e.g. 00447920110000 for
UK number 07920 110 000 (max 17 digits in total).
To send the same message to multiple recipients, separate
numbers with comma. Max 25000 recipients per HTTP request.</p></div>
    </div>
    <div class="form-check form-switch">
        <input id="cellsynt-allow-long" v-model="$parent.notification.cellsyntAllowLongSMS" type="checkbox" class="form-check-input">
        <label for="cellsynt-allow-long" class="form-label">{{ $t("Allow Long SMS") }}</label>
        <div class="form-text">Long SMS (also known as "concatenated SMS") enables sending messages exceeding 160
characters.</div>
    </div>
    <div class="mb-3">
        <label for="cellsynt-destination" class="form-label">{{ $t("Details") }}</label>
        <div class="form-text">
            For sign-up and price information check out this link, <a href="https://www.cellsynt.com/en/" target="_blank">https://www.cellsynt.com/en/</a>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput
    }
};
</script>
