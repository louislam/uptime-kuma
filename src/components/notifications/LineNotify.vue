<template>
    <div class="mb-3">
        <label for="line-notify-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <input id="line-notify-access-token" v-model="$parent.notification.lineNotifyAccessToken" type="text" class="form-control" :required="true">
    </div>
    <i18n-t tag="div" keypath="wayToGetLineNotifyToken" class="form-text" style="margin-top: 8px;">
        <a href="https://notify-bot.line.me/" target="_blank">https://notify-bot.line.me/</a>
    </i18n-t>
</template>
