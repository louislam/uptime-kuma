<template>
    <div>
        <div class="mb-3">
            <label for="hostname" class="form-label">{{ $t("Hostname") }}</label>
            <input id="hostname" v-model="$parent.notification.smtpHost" type="text" class="form-control" required>
        </div>

        <i18n-t tag="div" keypath="Either enter the hostname of the server you want to connect to or localhost if you intend to use a locally configured mail transfer agent" class="form-text">
            <template #localhost>
                <code>localhost</code>
            </template>
            <template #local_mta>
                <a href="https://wikipedia.org/wiki/Mail_Transfer_Agent" target="_blank">{{ $t("locally configured mail transfer agent") }}</a>
            </template>
        </i18n-t>
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
            <HiddenInput id="password" v-model="$parent.notification.smtpPassword" :required="false" autocomplete="new-password"></HiddenInput>
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
            <TemplatedInput id="subject-email" v-model="$parent.notification.customSubject" :required="false" placeholder=""></TemplatedInput>
            <div class="form-text">{{ $t("leave blank for default subject") }}</div>
        </div>

        <div class="mb-3">
            <label for="body-email" class="form-label">{{ $t("emailCustomBody") }}</label>
            <TemplatedTextarea id="body-email" v-model="$parent.notification.customBody" :required="false" placeholder=""></TemplatedTextarea>
            <div class="form-text">{{ $t("leave blank for default body") }}</div>
        </div>

        <div class="mb-3">
            <div class="form-check">
                <input id="use-html-body" v-model="$parent.notification.htmlBody" class="form-check-input" type="checkbox" value="">
                <label class="form-check-label" for="use-html-body">
                    {{ $t("Use HTML for custom E-mail body") }}
                </label>
            </div>
        </div>

        <ToggleSection :heading="$t('smtpDkimSettings')">
            <i18n-t tag="div" keypath="smtpDkimDesc" class="form-text mb-3">
                <a href="https://nodemailer.com/dkim/" target="_blank">{{ $t("documentation") }}</a>
            </i18n-t>

            <div class="mb-3">
                <label for="dkim-domain" class="form-label">{{ $t("smtpDkimDomain") }}</label>
                <input id="dkim-domain" v-model="$parent.notification.smtpDkimDomain" type="text" class="form-control" autocomplete="false" placeholder="example.com">
            </div>
            <div class="mb-3">
                <label for="dkim-key-selector" class="form-label">{{ $t("smtpDkimKeySelector") }}</label>
                <input id="dkim-key-selector" v-model="$parent.notification.smtpDkimKeySelector" type="text" class="form-control" autocomplete="false" placeholder="2017">
            </div>
            <div class="mb-3">
                <label for="dkim-private-key" class="form-label">{{ $t("smtpDkimPrivateKey") }}</label>
                <textarea id="dkim-private-key" v-model="$parent.notification.smtpDkimPrivateKey" rows="5" type="text" class="form-control" autocomplete="false" placeholder="-----BEGIN PRIVATE KEY-----"></textarea>
            </div>
            <div class="mb-3">
                <label for="dkim-hash-algo" class="form-label">{{ $t("smtpDkimHashAlgo") }}</label>
                <input id="dkim-hash-algo" v-model="$parent.notification.smtpDkimHashAlgo" type="text" class="form-control" autocomplete="false" placeholder="sha256">
            </div>
            <div class="mb-3">
                <label for="dkim-header-fields" class="form-label">{{ $t("smtpDkimheaderFieldNames") }}</label>
                <input id="dkim-header-fields" v-model="$parent.notification.smtpDkimheaderFieldNames" type="text" class="form-control" autocomplete="false" placeholder="message-id:date:from:to">
            </div>
            <div class="mb-3">
                <label for="dkim-skip-fields" class="form-label">{{ $t("smtpDkimskipFields") }}</label>
                <input id="dkim-skip-fields" v-model="$parent.notification.smtpDkimskipFields" type="text" class="form-control" autocomplete="false" placeholder="message-id:date">
            </div>
        </ToggleSection>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedInput from "../TemplatedInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";
import ToggleSection from "../ToggleSection.vue";

export default {
    components: {
        HiddenInput,
        TemplatedInput,
        TemplatedTextarea,
        ToggleSection,
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
