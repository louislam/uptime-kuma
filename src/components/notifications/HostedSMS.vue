<template>
    <div class="mb-3">
        <label for="hostedsms-username" class="form-label">{{ $t('hostedsmsAPIUser') }}</label>
        <input id="hostedsms-username" v-model="$parent.notification.hostedsmsUsername" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="hostedsms-key" class="form-label">{{ $t('hostedsmsAPIPassword') }}</label>
        <HiddenInput id="hostedsms-key" v-model="$parent.notification.hostedsmsPassword" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="hostedsms-phone-number" class="form-label">{{ $t("hostedsmsPhoneNumber") }}</label>
        <input id="hostedsms-phone-number" v-model="$parent.notification.hostedsmsPhoneNumber" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="hostedsms-sender-name" class="form-label">{{ $t("hostedsmsSenderName") }}</label>
        <input id="hostedsms-sender-name" v-model="$parent.notification.hostedsmsSenderName" type="text" minlength="3" maxlength="11" class="form-control">
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
