<template>
    <div class="mb-3">
        <label for="vkteams-bot-token" class="form-label">{{ $t("Bot Token") }}</label>
        <HiddenInput
            id="vkteams-bot-token"
            v-model="$parent.notification.vkteamsBotToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
        <i18n-t tag="div" keypath="VKTeams Bot Token Description" class="form-text">
            <a href="https://teams.vk.com/botapi/" target="_blank">https://teams.vk.com/botapi/</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="vkteams-bot-chat-id" class="form-label">{{ $t("Chat ID") }}</label>
        <input
            id="vkteams-bot-chat-id"
            v-model="$parent.notification.vkteamsChatId"
            type="text"
            class="form-control"
            placeholder="*****@chat.agent"
            required
        />
        <div class="form-text">
            {{ $t("VKTeams Chat Id Description") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="vkteams-api-url" class="form-label">{{ $t("API URL") }}</label>
        <input
            id="vkteams-api-url"
            v-model="$parent.notification.vkteamsBaseUrl"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">
            {{ $t("VKTeams Base Url Description") }}
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.vkteamsUseTemplate" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("VKTeams Use Template") }}</label>
        </div>
        <div class="form-text">
            {{ $t("VKTeams Use Template Description") }}
        </div>
    </div>

    <template v-if="$parent.notification.vkteamsUseTemplate">
        <div class="mb-3">
            <label class="form-label" for="vkteams-message-format">{{ $t("Message Format") }}</label>
            <select
                id="vkteams-message-format"
                v-model="$parent.notification.vkteamsTemplateFormat"
                class="form-select"
                required
            >
                <option value="plain">{{ $t("Plain Text") }}</option>
                <option value="MarkdownV2">MarkdownV2</option>
                <option value="HTML">HTML</option>
            </select>
            <p class="form-text">
                {{ $t("VKTeams Template Format Description") }}
            </p>

            <label class="form-label" for="vkteams-message-template">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="vkteams-message-template"
                v-model="$parent.notification.vkteamsTemplate"
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
        TemplatedTextarea,
        HiddenInput,
    },
    mounted() {
        this.$parent.notification.vkteamsBaseUrl ||= "https://myteam.mail.ru";
        this.$parent.notification.vkteamsTemplateFormat ||= "plain";
    },
};
</script>
