<template>
    <div class="mb-3">
        <label for="push-api-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput id="push-api-key" v-model="$parent.notification.pushAPIKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="push-api-title" class="form-label">{{ $t("Title") }}</label>
        <input id="push-api-title" v-model="$parent.notification.pushTitle" type="text" class="form-control">
    </div>

    <div class="mb-3">
        <label for="push-api-channel" class="form-label">{{ $t("Notification Channel") }}</label>
        <input id="push-api-channel" v-model="$parent.notification.pushChannel" type="text" class="form-control" patttern="[A-Za-z0-9-]+">
        <div class="form-text">
            {{ $t("Alphanumerical string and hyphens only") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="push-api-sound" class="form-label">{{ $t("Sound") }}</label>
        <select id="push-api-sound" v-model="$parent.notification.pushSound" class="form-select">
            <option value="default">{{ $t("Default") }}</option>
            <option value="arcade">{{ $t("Arcade") }}</option>
            <option value="correct">{{ $t("Correct") }}</option>
            <option value="fail">{{ $t("Fail") }}</option>
            <option value="harp">{{ $t("Harp") }}</option>
            <option value="reveal">{{ $t("Reveal") }}</option>
            <option value="bubble">{{ $t("Bubble") }}</option>
            <option value="doorbell">{{ $t("Doorbell") }}</option>
            <option value="flute">{{ $t("Flute") }}</option>
            <option value="money">{{ $t("Money") }}</option>
            <option value="scifi">{{ $t("Scifi") }}</option>
            <option value="clear">{{ $t("Clear") }}</option>
            <option value="elevator">{{ $t("Elevator") }}</option>
            <option value="guitar">{{ $t("Guitar") }}</option>
            <option value="pop">{{ $t("Pop") }}</option>
        </select>
        <div class="form-text">
            {{ $t("Custom sound to override default notification sound") }}
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.pushTimeSensitive" class="form-check-input" type="checkbox">
            <label class="form-check-label">{{ $t("Time Sensitive (iOS Only)") }}</label>
        </div>
        <div class="form-text">
            {{ $t("Time sensitive notifications will be delivered immediately, even if the device is in do not disturb mode.") }}
        </div>
    </div>

    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://docs.push.techulus.com" target="_blank">https://docs.push.techulus.com</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.pushTitle === "undefined") {
            this.$parent.notification.pushTitle = "Uptime-Kuma";
        }
        if (typeof this.$parent.notification.pushChannel === "undefined") {
            this.$parent.notification.pushChannel = "uptime-kuma";
        }
        if (typeof this.$parent.notification.pushSound === "undefined") {
            this.$parent.notification.pushSound = "default";
        }
        if (typeof this.$parent.notification.pushTimeSensitive === "undefined") {
            this.$parent.notification.pushTimeSensitive = true;
        }
    },
};
</script>
