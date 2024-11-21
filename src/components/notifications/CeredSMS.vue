<template>
    <div class="mb-3">
        <label for="ceredsms-key" class="form-label">{{ $t('API Key') }}</label>
        <HiddenInput id="ceredsms-key" v-model="$parent.notification.ceredsmsApiKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="ceredsms-phone-number" class="form-label">{{ $t("To Phone Number") }}</label>
        <input id="ceredsms-phone-number" v-model="$parent.notification.ceredsmsPhoneNumber" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="ceredsms-sender-name" class="form-label">{{ $t("Originator") }}</label>
        <input id="ceredsms-sender-name" v-model="$parent.notification.ceredsmsSenderName" type="text" minlength="3" maxlength="11" class="form-control">
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
