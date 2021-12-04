<template>
    <div class="mb-3">
        <label for="hostname" class="form-label">{{ $t("Hostname") }}</label>
        <input id="hostname" v-model="$parent.notification.smtpHost" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="port" class="form-label">{{ $t("Port") }}</label>
        <input id="port" v-model="$parent.notification.smtpPort" type="number" class="form-control" required min="0" max="65535" step="1">
    </div>

    <div class="mb-3">
        <label for="secure" class="form-label">{{ $t("Security") }}</label>
        <select id="secure" v-model="$parent.notification.smtpSecure" class="form-select">
            <option :value="false">{{ $t("secureOptionNone") }}</option>
            <option :value="true">{{ $t("secureOptionTLS") }}</option>
        </select>
    </div>

    <div class="mb-3">
        <div class="form-check">
            <input id="ignore-tls-error" v-model="$parent.notification.smtpIgnoreTLSError" class="form-check-input" type="checkbox" value="">
            <label class="form-check-label" for="ignore-tls-error">
                {{ $t("Ignore TLS Error") }}
            </label>
        </div>
    </div>

    <div class="mb-3">
        <label for="username" class="form-label">{{ $t("Username") }}</label>
        <input id="username" v-model="$parent.notification.smtpUsername" type="text" class="form-control" autocomplete="false">
    </div>

    <div class="mb-3">
        <label for="password" class="form-label">{{ $t("Password") }}</label>
        <HiddenInput id="password" v-model="$parent.notification.smtpPassword" :required="false" autocomplete="one-time-code"></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="from-email" class="form-label">{{ $t("From Email") }}</label>
        <input id="from-email" v-model="$parent.notification.smtpFrom" type="text" class="form-control" required autocomplete="false" placeholder="&quot;Uptime Kuma&quot; &lt;example@kuma.pet&gt;">
        <div class="form-text">
        </div>
    </div>

    <div class="mb-3">
        <label for="to-email" class="form-label">{{ $t("To Email") }}</label>
        <input id="to-email" v-model="$parent.notification.smtpTo" type="text" class="form-control" autocomplete="false" placeholder="example2@kuma.pet, example3@kuma.pet" :required="!hasRecipient">
    </div>

    <div class="mb-3">
        <label for="to-cc" class="form-label">{{ $t("smtpCC") }}</label>
        <input id="to-cc" v-model="$parent.notification.smtpCC" type="text" class="form-control" autocomplete="false" :required="!hasRecipient">
    </div>

    <div class="mb-3">
        <label for="to-bcc" class="form-label">{{ $t("smtpBCC") }}</label>
        <input id="to-bcc" v-model="$parent.notification.smtpBCC" type="text" class="form-control" autocomplete="false" :required="!hasRecipient">
    </div>

    <div class="mb-3">
        <label for="subject-email" class="form-label">{{ $t("emailCustomSubject") }}</label>
        <input id="subject-email" v-model="$parent.notification.customSubject" type="text" class="form-control" autocomplete="false" placeholder="">
        <div v-pre class="form-text">
            (leave blank for default one)<br />
            {{NAME}}: Service Name<br />
            {{HOSTNAME_OR_URL}}: Hostname or URL<br />
            {{URL}}: URL<br />
            {{STATUS}}: Status<br />
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    computed: {
        hasRecipient() {
            if (this.$parent.notification.smtpTo || this.$parent.notification.smtpCC || this.$parent.notification.smtpBCC) {
                return true;
            } else {
                return false;
            }
        }
    },
    mounted() {
        if (typeof this.$parent.notification.smtpSecure === "undefined") {
            this.$parent.notification.smtpSecure = false;
        }
    }
};
</script>
