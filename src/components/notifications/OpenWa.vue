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

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.openwaUseCustomMessage" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("openwaCustomMessageTitle") }}</label>
        </div>
        <div class="form-text">{{ $t("openwaCustomMessageDesc") }}</div>
    </div>

    <template v-if="$parent.notification.openwaUseCustomMessage">
        <div class="mb-3">
            <TemplatedTextarea
                id="openwa-custom-message"
                v-model="$parent.notification.openwaCustomMessage"
                :required="true"
                :placeholder="customMessagePlaceholder"
            ></TemplatedTextarea>
        </div>
    </template>

    <i18n-t tag="div" keypath="More info on:" class="mb-3 form-text">
        <a href="https://www.open-wa.org/" target="_blank">https://www.open-wa.org/</a>
    </i18n-t>
</template>
<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        HiddenInput,
        TemplatedTextarea,
    },
    computed: {
        customMessagePlaceholder() {
            return this.$t("Example:", [`[{{ name }}] [{{ status }}]\n{{ msg }}`]);
        },
    },
};
</script>
