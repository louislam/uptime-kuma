<template>
    <div class="mb-3">
        <label for="max-bot-token" class="form-label">{{ $t("Bot Token") }}</label>
        <HiddenInput
            id="max-bot-token"
            v-model="$parent.notification.maxBotToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetMaxToken" class="form-text">
            <a href="https://dev.max.ru/docs" target="_blank">https://dev.max.ru/docs</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="max-api-url" class="form-label">{{ $t("API URL") }}</label>
        <input id="max-api-url" v-model="$parent.notification.maxApiUrl" type="text" class="form-control" required />
        <div class="form-text">
            {{ $t("maxApiUrlDescription") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="max-chat-id" class="form-label">{{ $t("Chat ID") }}</label>
        <input id="max-chat-id" v-model="$parent.notification.maxChatID" type="text" class="form-control" required />
        <div class="form-text">
            {{ $t("wayToGetMaxChatID") }}
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.maxUseTemplate" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("maxUseTemplate") }}</label>
        </div>
        <div class="form-text">
            {{ $t("maxUseTemplateDescription") }}
        </div>
    </div>

    <template v-if="$parent.notification.maxUseTemplate">
        <div class="mb-3">
            <label class="form-label" for="max-message-format">{{ $t("Message Format") }}</label>
            <select
                id="max-message-format"
                v-model="$parent.notification.maxTemplateFormat"
                class="form-select"
                required
            >
                <option value="plain">{{ $t("Plain Text") }}</option>
                <option value="markdown">Markdown</option>
                <option value="html">HTML</option>
            </select>
            <p class="form-text">
                {{ $t("maxTemplateFormatDescription") }}
            </p>

            <label class="form-label" for="max-message-template">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="max-message-template"
                v-model="$parent.notification.maxTemplate"
                :required="true"
            ></TemplatedTextarea>
        </div>
    </template>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        HiddenInput,
        TemplatedTextarea,
    },
    mounted() {
        this.$parent.notification.maxApiUrl ||= "https://platform-api.max.ru";
        this.$parent.notification.maxTemplateFormat ||= "plain";
    },
};
</script>
