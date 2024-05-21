<template>
    <div class="mb-3">
        <label for="smspartner-key" class="form-label">{{ $t("smspartnerApikey") }}</label>
        <HiddenInput id="smspartner-key" v-model="$parent.notification.smspartnerApikey" :required="true" autocomplete="new-password"></HiddenInput>
        <div class="form-text">
            {{ $t("smspartnerApiurl") }}
            <a href="https://my.smspartner.fr/dashboard/api" target="_blank">https://my.smspartner.fr/dashboard/api</a>
        </div>
    </div>
    <div class="mb-3">
        <label for="smspartner-phone-number" class="form-label">{{ $t("smspartnerPhoneNumber") }}</label>
        <input id="smspartner-phone-number" v-model="$parent.notification.smspartnerPhoneNumber" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="smspartner-sender-name" class="form-label">{{ $t("smspartnerSenderName") }}</label>
        <input id="smspartner-sender-name" v-model="$parent.notification.smspartnerSenderName" type="text" minlength="3" maxlength="11" class="form-control">
        <div class="form-text">
            {{ $t("smspartnerSenderNameInfo") }}
        </div>
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
