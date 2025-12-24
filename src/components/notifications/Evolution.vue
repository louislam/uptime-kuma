<template>
    <div class="mb-3">
        <label for="evolution-instance-name" class="form-label">{{ $t("evolutionInstanceName") }}</label>
        <input id="evolution-instance-name" v-model="$parent.notification.evolutionInstanceName" type="text" class="form-control" required>
    </div>

    <div class="mb-3">
        <label for="evolution-api-url" class="form-label">{{ $t("API URL") }}</label>
        <input id="evolution-api-url" v-model="$parent.notification.evolutionApiUrl" placeholder="https://evoapicloud.com/" type="text" class="form-control">
    </div>

    <div class="mb-3">
        <label for="evolution-auth-token" class="form-label">{{ $t("Token") }}</label>
        <HiddenInput id="evolution-auth-token" v-model="$parent.notification.evolutionAuthToken" :required="true" autocomplete="new-password"></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetEvolutionUrlAndToken" class="form-text">
            <a href="https://evoapicloud.com" target="_blank">https://evoapicloud.com</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="evolution-recipient" class="form-label">{{ $t("evolutionRecipient") }}</label>
        <input id="evolution-recipient" v-model="$parent.notification.evolutionRecipient" type="text" pattern="^[\d-]{10,31}(@[\w\.]{1,})?$" class="form-control" required>
        <div class="form-text">{{ $t("wayToWriteEvolutionRecipient", ["00117612345678", "00117612345678@s.whatsapp.net", "123456789012345678@g.us"]) }}</div>
    </div>

    <i18n-t tag="div" keypath="More info on:" class="mb-3 form-text">
        <a href="https:/evoapicloud.com/" target="_blank">https://evoapicloud.com/</a>
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
