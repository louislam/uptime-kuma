<template>
    <div class="mb-3">
        <label for="pushbullet-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <HiddenInput id="pushbullet-access-token" v-model="$parent.notification.pushbulletAccessToken" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>

    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px;">
        <a href="https://docs.pushbullet.com" target="_blank">https://docs.pushbullet.com</a>
    </i18n-t>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
};
</script>
