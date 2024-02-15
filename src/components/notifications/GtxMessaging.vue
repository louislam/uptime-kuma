<template>
    <div class="mb-3">
        <label for="gtxmessaging-api-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput id="gtxmessaging-api-key" v-model="$parent.notification.gtxMessagingApiKey" :required="true"></HiddenInput>
        <div class="form-text">
            {{ $t("gtxMessagingApiKeyHint") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="gtxmessaging-from" class="form-label">{{ $t("From Phone Number / Transmission Path Originating Address (TPOA)") }}</label>
        <input id="gtxmessaging-from" v-model="$parent.notification.gtxMessagingFrom" type="text" class="form-control" required>
        <i18n-t tag="div" keypath="gtxMessagingFromHint" class="form-text">
            <template #e164>
                <a href="https://wikipedia.org/wiki/E.164">E.164</a>
            </template>
            <template #e212>
                <a href="https://wikipedia.org/wiki/E.212">E.212</a>
            </template>
            <template #e214>
                <a href="https://wikipedia.org/wiki/E.214">E.214</a>
            </template>
        </i18n-t>
    </div>
    <div class="mb-3">
        <label for="gtxmessaging-to" class="form-label">{{ $t("To Phone Number") }}</label>
        <input id="gtxmessaging-to" v-model="$parent.notification.gtxMessagingTo" type="text" pattern="^\+\d+$" class="form-control" required>
        <i18n-t tag="div" keypath="gtxMessagingToHint" class="form-text">
            <template #e164>
                <a href="https://wikipedia.org/wiki/E.164">E.164</a>
            </template>
            <template #e212>
                <a href="https://wikipedia.org/wiki/E.212">E.212</a>
            </template>
            <template #e214>
                <a href="https://wikipedia.org/wiki/E.214">E.214</a>
            </template>
        </i18n-t>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput
    }
};
</script>
