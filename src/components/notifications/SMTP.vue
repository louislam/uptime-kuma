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
        <label for="secure" class="form-label">Secure</label>
        <select id="secure" v-model="$parent.notification.smtpSecure" class="form-select">
            <option :value="false">None / STARTTLS (25, 587)</option>
            <option :value="true">TLS (465)</option>
        </select>
    </div>

    <div class="mb-3">
        <div class="form-check">
            <input id="ignore-tls-error" v-model="$parent.notification.smtpIgnoreTLSError" class="form-check-input" type="checkbox" value="">
            <label class="form-check-label" for="ignore-tls-error">
                Ignore TLS Error
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
        <label for="from-email" class="form-label">From Email</label>
        <input id="from-email" v-model="$parent.notification.smtpFrom" type="text" class="form-control" required autocomplete="false" placeholder="&quot;Uptime Kuma&quot; &lt;example@kuma.pet&gt;">
        <div class="form-text">
        </div>
    </div>

    <div class="mb-3">
        <label for="to-email" class="form-label">To Email</label>
        <input id="to-email" v-model="$parent.notification.smtpTo" type="text" class="form-control" required autocomplete="false" placeholder="example2@kuma.pet, example3@kuma.pet">
    </div>

    <div class="mb-3">
        <label for="to-cc" class="form-label">CC</label>
        <input id="to-cc" v-model="$parent.notification.smtpCC" type="text" class="form-control" autocomplete="false">
    </div>

    <div class="mb-3">
        <label for="to-bcc" class="form-label">BCC</label>
        <input id="to-bcc" v-model="$parent.notification.smtpBCC" type="text" class="form-control" autocomplete="false">
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    data() {
        return {
            name: "smtp",
        }
    },
}
</script>
