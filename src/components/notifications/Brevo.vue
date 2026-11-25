<template>
    <div class="mb-3">
        <label for="brevo-api-key" class="form-label">{{ $t("brevoApiKey") }}</label>
        <HiddenInput
            id="brevo-api-key"
            v-model="$parent.notification.brevoApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <i18n-t tag="div" keypath="brevoApiHelp" class="form-text">
            <a href="https://app.brevo.com/settings/keys/api" target="_blank">
                https://app.brevo.com/settings/keys/api
            </a>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="brevo-from-email" class="form-label">{{ $t("brevoFromEmail") }}</label>
        <input
            id="brevo-from-email"
            v-model="$parent.notification.brevoFromEmail"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="brevo-from-name" class="form-label">{{ $t("brevoFromName") }}</label>
        <input id="brevo-from-name" v-model="$parent.notification.brevoFromName" type="text" class="form-control" />
        <div class="form-text">{{ $t("brevoLeaveBlankForDefaultName") }}</div>
    </div>
    <div class="mb-3">
        <label for="brevo-to-email" class="form-label">{{ $t("brevoToEmail") }}</label>
        <input
            id="brevo-to-email"
            v-model="$parent.notification.brevoToEmail"
            type="text"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <label for="brevo-cc-email" class="form-label">{{ $t("brevoCcEmail") }}</label>
        <input id="brevo-cc-email" v-model="$parent.notification.brevoCcEmail" type="text" class="form-control" />
        <div class="form-text">{{ $t("brevoSeparateMultipleEmails") }}</div>
    </div>
    <div class="mb-3">
        <label for="brevo-bcc-email" class="form-label">{{ $t("brevoBccEmail") }}</label>
        <input id="brevo-bcc-email" v-model="$parent.notification.brevoBccEmail" type="text" class="form-control" />
        <small class="form-text text-muted">{{ $t("brevoSeparateMultipleEmails") }}</small>
    </div>
    <div class="mb-3">
        <label for="brevo-subject" class="form-label">{{ $t("emailCustomSubject") }}</label>
        <TemplatedInput
            id="brevo-subject"
            v-model="$parent.notification.customSubject"
            :required="false"
            placeholder=""
        ></TemplatedInput>
        <div class="form-text">{{ $t("leave blank for default subject") }}</div>
    </div>
    <div class="mb-3">
        <label for="brevo-body" class="form-label">{{ $t("emailCustomBody") }}</label>
        <TemplatedTextarea
            id="brevo-body"
            v-model="$parent.notification.customBody"
            :required="false"
            placeholder=""
        ></TemplatedTextarea>
        <div class="form-text">{{ $t("leave blank for default body") }}</div>
    </div>
    <div class="mb-3">
        <div class="form-check">
            <input
                id="brevo-use-html-body"
                v-model="$parent.notification.htmlBody"
                class="form-check-input"
                type="checkbox"
                value=""
            />
            <label class="form-check-label" for="brevo-use-html-body">
                {{ $t("Use HTML for custom E-mail body") }}
            </label>
        </div>
    </div>
    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
        <a href="https://developers.brevo.com/reference/sendtransacemail" target="_blank">
            https://developers.brevo.com/reference/sendtransacemail
        </a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedInput from "../TemplatedInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";

const LEGACY_DEFAULT_SUBJECT = "Notification from Your Uptime Kuma";

export default {
    components: {
        HiddenInput,
        TemplatedInput,
        TemplatedTextarea,
    },
    mounted() {
        const legacySubject = this.$parent.notification.brevoSubject?.trim();
        if (typeof legacySubject !== "undefined") {
            if (!this.$parent.notification.customSubject && legacySubject !== LEGACY_DEFAULT_SUBJECT) {
                this.$parent.notification.customSubject = legacySubject;
            }
            delete this.$parent.notification.brevoSubject;
        }
        if (typeof this.$parent.notification.brevoFromName === "undefined") {
            this.$parent.notification.brevoFromName = "Uptime Kuma";
        }
    },
};
</script>
