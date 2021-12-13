<template>
    <div class="mb-3">
        <label for="clicksendsms-login" class="form-label">API Username</label>
        <div class="form-text">
            {{ $t("apiCredentials") }}
            <a href="http://dashboard.clicksend.com/account/subaccounts" target="_blank">{{ $t("here") }}</a>
        </div>
        <input id="clicksendsms-login" v-model="$parent.notification.clicksendsmsLogin" type="text" class="form-control" required>
        <label for="clicksendsms-key" class="form-label">API Key</label>
        <HiddenInput id="clicksendsms-key" v-model="$parent.notification.clicksendsmsPassword" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>
    <div class="mb-3">
        <div class="form-text">
            {{ $t("checkPrice", [$t("clicksendsms")]) }}
            <a href="https://www.clicksend.com/us/pricing" target="_blank">https://clicksend.com/us/pricing</a>
        </div>
    </div>
    <div class="mb-3">
        <label for="clicksendsms-to-number" class="form-label">Recipient Number</label>
        <input id="clicksendsms-to-number" v-model="$parent.notification.clicksendsmsToNumber" type="text" minlength="8" maxlength="14" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="clicksendsms-sender-name" class="form-label">From Name/Number -
            <a href="https://help.clicksend.com/article/4kgj7krx00-what-is-a-sender-id-or-sender-number" target="_blank">More Info</a>
        </label>
        <input id="clicksendsms-sender-name" v-model="$parent.notification.clicksendsmsSenderName" type="text" minlength="3" maxlength="11" class="form-control">
        <div class="form-text">Leave blank to use a shared sender number.</div>
    </div>
</template>
<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
