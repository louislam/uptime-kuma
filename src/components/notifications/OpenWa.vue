<template>
    <div class="mb-3">
        <label for="openwa-api-url" class="form-label">{{ $t("API URL") }}</label>
        <input
            id="openwa-api-url"
            v-model="$parent.notification.openwaApiUrl"
            placeholder="http://localhost:2785/"
            type="url"
            class="form-control"
            required
        />
        <div class="form-text">{{ $t("wayToGetOpenwaApiUrl") }}</div>
    </div>

    <div class="mb-3">
        <label for="openwa-api-key" class="form-label">{{ $t("API Key") }}</label>
        <HiddenInput
            id="openwa-api-key"
            v-model="$parent.notification.openwaApiKey"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <div class="form-text">{{ $t("wayToGetOpenwaApiKey") }}</div>
    </div>

    <div class="mb-3">
        <label for="openwa-session" class="form-label">{{ $t("openwaSession") }}</label>
        <input
            id="openwa-session"
            v-model="$parent.notification.openwaSession"
            type="text"
            placeholder="default"
            class="form-control"
            required
        />
        <div class="form-text">{{ $t("wayToGetOpenwaSession") }}</div>
    </div>

    <div class="mb-3">
        <label for="openwa-chat-id" class="form-label">{{ $t("openwaChatId") }}</label>
        <input
            id="openwa-chat-id"
            v-model="$parent.notification.openwaChatId"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">
            {{ $t("wayToWriteOpenwaChatId", [ "00117612345678@c.us", "123456789012345678@g.us", "1234567890@lid"]) }}
        </div>
    </div>

    <i18n-t tag="div" keypath="More info on:" class="mb-3 form-text">
        <a href="https://www.open-wa.org/" target="_blank">https://www.open-wa.org/</a>
    </i18n-t>
</template>
<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
