<template>
    <div class="mb-3">
        <label for="sendgrid-api-key" class="form-label">{{ $t("SendGrid API Key") }}</label>
        <HiddenInput id="push-api-key" v-model="$parent.notification.sendgridApiKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="sendgrid-from-email" class="form-label">{{ $t("From Email") }}</label>
        <input id="sendgrid-from-email" v-model="$parent.notification.sendgridFromEmail" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="sendgrid-to-email" class="form-label">{{ $t("To Email") }}</label>
        <input id="sendgrid-to-email" v-model="$parent.notification.sendgridToEmail" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="sendgrid-cc-email" class="form-label">{{ $t("smtpCC") }}</label>
        <input id="sendgrid-cc-email" v-model="$parent.notification.sendgridCcEmail" type="text" class="form-control">
        <div class="form-text">{{ $t("Separate multiple email addresses with commas") }}</div>
    </div>
    <div class="mb-3">
        <label for="sendgrid-bcc-email" class="form-label">{{ $t("smtpBCC") }}</label>
        <input id="sendgrid-bcc-email" v-model="$parent.notification.sendgridBccEmail" type="text" class="form-control">
        <small class="form-text text-muted">{{ $t("Separate multiple email addresses with commas") }}</small>
    </div>
    <div class="mb-3">
        <label for="sendgrid-subject" class="form-label">{{ $t("Subject:") }}</label>
        <input id="sendgrid-subject" v-model="$parent.notification.sendgridSubject" type="text" class="form-control">
        <small class="form-text text-muted">{{ $t("leave blank for default subject") }}</small>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://docs.sendgrid.com/api-reference/mail-send/mail-send" target="_blank">https://docs.sendgrid.com/api-reference/mail-send/mail-send</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.sendgridSubject === "undefined") {
            this.$parent.notification.sendgridSubject = "Notification from Your Uptime Kuma";
        }
    },
};
</script>
