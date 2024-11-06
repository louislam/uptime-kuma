<template>
    <div class="mb-3">
        <label for="sendgrid-api-key" class="form-label">{{ $t("SendGrid API Key") }}</label>
        <HiddenInput id="push-api-key" v-model="$parent.notification.sendgridApiKey" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="sendgrid-from-email" class="form-label">{{ $t("From Email") }}</label>
        <input 
            id="sendgrid-from-email" 
            v-model="$parent.notification.sendgridFromEmail" 
            type="text" 
            class="form-control" 
            :class="{ 'is-invalid': errors.from }"
            @input="validateEmail($event, 'from')"
            required
        >
        <div class="invalid-feedback" v-if="errors.from">
            {{ $t("Please use format: Friendly Name <email@domain.com> or just email@domain.com") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="sendgrid-to-email" class="form-label">{{ $t("To Email") }}</label>
        <input 
            id="sendgrid-to-email" 
            v-model="$parent.notification.sendgridToEmail" 
            type="text" 
            class="form-control"
            :class="{ 'is-invalid': errors.to }"
            @input="validateEmail($event, 'to')"
            required
        >
        <div class="invalid-feedback" v-if="errors.to">
            {{ $t("Please use format: Friendly Name <email@domain.com> or just email@domain.com") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="sendgrid-cc-email" class="form-label">{{ $t("smtpCC") }}</label>
        <input 
            id="sendgrid-cc-email" 
            v-model="$parent.notification.sendgridCcEmail" 
            type="text" 
            class="form-control"
            :class="{ 'is-invalid': errors.cc }"
            @input="validateEmail($event, 'cc')"
            
        >
        <div class="form-text">{{ $t("Separate multiple email addresses with commas") }}</div>
        <div class="invalid-feedback" v-if="errors.cc">
            {{ $t("Please use format: Friendly Name <email@domain.com> or just email@domain.com for each address") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="sendgrid-bcc-email" class="form-label">{{ $t("smtpBCC") }}</label>
        <input 
            id="sendgrid-bcc-email" 
            v-model="$parent.notification.sendgridBccEmail" 
            type="text" 
            class="form-control"
            :class="{ 'is-invalid': errors.bcc }"
            @input="validateEmail($event, 'bcc')"
            
        >
        <div class="form-text">{{ $t("Separate multiple email addresses with commas") }}</div>
        <div class="invalid-feedback" v-if="errors.bcc">
            {{ $t("Please use format: Friendly Name <email@domain.com> or just email@domain.com for each address") }}
        </div>
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
    
    data() {
        return {
            errors: {
                from: false,
                to: false,
                cc: false,
                bcc: false
            }
        }
    },

    methods: {
        isValidEmailFormat(value) {
            const friendlyEmailRegex = /^[^<>]+ <[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}>$/;
            const emailOnlyRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
            return friendlyEmailRegex.test(value) || emailOnlyRegex.test(value);
        },

        validateEmail(event, field) {
            const value = event.target.value;
            
            if (!value) {
                this.errors[field] = false;
                return;
            }

            if (field === 'cc' || field === 'bcc') {
                if (value.includes(',')) {
                    this.errors[field] = !value.split(',')
                        .map(email => email.trim())
                        .every(email => this.isValidEmailFormat(email));
                    return;
                }
            }
            
            this.errors[field] = !this.isValidEmailFormat(value);
        }
    },

    mounted() {
        if (typeof this.$parent.notification.sendgridSubject === "undefined") {
            this.$parent.notification.sendgridSubject = "Notification from Your Uptime Kuma";
        }
    },
};
</script>

<style scoped>
.is-invalid {
    border-color: #dc3545;
    padding-right: calc(1.5em + 0.75rem);
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' width='12' height='12' fill='none' stroke='%23dc3545'%3e%3ccircle cx='6' cy='6' r='4.5'/%3e%3cpath stroke-linejoin='round' d='M5.8 3.6h.4L6 6.5z'/%3e%3ccircle cx='6' cy='8.2' r='.6' fill='%23dc3545' stroke='none'/%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right calc(0.375em + 0.1875rem) center;
    background-size: calc(0.75em + 0.375rem) calc(0.75em + 0.375rem);
}
</style>