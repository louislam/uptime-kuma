<template>
    <div class="mb-3">
        <!-- Access Token Input -->
        <div class="mb-3">
            <label for="onechat-access-token" class="form-label">
                Access Token<span style="color: red;"><sup>*</sup></span>
            </label>
            <input
                id="onechat-access-token"
                v-model="$parent.notification.accessToken"
                type="text"
                class="form-control"
                required
            />
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
    </div>
</template>