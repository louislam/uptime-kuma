<template>
    <div class="mb-3">
        <label for="smseagle-url" class="form-label">{{ $t("smseagleUrl") }}</label>
        <input
            id="smseagle-url" v-model="$parent.notification.smseagleUrl" type="text" minlength="7"
            class="form-control" placeholder="http://127.0.0.1" required
        >
    </div>
    <div class="mb-3">
        <label for="smseagle-token" class="form-label">{{ $t("smseagleToken") }}</label>
        <HiddenInput id="smseagle-token" v-model="$parent.notification.smseagleToken" :required="true"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="smseagle-api-type" class="form-label">{{ $t("smseagleApiType") }} </label>
        <select id="smseagle-api-type" v-model="$parent.notification.smseagleApiType" class="form-select">
            <option value="smseagle-apiv1" selected>{{ $t("smseagleApiv1") }} </option>
            <option value="smseagle-apiv2">{{ $t("smseagleApiv2") }} </option>
        </select>
        <i18n-t tag="div" keypath="smseagleDocs" class="form-text">
            <a href="https://www.smseagle.eu/api/" target="_blank">https://www.smseagle.eu/api/</a>
        </i18n-t>
    </div>
    <div v-if="$parent.notification.smseagleApiType === 'smseagle-apiv1'" class="mb-3">
        <div class="mb-3">
            <label for="smseagle-recipient-type" class="form-label">{{ $t("smseagleRecipientType") }}</label>
            <select
                id="smseagle-recipient-type" v-model="$parent.notification.smseagleRecipientType"
                class="form-select"
            >
                <!-- phone number -->
                <option value="smseagle-to" selected>{{ $t("smseagleTo") }}</option>
                <option value="smseagle-group">{{ $t("smseagleGroup") }}</option>
                <option value="smseagle-contact">{{ $t("smseagleContact") }}</option>
            </select>
        </div>
        <div class="mb-3">
            <label for="smseagle-recipient" class="form-label">{{ $t("smseagleRecipient") }}</label>
            <input id="smseagle-recipient" v-model="$parent.notification.smseagleRecipient" type="text" class="form-control" required>
        </div>
        <div
            v-if="$parent.notification.smseagleMsgType === 'smseagle-sms'
                || $parent.notification.smseagleRecipientType !== 'smseagle-to'" class="mb-3"
        >
            <label for="smseagle-priority" class="form-label">{{ $t("smseaglePriority") }}</label>
            <input id="smseagle-priority" v-model="$parent.notification.smseaglePriority" type="number" class="form-control" min="0" max="9" step="1" placeholder="0" required>
        </div>
        <div
            v-if="$parent.notification.smseagleMsgType === 'smseagle-sms'
                || $parent.notification.smseagleRecipientType !== 'smseagle-to'" class="mb-3 form-check form-switch"
        >
            <label for="smseagle-encoding" class="form-label">{{ $t("smseagleEncoding") }}</label>
            <input id="smseagle-encoding" v-model="$parent.notification.smseagleEncoding" type="checkbox" class="form-check-input">
        </div>
        <div v-if="$parent.notification.smseagleRecipientType === 'smseagle-to'" class="mb-3">
            <div class="mb-3">
                <label for="smseagle-msg-type" class="form-label">{{ $t("smseagleMsgType") }} </label>
                <select id="smseagle-msg-type" v-model="$parent.notification.smseagleMsgType" class="form-select">
                    <option value="smseagle-sms" selected>{{ $t("smseagleMsgSms") }} </option>
                    <option value="smseagle-ring">{{ $t("smseagleMsgRing") }} </option>
                    <option value="smseagle-tts">{{ $t("smseagleMsgTts") }} </option>
                    <option value="smseagle-tts-advanced">{{ $t("smseagleMsgTtsAdvanced") }} </option>
                </select>
            </div>
            <div
                v-if="$parent.notification.smseagleMsgType === 'smseagle-ring'
                    || $parent.notification.smseagleMsgType === 'smseagle-tts'
                    || $parent.notification.smseagleMsgType === 'smseagle-tts-advanced'" class="mb-3"
            >
                <label for="smseagle-duration" class="form-label">{{ $t("smseagleDuration") }}</label>
                <input id="smseagle-duration" v-model="$parent.notification.smseagleDuration" type="number" class="form-control" min="0" max="30" step="1" placeholder="10">
            </div>
            <div v-if="$parent.notification.smseagleMsgType === 'smseagle-tts-advanced'" class="mb-3">
                <label for="smseagle-tts-model" class="form-label">{{ $t("smseagleTtsModel") }} </label>
                <input id="smseagle-tts-model" v-model="$parent.notification.smseagleTtsModel" type="number" class="form-control" placeholder="1" required>
            </div>
        </div>
    </div>

    <div v-if="$parent.notification.smseagleApiType === 'smseagle-apiv2'" class="mb-3">
        <div class="mb-3">
            <!-- phone number -->
            <label for="smseagle-recipient-to" class="form-label">{{ $t("smseagleTo") }}</label>
            <input id="smseagle-recipient-to" v-model="$parent.notification.smseagleRecipientTo" type="text" class="form-control">
            <i18n-t tag="div" keypath="smseagleComma" class="form-text" />
        </div>
        <div class="mb-3">
            <label for="smseagle-recipient-group" class="form-label">{{ $t("smseagleGroupV2") }}</label>
            <input id="smseagle-recipient-group" v-model="$parent.notification.smseagleRecipientGroup" type="text" class="form-control">
            <i18n-t tag="div" keypath="smseagleComma" class="form-text" />
        </div>
        <div class="mb-3">
            <label for="smseagle-recipient-contact" class="form-label">{{ $t("smseagleContactV2") }}</label>
            <input id="smseagle-recipient-contact" v-model="$parent.notification.smseagleRecipientContact" type="text" class="form-control">
            <i18n-t tag="div" keypath="smseagleComma" class="form-text" />
        </div>
        <div class="mb-3">
            <label for="smseagle-priority-v2" class="form-label">{{ $t("smseaglePriority") }}</label>
            <input id="smseagle-priority-v2" v-model="$parent.notification.smseaglePriority" type="number" class="form-control" min="0" max="9" step="1" placeholder="0">
        </div>
        <div class="mb-3 form-check form-switch">
            <label for="smseagle-encoding-v2" class="form-label">{{ $t("smseagleEncoding") }}</label>
            <input id="smseagle-encoding-v2" v-model="$parent.notification.smseagleEncoding" type="checkbox" class="form-check-input">
        </div>
        <div class="mb-3">
            <label for="smseagle-msg-type-v2" class="form-label">{{ $t("smseagleMsgType") }} </label>
            <select id="smseagle-msg-type-v2" v-model="$parent.notification.smseagleMsgType" class="form-select">
                <option value="smseagle-sms" selected>{{ $t("smseagleMsgSms") }} </option>
                <option value="smseagle-ring">{{ $t("smseagleMsgRing") }} </option>
                <option value="smseagle-tts">{{ $t("smseagleMsgTts") }} </option>
                <option value="smseagle-tts-advanced">{{ $t("smseagleMsgTtsAdvanced") }} </option>
            </select>
        </div>
        <div v-if="$parent.notification.smseagleMsgType && $parent.notification.smseagleMsgType !== 'smseagle-sms'" class="mb-3">
            <label for="smseagle-duration-v2" class="form-label">{{ $t("smseagleDuration") }}</label>
            <input id="smseagle-duration-v2" v-model="$parent.notification.smseagleDuration" type="number" class="form-control" min="0" max="30" step="1" placeholder="10">
        </div>
        <div v-if="$parent.notification.smseagleMsgType === 'smseagle-tts-advanced'" class="mb-3">
            <label for="smseagle-tts-model-v2" class="form-label">{{ $t("smseagleTtsModel") }} </label>
            <input id="smseagle-tts-model-v2" v-model="$parent.notification.smseagleTtsModel" type="number" class="form-control" placeholder="1" required>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (!this.$parent.notification.smseagleApiType) {
            this.$parent.notification.smseagleApiType = "smseagle-apiv1";
        }
        if (!this.$parent.notification.smseagleMsgType) {
            this.$parent.notification.smseagleMsgType = "smseagle-sms";
        }
        if (!this.$parent.notification.smseagleRecipientType) {
            this.$parent.notification.smseagleRecipientType = "smseagle-to";
        }
    }
};
</script>
