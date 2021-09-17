<template>
    <div class="mb-3">
        <label for="pushy-app-token" class="form-label">API_KEY</label>
        <HiddenInput id="pushy-app-token" v-model="$parent.notification.pushyAPIKey" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="pushy-user-key" class="form-label">USER_TOKEN</label>
        <div class="input-group mb-3">
            <HiddenInput id="pushy-user-key" v-model="$parent.notification.pushyToken" :required="true" autocomplete="one-time-code"></HiddenInput>
        </div>
    </div>
    <p style="margin-top: 8px;">
        More info on: <a href="https://pushy.me/docs/api/send-notifications" target="_blank">https://pushy.me/docs/api/send-notifications</a>
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
            name: "pushy",
        }
    },
}
</script>
