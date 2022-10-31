<template>
    <div class="mb-3">
        <label for="smseagle-url" class="form-label">{{ $t("smseagleUrl") }}</label>
        <input id="smseagle-url" v-model="$parent.notification.smseagleUrl" type="text" minlength="7" class="form-control" placeholder="http://127.0.0.1" required>
    </div>
    <div class="mb-3">
        <label for="smseagle-token" class="form-label">{{ $t("smseagleToken") }}</label>
        <HiddenInput id="smseagle-token" v-model="$parent.notification.smseagleToken" :required="true"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="smseagle-recipient-type" class="form-label">{{ $t("smseagleRecipientType") }}</label>
        <select id="smseagle-recipient-type" v-model="$parent.notification.smseagleRecipientType" class="form-select">
            <option value="smseagle-to" selected>{{ $t("smseagleTo") }}</option>
            <option value="smseagle-group">{{ $t("smseagleGroup") }}</option>
            <option value="smseagle-contact">{{ $t("smseagleContact") }}</option>
        </select>
    </div>
    <div class="mb-3">
        <label for="smseagle-recipient" class="form-label">{{ $t("smseagleRecipient") }}</label>
        <input id="smseagle-recipient" v-model="$parent.notification.smseagleRecipient" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="smseagle-priority" class="form-label">{{ $t("smseaglePriority") }}</label>
        <input id="smseagle-priority" v-model="$parent.notification.smseaglePriority" type="number" class="form-control" min="0" max="9" step="1" placeholder="0">
    </div>
    <div class="mb-3 form-check form-switch">
        <label for="smseagle-encoding" class="form-label">{{ $t("smseagleEncoding") }}</label>
        <input id="smseagle-encoding" v-model="$parent.notification.smseagleEncoding" type="checkbox" class="form-check-input">
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
