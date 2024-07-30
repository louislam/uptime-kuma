<template>
    <div class="mb-3">
        <label for="host-onesender" class="form-label">{{ $t("HostOnesender") }}</label>
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
        <label for="receiver-onesender" class="form-label">{{ $t("TokenOnesender") }}</label>
        <input
            id="receiver-onesender"
            v-model="$parent.notification.onesenderToken"
            type="text"
            class="form-control"
            required
        />
    </div>

    <div class="mb-3">
        <label for="webhook-request-body" class="form-label">{{ $t("TypeOnesender") }}</label>
        <select
            id="webhook-request-body"
            v-model="$parent.notification.onesenderTypeReceiver"
            class="form-select"
            required
        >
            <option value="private">{{ $t("PrivateOnesender") }}</option>
            <option value="group">{{ $t("GroupOnesender") }}</option>
        </select>
    </div>

    <div class="mb-3">
        <label for="type-receiver-onesender" class="form-label">{{ $t("ReceiverOnesender") }}</label>
        <input
            id="type-receiver-onesender"
            v-model="$parent.notification.onesenderReceiver"
            type="text"
            placeholder="628123456789 or 628123456789-34534"
            class="form-control"
            required
        />
    </div>
</template>

<script>
export default {
    data() {
        return {};
    },
};
</script>

<style lang="scss" scoped>
textarea {
    min-height: 200px;
}
</style>
