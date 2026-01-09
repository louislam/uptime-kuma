<template>
    <div class="mb-3">
        <label for="resend-api-key" class="form-label">{{ $t("resendApiKey") }}</label>
        <HiddenInput
            id="resend-api-key"
            v-model="$parent.notification.resendApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <i18n-t tag="div" keypath="resendApiHelp" class="form-text">
            <a href="https://resend.com/api-keys" target="_blank">https://resend.com/api-keys</a>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="resend-from-email" class="form-label">{{ $t("resendFromEmail") }}</label>
        <input
            id="resend-from-email"
            v-model="$parent.notification.resendFromEmail"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="resend-from-name" class="form-label">{{ $t("resendFromName") }}</label>
        <input id="resend-from-name" v-model="$parent.notification.resendFromName" type="text" class="form-control" />
        <div class="form-text">{{ $t("resendLeaveBlankForDefaultName") }}</div>
    </div>
    <div class="mb-3">
        <label for="resend-to-email" class="form-label">{{ $t("resendToEmail") }}</label>
        <input
            id="resend-to-email"
            v-model="$parent.notification.resendToEmail"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="resend-subject" class="form-label">{{ $t("resendSubject") }}</label>
        <input id="resend-subject" v-model="$parent.notification.resendSubject" type="text" class="form-control" />
        <small class="form-text text-muted">{{ $t("resendLeaveBlankForDefaultSubject") }}</small>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
        <a href="https://resend.com/docs/dashboard/emails/introduction" target="_blank">
            https://resend.com/docs/dashboard/emails/introduction
        </a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.resendSubject === "undefined") {
            this.$parent.notification.resendSubject = "Notification from Your Uptime Kuma";
        }
        if (typeof this.$parent.notification.resendFromName === "undefined") {
            this.$parent.notification.resendFromName = "Uptime Kuma";
        }
    },
};
</script>
