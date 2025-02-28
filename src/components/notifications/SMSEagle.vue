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
        <label for="smseagle-recipient-type" class="form-label">{{ $t("smseagleRecipient") }}</label>
   </div>
    <div class="mb-3">
        <label for="smseagle-recipient" class="form-label">{{ $t("smseagleTo") }}</label>
        <input id="smseagle-recipient" v-model="$parent.notification.smseagleRecipientTo" type="text" class="form-control">
    </div>
    <div class="mb-3">
        <label for="smseagle-recipient" class="form-label">{{ $t("smseagleGroup") }}</label>
        <input id="smseagle-recipient" v-model="$parent.notification.smseagleRecipientGroup" type="text" class="form-control">
    </div>
    <div class="mb-3">
        <label for="smseagle-recipient" class="form-label">{{ $t("smseagleContact") }}</label>
        <input id="smseagle-recipient" v-model="$parent.notification.smseagleRecipientContact" type="text" class="form-control">
    </div>
    <div class="mb-3">
        <label for="smseagle-priority" class="form-label">{{ $t("smseaglePriority") }}</label>
        <input id="smseagle-priority" v-model="$parent.notification.smseaglePriority" type="number" class="form-control" min="0" max="9" step="1" placeholder="0">
    </div>
    <div class="mb-3 form-check form-switch">
        <label for="smseagle-encoding" class="form-label">{{ $t("smseagleEncoding") }}</label>
        <input id="smseagle-encoding" v-model="$parent.notification.smseagleEncoding" type="checkbox" class="form-check-input">
    </div>
    <div class="mb-3">
        <label for="smseagle-msg-type" class="form-label">{{ $t("smseagleMsgType") }} </label>
        <select id="smseagle-msg-type" v-model="$parent.notification.smseagleMsgType" class="form-select">
            <option value="smseagle-sms" selected>{{ $t("smseagleMsgSms") }} </option>
            <option value="smseagle-ring">{{ $t("smseagleMsgRing") }} </option>
            <option value="smseagle-tts">{{ $t("smseagleMsgTts") }} </option>
            <option value="smseagle-tts-advanced">{{ $t("smseagleMsgTtsAdvanced") }} </option>
        </select>
    </div>
    <div v-if="$parent.notification.smseagleMsgType !== 'smseagle-sms' && $parent.notification.smseagleMsgType" class="mb-3">
        <label for="smseagle-duration" class="form-label">{{ $t("smseagleDuration") }}</label>
        <input id="smseagle-duration" v-model="$parent.notification.smseagleDuration" type="number" class="form-control" min="0" max="30" step="1" placeholder="10">
    </div>
    <div v-if="$parent.notification.smseagleMsgType === 'smseagle-tts-advanced'" class="mb-3">
        <label for="smseagle-tts-model" class="form-label">{{ $t("smseagleTtsModel") }} </label>
        <input  id="smseagle-tts-model" v-model="$parent.notification.smseagleTtsModel" type="number" class="form-control" required>
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
