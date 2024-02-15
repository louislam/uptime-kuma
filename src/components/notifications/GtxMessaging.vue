<template>
    <div class="mb-3">
        <label for="gtxmessaging-api-key" class="form-label">{{ $t("gtxMessagingApiKey") }}</label>
        <HiddenInput id="gtxmessaging-api-key" v-model="$parent.notification.gtxMessagingApiKey" :required="true"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="gtxmessaging-from" class="form-label">{{ $t("gtxMessagingFrom") }}</label>
        <input id="gtxmessaging-from" v-model="$parent.notification.gtxMessagingFrom" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="gtxmessaging-to" class="form-label">{{ $t("gtxMessagingTo") }}</label>
        <input id="gtxmessaging-to" v-model="$parent.notification.gtxMessagingTo" type="text" pattern="^[\d-]{10,31}(@[\w\.]{1,})?$" class="form-control" required>
    </div>
    <div class="mb-3">
        <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
            <a href="https://www.gtx-messaging.com/en/solutions/sms-gateway-api/" target="_blank">https://www.gtx-messaging.com/en/solutions/sms-gateway-api/</a>
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
