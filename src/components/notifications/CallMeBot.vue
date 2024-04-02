<template>
    <div class="mb-3">
        <label for="callmebot-endpoint" class="form-label">{{ $t("Endpoint") }}</label>
        <input id="callmebot-endpoint" v-model="$parent.notification.callMeBotEndpoint" type="text" class="form-control" required>
        <i18n-t tag="div" keypath="callMeBotGet" class="form-text">
            <a href="https://www.callmebot.com/blog/free-api-facebook-messenger/" target="_blank">Facebook Messenger</a>
            <a href="https://www.callmebot.com/blog/test-whatsapp-api/" target="_blank">WhatsApp</a>
            <a href="https://www.callmebot.com/blog/telegram-phone-call-using-your-browser/" target="_blank">Telegram Call</a>
            1 message / 10 sec; 1 call / 65 sec
            <!--There is no public documentation available. This data is based on testing!-->
        </i18n-t>
    </div>
</template>
