<template>
    <div class="mb-3">
        <label for="webhook-url" class="form-label">{{ $t("Post URL") }}</label>
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
            $t("Request Body")
        }}</label>
        <select
            id="webhook-request-body"
            v-model="$parent.notification.webhookContentType"
            class="form-select"
            required
        >
            <option value="json">{{ $t("webhookBodyPresetOption", ["application/json"]) }}</option>
            <option value="form-data">{{ $t("webhookBodyPresetOption", ["multipart/form-data"]) }}</option>
            <option value="custom">{{ $t("webhookBodyCustomOption") }}</option>
        </select>

        <div class="form-text">
            <div v-if="$parent.notification.webhookContentType == 'json'">
                <p>{{ $t("webhookJsonDesc", ['"application/json"']) }}</p>
            </div>
            <div v-if="$parent.notification.webhookContentType == 'form-data'">
                <i18n-t tag="p" keypath="webhookFormDataDesc">
                    <template #multipart>multipart/form-data"</template>
                    <template #decodeFunction>
                        <strong>json_decode($_POST['data'])</strong>
                    </template>
                </i18n-t>
            </div>
            <div v-if="$parent.notification.webhookContentType == 'custom'">
                <i18n-t tag="p" keypath="webhookCustomBodyDesc">
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

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="showAdditionalHeadersField" class="form-check-input" type="checkbox">
            <label class="form-check-label">{{ $t("webhookAdditionalHeadersTitle") }}</label>
        </div>
        <div class="form-text">
            <i18n-t tag="p" keypath="webhookAdditionalHeadersDesc"> </i18n-t>
        </div>
        <textarea
            v-if="showAdditionalHeadersField"
            id="additionalHeaders"
            v-model="$parent.notification.webhookAdditionalHeaders"
            class="form-control"
            :placeholder="headersPlaceholder"
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
