<template>
    <div class="mb-3">
        <label for="webhook-url" class="form-label">{{ $t("SIGNL4 Webhook URL") }}</label>
        <input
            id="webhook-url"
            v-model="$parent.notification.webhookURL"
            type="url"
            pattern="https?://.+"
            class="form-control"
            required
        />
    </div>

    <div class="mb-3">
        <label for="webhook-request-body" class="form-label">{{
            $t("Alert Body")
        }}</label>
        <select
            id="webhook-request-body"
            v-model="$parent.notification.webhookContentType"
            class="form-select"
            required
        >
            <option value="default">{{ $t("signl4WebhookDefault", ["application/json"]) }}</option>
            <option value="custom">{{ $t("signl4WebhookCustom") }}</option>
        </select>

        <div class="form-text">
            <div v-if="$parent.notification.webhookContentType == 'default'">
                <p>{{ $t("signl4WebhookDefaultDesc", ['"application/json"']) }}</p>
            </div>
            <div v-if="$parent.notification.webhookContentType == 'custom'">
                <i18n-t tag="p" keypath="signl4WebhookCustomDesc">
                    <template #msg>
                        <code>msg</code>
                    </template>
                    <template #heartbeat>
                        <code>heartbeatJSON</code>
                    </template>
                    <template #monitor>
                        <code>monitorJSON</code>
                    </template>
                </i18n-t>
            </div>
        </div>

        <textarea
            v-if="$parent.notification.webhookContentType == 'custom'"
            id="customBody"
            v-model="$parent.notification.webhookCustomBody"
            class="form-control"
            :placeholder="customBodyPlaceholder"
        ></textarea>
    </div>
</template>

<script>
export default {
    data() {
        return {
            showAdditionalHeadersField: this.$parent.notification.webhookAdditionalHeaders != null,
        };
    },
    computed: {
        headersPlaceholder() {
            return this.$t("Example:", [
                `
{
    "Authorization": "Authorization Token"
}`,
            ]);
        },
        customBodyPlaceholder() {
            return `Example:
{
    "Title": "Uptime Kuma Alert - {{ monitorJSON['name'] }}",
    "Body": "{{ msg }}"
}`;
        }
    },
};
</script>

<style lang="scss" scoped>
textarea {
    min-height: 200px;
}
</style>
