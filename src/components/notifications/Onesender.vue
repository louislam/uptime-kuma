<template>
    <div class="mb-3">
        <label for="host-onesender" class="form-label">{{ $t("Host Onesender") }}</label>
        <input
            id="host-onesender"
            v-model="$parent.notification.onesenderURL"
            type="url"
            placeholder="https://xxxxxxxxxxx.com/api/v1/messages"
            pattern="https?://.+"
            class="form-control"
            required
        />
    </div>

    <div class="mb-3">
        <label for="receiver-onesender" class="form-label">{{ $t("Token Onesender") }}</label>
        <HiddenInput id="receiver-onesender" v-model="$parent.notification.onesenderToken" :required="true" autocomplete="false"></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetOnesenderUrlandToken" class="form-text">
            <a href="https://onesender.net/" target="_blank">{{ $t("here") }}</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="webhook-request-body" class="form-label">{{ $t("Recipient Type") }}</label>
        <select
            id="webhook-request-body"
            v-model="$parent.notification.onesenderTypeReceiver"
            class="form-select"
            required
        >
            <option value="private">{{ $t("Private Number") }}</option>
            <option value="group">{{ $t("Group ID") }}</option>
        </select>
    </div>
    <div v-if="$parent.notification.onesenderTypeReceiver == 'private'" class="form-text">{{ $t("privateOnesenderDesc", ['"application/json"']) }}</div>
    <div v-else class="form-text">{{ $t("groupOnesenderDesc") }}</div>
    <div class="mb-3">
        <input
            id="type-receiver-onesender"
            v-model="$parent.notification.onesenderReceiver"
            type="text"
            placeholder="628123456789 or 628123456789-34534"
            class="form-control"
            required
        />
    </div>
    <div class="mb-3">
        <input
            id="type-receiver-onesender"
            v-model="computedReceiverResult"
            type="text"
            class="form-control"
            disabled
        />
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    data() {
        return {};
    },
    computed: {
        computedReceiverResult() {
            let receiver = this.$parent.notification.onesenderReceiver;
            return this.$parent.notification.onesenderTypeReceiver === "private" ? receiver + "@s.whatsapp.net" : receiver + "@g.us";
        },
    },
};
</script>

<style lang="scss" scoped>
textarea {
    min-height: 200px;
}
</style>
