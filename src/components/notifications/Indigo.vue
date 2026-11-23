<template>
    <div class="mb-3">
        <label for="indigo-url" class="form-label">
            {{ $t("Indigo URL") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="indigo-url"
            v-model="$parent.notification.indigoUrl"
            type="url"
            class="form-control"
            placeholder="https://your-reflector.indigodomo.net"
            required
        />
        <div class="form-text">{{ $t("indigoUrlHelptext") }}</div>
    </div>

    <div class="mb-3">
        <div class="form-check">
            <input
                id="indigo-ignore-tls-error"
                v-model="$parent.notification.indigoIgnoreTlsError"
                class="form-check-input"
                type="checkbox"
            />
            <label class="form-check-label" for="indigo-ignore-tls-error">
                {{ $t("Ignore TLS Error") }}
            </label>
        </div>
        <div class="form-text">{{ $t("indigoIgnoreTlsErrorHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="indigo-api-key" class="form-label">
            {{ $t("API Key") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <HiddenInput
            id="indigo-api-key"
            v-model="$parent.notification.indigoApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <div class="form-text">{{ $t("indigoApiKeyHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="indigo-variable-id" class="form-label">{{ $t("Variable ID") }}</label>
        <input
            id="indigo-variable-id"
            v-model="$parent.notification.indigoVariableId"
            type="number"
            class="form-control"
            min="1"
        />
        <div class="form-text">{{ $t("indigoVariableIdHelptext") }}</div>
    </div>

    <div class="mb-3">
        <label for="indigo-action-group-id" class="form-label">{{ $t("Action Group ID") }}</label>
        <input
            id="indigo-action-group-id"
            v-model="$parent.notification.indigoActionGroupId"
            type="number"
            class="form-control"
            min="1"
        />
        <div class="form-text">{{ $t("indigoActionGroupIdHelptext") }}</div>
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
