<template>
    <div class="mb-3">
        <label for="pushbullet-access-token" class="form-label">Access Token</label>
        <HiddenInput id="pushbullet-access-token" v-model="$parent.notification.pushbulletAccessToken" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>

    <p style="margin-top: 8px;">
        More info on: <a href="https://docs.pushbullet.com" target="_blank">https://docs.pushbullet.com</a>
    </p>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    data() {
        return {
            name: "pushbullet",
        }
    },
}
</script>
