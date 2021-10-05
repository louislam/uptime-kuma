<template>
    <div class="mb-3">
        <label for="octopush-version" class="form-label">Octopush API Version</label>
        <select id="octopush-version" v-model="$parent.notification.octopushVersion" class="form-select">
            <option value="2">V2</option>
            <option value="1">V1 (Legacy Octopush-DM)</option>
        </select>
        <div class="form-text">
            Do you use the legacy version of Octopush (2011-2020) or the new version ?
        </div>
    </div>
    <div class="mb-3">
        <label for="octopush-key" class="form-label">API KEY</label>
        <HiddenInput id="octopush-key" v-model="$parent.notification.octopushAPIKey" :required="true" autocomplete="one-time-code"></HiddenInput>
        <label for="octopush-login" class="form-label">API LOGIN</label>
        <input id="octopush-login" v-model="$parent.notification.octopushLogin" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="octopush-type-sms" class="form-label">SMS Type</label>
        <select id="octopush-type-sms" v-model="$parent.notification.octopushSMSType" class="form-select">
            <option value="sms_premium">Premium (Fast - recommended for alerting)</option>
            <option value="sms_low_cost">Low Cost (Slow, sometimes blocked by operator)</option>
        </select>
        <div class="form-text">
            Check octopush prices <a href="https://octopush.com/tarifs-sms-international/" target="_blank">https://octopush.com/tarifs-sms-international/</a>.
        </div>
    </div>
    <div class="mb-3">
        <label for="octopush-phone-number" class="form-label">Phone number (intl format, eg : +33612345678) </label>
        <input id="octopush-phone-number" v-model="$parent.notification.octopushPhoneNumber" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="octopush-sender-name" class="form-label">SMS Sender Name : 3-11 alphanumeric characters and space (a-zA-Z0-9)</label>
        <input id="octopush-sender-name" v-model="$parent.notification.octopushSenderName" type="text" minlength="3" maxlength="11" class="form-control">
    </div>

    <p style="margin-top: 8px;">
        More info on: <a href="https://octopush.com/api-sms-documentation/envoi-de-sms/" target="_blank">https://octopush.com/api-sms-documentation/envoi-de-sms/</a>
    </p>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
}
</script>
