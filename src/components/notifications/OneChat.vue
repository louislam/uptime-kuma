<template>
    <div class="mb-3">
        <!-- Access Token Input -->
        <div class="mb-3">
            <label for="onechat-access-token" class="form-label">
                OneChat Access Token<span style="color: red;"><sup>*</sup></span>
            </label>
            <HiddenInput
                id="onechat-access-token"
                v-model="$parent.notification.accessToken"
                :required="true"
            >
            </HiddenInput>
            <div class="form-text">
                <p>{{ $t("OneChatAccessToken") }}</p>
            </div>
        </div>

        <!-- Receiver ID Input -->
        <div class="mb-3">
            <label for="onechat-receiver-id" class="form-label">
                {{ $t("OneChatUserIdOrGroupId") }}<span style="color: red;"><sup>*</sup></span>
            </label>
            <input
                id="onechat-receiver-id"
                v-model="$parent.notification.recieverId"
                type="text"
                class="form-control"
                required
            />
        </div>

        <!-- Bot ID Input -->
        <div class="mb-3">
            <label for="onechat-bot-id" class="form-label">
                {{ $t("OneChatBotId") }}<span style="color: red;"><sup>*</sup></span>
            </label>
            <input
                id="onechat-bot-id"
                v-model="$parent.notification.botId"
                type="text"
                class="form-control"
                required
            />
        </div>

        <!-- Document Link -->
        <div class="form-text">
            <i18n-t tag="p" keypath="Read more:">
                <a href="https://chat-develop.one.th/docs" target="_blank">https://chat-develop.one.th/docs</a>
            </i18n-t>
        </div>
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
