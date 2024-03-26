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
            <option value="alpha">{{ $t("Alpha (recommended)") }}</option>
            <option value="numeric">{{ $t("Numeric") }}</option>
        </select>
        <div class="form-text">
            <p><b>{{ $t("Alpha (recommended)") }}:</b><br /> {{ $t("Alphanumeric string (max 11 alphanumeric characters). Recipients can not reply to the message.") }}</p>
            <p><b>{{ $t("Numeric") }}:</b><br /> {{ $t("Numeric value (max 15 digits) with telephone number on international format without leading 00 (example UK number 07920 110 000 should be set as 447920110000). Recipients can reply to the message.") }}</p>
        </div>
    </div>
    <div class="mb-3">
        <label for="cellsynt-originator" class="form-label">{{ $t("Originator") }}</label>
        <input id="cellsynt-originator" v-model="$parent.notification.cellsyntOriginator" type="text" class="form-control" required>
        <div class="form-text"><p>{{ $t("Visible on recipient's mobile phone as originator of the message. Allowed values and function depends on parameter originatortype.") }}</p></div>
    </div>
    <div class="mb-3">
        <label for="cellsynt-destination" class="form-label">{{ $t("Destination") }}</label>
        <input id="cellsynt-destination" v-model="$parent.notification.cellsyntDestination" type="text" class="form-control" required>
        <div class="form-text"><p>{{ $t("Recipient's telephone number using international format with leading 00 followed by country code, e.g. 00447920110000 for the UK number 07920 110 000 (max 17 digits in total). Max 25000 comma separated recipients per HTTP request.") }}</p></div>
    </div>
    <div class="form-check form-switch">
        <input id="cellsynt-allow-long" v-model="$parent.notification.cellsyntAllowLongSMS" type="checkbox" class="form-check-input">
        <label for="cellsynt-allow-long" class="form-label">{{ $t("Allow Long SMS") }}</label>
        <div class="form-text">{{ $t("Long SMS (also known as \"concatenated SMS\") enables sending messages exceeding 160 characters.") }}</div>
    </div>
    <div class="mb-3">
        <div class="form-text">
            {{ $t("For sign-up and price information check out this link") }}, <a href="https://www.cellsynt.com/en/" target="_blank">https://www.cellsynt.com/en/</a>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput
    },
    mounted() {
        this.$parent.notification.cellsyntOriginator = "uptime-kuma";
        this.$parent.notification.cellsyntOriginatortype = "alpha";
        console.log("hello world");
    }
};
</script>
