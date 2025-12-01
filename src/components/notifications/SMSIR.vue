<template>
    <div class="mb-3">
        <label for="smsir-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput id="smsir-key" v-model="$parent.notification.smsirApiKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="smsir-number" class="form-label">{{ $t("Recipient Numbers") }}</label>
        <input id="smsir-number" v-model="$parent.notification.smsirNumber" placeholder="9123456789,09987654321" type="text" minlength="10" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="smsir-template" class="form-label">{{ $t("Template ID") }}</label>
        <input id="smsir-template" v-model="$parent.notification.smsirTemplate" placeholder="12345" type="text" class="form-control" required>
        <i18n-t tag="div" class="form-text" keypath="wayToGetClickSMSIRTemplateID">
            <template #uptkumaalert>
                <code>#uptkumaalert#</code>
            </template>
            <template #here>
                <a href="https://app.sms.ir/fast-send/template" target="_blank">{{ $t("here") }}</a>
            </template>
        </i18n-t>
    </div>
</template>
<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
