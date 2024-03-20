<template>
    <div class="mb-3">
        <label for="callmebot-endpoint" class="form-label">{{ $t("Endpoint") }}</label>
        <div class="input-group mb-3">
            <input id="callmebot-endpoint" v-model="$parent.notification.callMeBotEndpoint" type="text" class="form-control" required>
            <button v-if="$parent.notification.callMeBotEndpoint" class="btn btn-outline-secondary" type="button" @click="cleanupEndpoint">
                {{ $t("Cleanup") }}
            </button>
        </div>
        <i18n-t tag="div" keypath="callMeBotGet" class="form-text">
            <a href="https://www.callmebot.com/blog/free-api-facebook-messenger/" target="_blank">Facebook Messenger</a>
        </i18n-t>
        <i18n-t tag="div" keypath="callMeBotGet" class="form-text">
            <a href="https://www.callmebot.com/blog/test-whatsapp-api/" target="_blank">WhatsApp</a>
        </i18n-t>
        <i18n-t tag="div" keypath="callMeBotGet" class="form-text">
            <a href="https://www.callmebot.com/blog/telegram-phone-call-using-your-browser/" target="_blank">Telegram Call</a>
        </i18n-t>
        <i18n-t tag="div" keypath="callMeBotInfo" class="form-text" />
    </div>
</template>

<script>

export default {
    methods: {
        /**
         * Remove the &text= param to be able to append one later
         * @returns {Promise<void>}
         * @throws The provided URL is invalid
         */

        cleanupEndpoint() {
            try {
                const url = new URL(this.$parent.notification.callMeBotEndpoint);
                url.searchParams.delete("text");
                this.$parent.notification.callMeBotEndpoint = url;
                this.$root.toastSuccess("URL was cleaned successfully");
            } catch (e) {
                this.$root.toastError("Invalid URL");
            }
        },
    }
};
</script>
