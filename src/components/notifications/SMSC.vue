<template>
    <div class="mb-3">
        <label for="smsc-login" class="form-label">{{ $t("API Username") }}</label>
        <i18n-t tag="div" class="form-text" keypath="wayToGetClickSendSMSToken">
            <a href="https://smsc.kz/" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
        <input id="smsc-login" v-model="$parent.notification.smscLogin" type="text" class="form-control" required>
        <label for="smsc-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput id="smsc-key" v-model="$parent.notification.smscPassword" :required="true" autocomplete="new-password"></HiddenInput>
    </div>
    <div class="mb-3">
        <div class="form-text">
            {{ $t("checkPrice", ['СМСЦ']) }}
            <a href="https://smsc.kz/tariffs/" target="_blank">https://smsc.kz/tariffs/</a>
        </div>
    </div>
    <div class="mb-3">
        <label for="smsc-to-number" class="form-label">{{ $t("Recipient Number") }}</label>
        <input id="smsc-to-number" v-model="$parent.notification.smscToNumber" type="text" minlength="11" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="smsc-sender-name" class="form-label">{{ $t("From Name/Number") }}</label>
        <input id="smsc-sender-name" v-model="$parent.notification.smscSenderName" type="text" minlength="1" maxlength="15" class="form-control">
        <div class="form-text">{{ $t("Leave blank to use a shared sender number.") }}</div>
    </div>
    <div class="mb-3">
        <label for="smsc-platform" class="form-label">{{ $t("smscTranslit") }}</label><span style="color: red;"><sup>*</sup></span>
        <select id="smsc-platform" v-model="$parent.notification.smscTranslit" class="form-select">
            <option value="0">{{ $t("Default") }}</option>
            <option value="1">Translit</option>
            <option value="2">MpaHc/Ium</option>
        </select>
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
