<template>
    <div class="mb-3">
        <label for="brevo-api-key" class="form-label">{{ $t("brevoApiKey") }}</label>
        <HiddenInput id="brevo-api-key" v-model="$parent.notification.brevoApiKey" :required="true" autocomplete="new-password"></HiddenInput>
        <i18n-t tag="div" keypath="brevoApiHelp" class="form-text">
            <a href="https://app.brevo.com/settings/keys/api" target="_blank">https://app.brevo.com/settings/keys/api</a>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="brevo-from-email" class="form-label">{{ $t("brevoFromEmail") }}</label>
        <input id="brevo-from-email" v-model="$parent.notification.brevoFromEmail" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="brevo-from-name" class="form-label">{{ $t("brevoFromName") }}</label>
        <input id="brevo-from-name" v-model="$parent.notification.brevoFromName" type="text" class="form-control">
        <div class="form-text">{{ $t("brevoLeaveBlankForDefaultName") }}</div>
    </div>
    <div class="mb-3">
        <label for="brevo-to-email" class="form-label">{{ $t("brevoToEmail") }}</label>
        <input id="brevo-to-email" v-model="$parent.notification.brevoToEmail" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="brevo-cc-email" class="form-label">{{ $t("brevoCcEmail") }}</label>
        <input id="brevo-cc-email" v-model="$parent.notification.brevoCcEmail" type="text" class="form-control">
        <div class="form-text">{{ $t("brevoSeparateMultipleEmails") }}</div>
    </div>
    <div class="mb-3">
        <label for="brevo-bcc-email" class="form-label">{{ $t("brevoBccEmail") }}</label>
        <input id="brevo-bcc-email" v-model="$parent.notification.brevoBccEmail" type="text" class="form-control">
        <small class="form-text text-muted">{{ $t("brevoSeparateMultipleEmails") }}</small>
    </div>
    <div class="mb-3">
        <label for="brevo-subject" class="form-label">{{ $t("brevoSubject") }}</label>
        <input id="brevo-subject" v-model="$parent.notification.brevoSubject" type="text" class="form-control">
        <small class="form-text text-muted">{{ $t("brevoLeaveBlankForDefaultSubject") }}</small>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://developers.brevo.com/reference/sendtransacemail" target="_blank">https://developers.brevo.com/reference/sendtransacemail</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.brevoSubject === "undefined") {
            this.$parent.notification.brevoSubject = "Notification from Your Uptime Kuma";
        }
        if (typeof this.$parent.notification.brevoFromName === "undefined") {
            this.$parent.notification.brevoFromName = "Uptime Kuma";
        }
    },
};
</script>
