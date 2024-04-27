<template>
    <div class="mb-3">
        <label for="WebHookUrl" class="form-label">{{ $t("WebHookUrl") }}<span style="color: red;"><sup>*</sup></span></label>
        <input id="WebHookUrl" v-model="$parent.notification.webHookUrl" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="secretKey" class="form-label">{{ $t("SecretKey") }}<span style="color: red;"><sup>*</sup></span></label>
        <HiddenInput id="secretKey" v-model="$parent.notification.secretKey" :required="true" autocomplete="new-password"></HiddenInput>

        <div class="form-text">
            <p>{{ $t("For safety, must use secret key") }}</p>
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://developers.dingtalk.com/document/robots/custom-robot-access" target="_blank">https://developers.dingtalk.com/document/robots/custom-robot-access</a> <a href="https://open.dingtalk.com/document/robots/customize-robot-security-settings#title-7fs-kgs-36x" target="_blank">https://open.dingtalk.com/document/robots/customize-robot-security-settings#title-7fs-kgs-36x</a>
            </i18n-t>
        </div>
    </div>
    <div class="mb-3">
        <label for="mentioning" class="form-label">{{ $t("Mentioning") }}<span style="color: red;"><sup>*</sup></span></label>
        <select id="mentioning" v-model="$parent.notification.mentioning" class="form-select" required>
            <option value="nobody">{{ $t("Don't mention people") }}</option>
            <option value="everyone">{{ $t("Mention group", { group: "@everyone" }) }}</option>
        </select>
    </div>
</template>

<script lang="ts">
import HiddenInput from "../HiddenInput.vue";

export default {
    components: { HiddenInput },
    mounted() {
        if (typeof this.$parent.notification.mentioning === "undefined") {
            this.$parent.notification.mentioning = "nobody";
        }
    }
};
</script>
