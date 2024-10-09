<template>
    <div class="mb-3">
        <label for="push-api-key" class="form-label">{{ $t("API Key (required)") }}</label>
        <HiddenInput id="push-api-key" v-model="$parent.notification.pushAPIKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="push-api-title" class="form-label">{{ $t("Title") }}</label>
        <input id="push-api-title" v-model="$parent.notification.pushTitle" type="text" class="form-control">
    </div>

    <div class="mb-3">
        <label for="push-api-channel" class="form-label">{{ $t("Channel") }}</label>
        <input id="push-api-channel" v-model="$parent.notification.pushChannel" type="text" class="form-control">
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
};
</script>
