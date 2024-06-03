<template>
    <div class="mb-3">
        <label for="sevenio-api-key" class="form-label">{{ $t("apiKeySevenIO") }}</label>
        <HiddenInput id="sevenio-api-key" v-model="$parent.notification.sevenioApiKey" :required="true" autocomplete="new-password"></HiddenInput>
        <div class="form-text">
            {{ $t("wayToGetSevenIOApiKey") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="sevenio-sender" class="form-label">{{ $t("senderSevenIO") }}</label>
        <input id="sevenio-sender" v-model="$parent.notification.sevenioSender" type="text" class="form-control" autocomplete="false" placeholder="Uptime Kuma">
    </div>

    <div class="mb-3">
        <label for="sevenio-receiver" class="form-label">{{ $t("receiverSevenIO") }}</label>
        <input id="sevenio-receiver" v-model="$parent.notification.sevenioReceiver" type="number" class="form-control" required autocomplete="false" placeholder="0123456789">
        <div class="form-text">
            {{ $t("receiverInfoSevenIO") }}
        </div>
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
