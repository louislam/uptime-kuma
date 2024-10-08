<template>
    <div class="mb-3">
        <label for="smspartner-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput id="smspartner-key" v-model="$parent.notification.smspartnerApikey" :required="true" autocomplete="new-password"></HiddenInput>
        <div class="form-text">
            <i18n-t keypath="smspartnerApiurl" tag="div" class="form-text">
                <a href="https://my.smspartner.fr/dashboard/api" target="_blank">my.smspartner.fr/dashboard/api</a>
            </i18n-t>
        </div>
    </div>
    <div class="mb-3">
        <label for="smspartner-phone-number" class="form-label">{{ $t("smspartnerPhoneNumber") }}</label>
        <input id="smspartner-phone-number" v-model="$parent.notification.smspartnerPhoneNumber" type="text" minlength="3" maxlength="20" pattern="^[\d+,]+$" class="form-control" required>
        <div class="form-text">
            <i18n-t keypath="smspartnerPhoneNumberHelptext" tag="div" class="form-text">
                <code>+336xxxxxxxx</code>
                <code>+496xxxxxxxx</code>
                <code>,</code>
            </i18n-t>
        </div>
    </div>
    <div class="mb-3">
        <label for="smspartner-sender-name" class="form-label">{{ $t("smspartnerSenderName") }}</label>
        <input id="smspartner-sender-name" v-model="$parent.notification.smspartnerSenderName" type="text" minlength="3" maxlength="11" pattern="^[a-zA-Z0-9]*$" class="form-control" required>
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
