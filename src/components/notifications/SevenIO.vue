<template>
    <div class="mb-3">
        <label for="discord-webhook-url" class="form-label">{{ $t("apiKeySevenIO") }}</label>
        <input id="discord-webhook-url" v-model="$parent.notification.sevenioApiKey" type="text" class="form-control" required autocomplete="false">
        <div class="form-text">
            {{ $t("wayToGetSevenIOApiKey") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="discord-username" class="form-label">{{ $t("senderSevenIO") }}</label>
        <input id="discord-username" v-model="$parent.notification.sevenioSender" type="text" class="form-control" autocomplete="false" placeholder="0123456789">
    </div>

    <div class="mb-3">
        <label for="discord-prefix-message" class="form-label">{{ $t("receiverSevenIO") }}</label>
        <input id="discord-prefix-message" v-model="$parent.notification.sevenioReceiver" type="text" class="form-control" autocomplete="false" placeholder="0123456789">
        <div class="form-text">
            {{ $t("receiverInfoSevenIO") }}
        </div>
    </div>
</template>
