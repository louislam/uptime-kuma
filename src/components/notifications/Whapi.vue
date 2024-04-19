<template>
    <div class="mb-3">
        <label for="whapi-api-url" class="form-label">{{ $t("API URL") }}</label>
        <input id="whapi-api-url" v-model="$parent.notification.whapiApiUrl" placeholder="https://gate.whapi.cloud/" type="text" class="form-control">
    </div>

    <div class="mb-3">
        <label for="whapi-auth-token" class="form-label">{{ $t("Token") }}</label>
        <HiddenInput id="whapi-auth-token" v-model="$parent.notification.whapiAuthToken" :required="true" autocomplete="new-password"></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetWhapiUrlAndToken" class="form-text">
            <a href="https://panel.whapi.cloud/dashboard" target="_blank">https://panel.whapi.cloud/dashboard</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="whapi-recipient" class="form-label">{{ $t("whapiRecipient") }}</label>
        <input id="whapi-recipient" v-model="$parent.notification.whapiRecipient" type="text" pattern="^[\d-]{10,31}(@[\w\.]{1,})?$" class="form-control" required>
        <div class="form-text">{{ $t("wayToWriteWhapiRecipient", ["00117612345678", "00117612345678@s.whatsapp.net", "123456789012345678@g.us"]) }}</div>
    </div>

    <i18n-t tag="div" keypath="More info on:" class="mb-3 form-text">
        <a href="https://whapi.cloud/" target="_blank">https://whapi.cloud/</a>
    </i18n-t>
</template>
<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    }
};
</script>
