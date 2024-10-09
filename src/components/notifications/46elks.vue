<template>
    <div class="mb-3">
        <label for="Elks-account-sid" class="form-label">{{ $t("Account SID") }}</label>
        <input id="Elks-account-sid" v-model="$parent.notification.elksAccountSID" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="Elks-apikey-token" class="form-label">{{ $t("Api Key (optional)") }}</label>
        <input id="Elks-apikey-token" v-model="$parent.notification.twilioApiKey" type="text" class="form-control">
        <div class="form-text">
            <p>
                The API key is optional but recommended. You can provide either Account SID and AuthToken
                from the may TwilioConsole page or Account SID and the pair of Api Key and Api Key secret
            </p>
        </div>
    </div>


    <div class="mb-3">
        <label for="Elks-auth-token" class="form-label">{{ $t("Auth Token / Api Key Secret") }}</label>
        <input id="Elks-auth-token" v-model="$parent.notification.elksAuthToken" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="Elks-from-number" class="form-label">{{ $t("From Number") }}</label>
        <input id="Elks-from-number" v-model="$parent.notification.elksFromNumber" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="Elks-to-number" class="form-label">{{ $t("To Number") }}</label>
        <input id="Elks-to-number" v-model="$parent.notification.elksToNumber" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
            <a href="https://www.twilio.com/docs/sms" target="_blank">https://www.twilio.com/docs/sms</a>
        </i18n-t>
    </div>
</template>
