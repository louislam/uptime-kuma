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
        <label for="webhook-request-body" class="form-label">{{ $t("Request Body") }}</label>
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

        <div v-if="$parent.notification.webhookContentType == 'json'" class="form-text">{{ $t("webhookJsonDesc", ['"application/json"']) }}</div>
        <i18n-t v-else-if="$parent.notification.webhookContentType == 'form-data'" tag="div" keypath="webhookFormDataDesc" class="form-text">
            <template #multipart>multipart/form-data"</template>
            <template #decodeFunction>
                <strong>json_decode($_POST['data'])</strong>
            </template>
        </i18n-t>
        <template v-else-if="$parent.notification.webhookContentType == 'custom'">
            <TemplatedTextarea id="customBody" v-model="$parent.notification.webhookCustomBody" :required="true" :placeholder="customBodyPlaceholder"></TemplatedTextarea>
        </template>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="showAdditionalHeadersField" class="form-check-input" type="checkbox">
            <label class="form-check-label">{{ $t("webhookAdditionalHeadersTitle") }}</label>
        </div>
        <div class="form-text">{{ $t("webhookAdditionalHeadersDesc") }}</div>
        <textarea
            v-if="showAdditionalHeadersField"
            id="additionalHeaders"
            v-model="$parent.notification.webhookAdditionalHeaders"
            class="form-control"
            :placeholder="headersPlaceholder"
            :required="showAdditionalHeadersField"
        ></textarea>
    </div>
</template>

<script>
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        TemplatedTextarea,
    },
    data() {
        return {
            showAdditionalHeadersField: this.$parent.notification.webhookAdditionalHeaders != null,
        };
    },
    computed: {
        headersPlaceholder() {
            return this.$t("Example:", [
`{
    "Authorization": "Authorization Token"
}`,
            ]);
        },
        customBodyPlaceholder() {
            return this.$t("Example:", [
`{
    "Title": "Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}",
    "Body": "{{ msg }}"
}`
            ]);
        }
    },
};
</script>

<style lang="scss" scoped>
textarea {
    min-height: 200px;
}
</style>
