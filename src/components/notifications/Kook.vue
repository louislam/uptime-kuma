<template>
    <div class="mb-3">
        <label for="kook-bot-token" class="form-label">{{ $t("Bot Token") }}</label>
        <HiddenInput id="kook-bot-token" v-model="$parent.notification.kookBotToken" :required="true" autocomplete="new-password"></HiddenInput>
        <i18n-t tag="div" keypath="wayToGetKookBotToken" class="form-text">
            <a href="https://developer.kookapp.cn/bot" target="_blank">https://developer.kookapp.cn/bot</a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <label for="kook-guild-id" class="form-label">{{ $t("Guild ID") }}</label>
        <input id="kook-guild-id" v-model="$parent.notification.kookGuildID" type="text" class="form-control" required>

        <div class="form-text">
            <p style="margin-top: 8px;">
                {{ $t("wayToGetKookGuildID") }}
            </p>
        </div>
    </div>

    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://developer.kookapp.cn" target="_blank">https://developer.kookapp.cn</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
export default {
    components: {
        HiddenInput,
    }
};
</script>
