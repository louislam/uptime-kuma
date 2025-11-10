<template>
    <div class="mb-3">
        <label for="smsir-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput id="smsir-key" v-model="$parent.notification.smsirApiKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="smsir-number" class="form-label">{{ $t("Recipient Number") }}</label>
        <input id="smsir-number" v-model="$parent.notification.smsirNumber" placeholder="9123456789" type="text" maxlength="10" minlength="10" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="smsir-template" class="form-label">{{ $t("Template ID") }}</label>
        <input id="smsir-template" v-model="$parent.notification.smsirTemplate" placeholder="12345" type="text" class="form-control" required>
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
