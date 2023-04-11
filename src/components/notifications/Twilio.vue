<template>
    <div class="mb-3">
        <label for="twilio-account-sid" class="form-label">{{ $t("Account SID") }}</label>
        <input id="twilio-account-sid" v-model="$parent.notification.twilioAccountSID" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="twilio-auth-token" class="form-label">{{ $t("Auth Token") }}</label>
        <input id="twilio-auth-token" v-model="$parent.notification.twilioAuthToken" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="twilio-from-number" class="form-label">{{ $t("From Number") }}</label>
        <input id="twilio-from-number" v-model="$parent.notification.twilioFromNumber" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="twilio-to-number" class="form-label">{{ $t("To Number") }}</label>
        <input id="twilio-to-number" v-model="$parent.notification.twilioToNumber" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
            <a href="https://www.twilio.com/docs/sms" target="_blank">https://www.twilio.com/docs/sms</a>
        </i18n-t>
    </div>
</template>
