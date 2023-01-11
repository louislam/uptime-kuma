<template>
    <div class="mb-3">
        <label for="promosms-login" class="form-label">{{ $t("promosmsLogin") }}</label>
        <input id="promosms-login" v-model="$parent.notification.promosmsLogin" type="text" class="form-control" required>
        <label for="promosms-key" class="form-label">{{ $t("promosmsPassword") }}</label>
        <HiddenInput id="promosms-key" v-model="$parent.notification.promosmsPassword" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="promosms-type-sms" class="form-label">{{ $t("SMS Type") }}</label>
        <select id="promosms-type-sms" v-model="$parent.notification.promosmsSMSType" class="form-select">
            <option value="0">{{ $t("promosmsTypeFlash") }}</option>
            <option value="1">{{ $t("promosmsTypeEco") }}</option>
            <option value="3">{{ $t("promosmsTypeFull") }}</option>
            <option value="4">{{ $t("promosmsTypeSpeed") }}</option>
        </select>
        <div class="form-text">
            {{ $t("checkPrice", [$t("promosms")]) }}
            <a href="https://promosms.com/cennik/" target="_blank">https://promosms.com/cennik/</a>
        </div>
    </div>
    <div class="mb-3">
        <label for="promosms-phone-number" class="form-label">{{ $t("promosmsPhoneNumber") }}</label>
        <input id="promosms-phone-number" v-model="$parent.notification.promosmsPhoneNumber" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="promosms-sender-name" class="form-label">{{ $t("promosmsSMSSender") }}</label>
        <input id="promosms-sender-name" v-model="$parent.notification.promosmsSenderName" type="text" minlength="3" maxlength="11" class="form-control">
    </div>
    <div class="form-check form-switch">
        <input id="promosms-allow-long" v-model="$parent.notification.promosmsAllowLongSMS" type="checkbox" class="form-check-input">
        <label for="promosms-allow-long" class="form-label">{{ $t("promosmsAllowLongSMS") }}</label>
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
