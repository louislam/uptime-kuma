<template>
    <div class="mb-3">
        <label for="turbosmtp-consumer-key" class="form-label">{{ $t("turbosmtpConsumerKey") }}</label>
        <HiddenInput
            id="turbosmtp-consumer-key"
            v-model="$parent.notification.turbosmtpConsumerKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="turbosmtp-consumer-secret" class="form-label">{{ $t("turbosmtpConsumerSecret") }}</label>
        <HiddenInput
            id="turbosmtp-consumer-secret"
            v-model="$parent.notification.turbosmtpConsumerSecret"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="turbosmtp-region" class="form-label">{{ $t("Region") }}</label>
        <select
            id="turbosmtp-region"
            v-model="$parent.notification.turbosmtpRegion"
            :required="true"
            class="form-select"
        >
            <option value="us">US (Default)</option>
            <option value="eu">EU</option>
        </select>
    </div>
    <div class="mb-3">
        <label for="turbosmtp-from-email" class="form-label">{{ $t("From Email") }}</label>
        <input
            id="turbosmtp-from-email"
            v-model="$parent.notification.turbosmtpFromEmail"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="turbosmtp-to-email" class="form-label">{{ $t("To Email") }}</label>
        <input
            id="turbosmtp-to-email"
            v-model="$parent.notification.turbosmtpToEmail"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">{{ $t("Separate multiple email addresses with commas") }}</div>
    </div>
    <div class="mb-3">
        <label for="turbosmtp-cc-email" class="form-label">{{ $t("smtpCC") }}</label>
        <input
            id="turbosmtp-cc-email"
            v-model="$parent.notification.turbosmtpCcEmail"
            type="text"
            class="form-control"
        />
        <div class="form-text">{{ $t("Separate multiple email addresses with commas") }}</div>
    </div>
    <div class="mb-3">
        <label for="turbosmtp-bcc-email" class="form-label">{{ $t("smtpBCC") }}</label>
        <input
            id="turbosmtp-bcc-email"
            v-model="$parent.notification.turbosmtpBccEmail"
            type="text"
            class="form-control"
        />
        <div class="form-text">{{ $t("Separate multiple email addresses with commas") }}</div>
    </div>
    <div class="mb-3">
        <label for="turbosmtp-subject" class="form-label">{{ $t("Subject:") }}</label>
        <input
            id="turbosmtp-subject"
            v-model="$parent.notification.turbosmtpSubject"
            type="text"
            class="form-control"
        />
        <small class="form-text text-muted">{{ $t("leave blank for default subject") }}</small>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
        <a href="https://serversmtp.com/turbo-api/" target="_blank">https://serversmtp.com/turbo-api/</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.turbosmtpRegion === "undefined") {
            this.$parent.notification.turbosmtpRegion = "us";
        }
        if (typeof this.$parent.notification.turbosmtpSubject === "undefined") {
            this.$parent.notification.turbosmtpSubject = "Notification from Your Uptime Kuma";
        }
    },
};
</script>
