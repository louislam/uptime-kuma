<template>
    <div class="mb-3">
        <label for="line-notify-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <input id="line-notify-access-token" v-model="$parent.notification.lineNotifyAccessToken" type="text" class="form-control" :required="true">
    </div>
</template>
