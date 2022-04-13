<template>
    <div class="mb-3">
        <label for="gotify-application-token" class="form-label">{{ $t("Application Token") }}</label>
        <HiddenInput id="gotify-application-token" v-model="$parent.notification.gotifyapplicationToken" :required="true" autocomplete="one-time-code"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="gotify-server-url" class="form-label">{{ $t("Server URL") }}</label>
        <div class="input-group mb-3">
            <input id="gotify-server-url" v-model="$parent.notification.gotifyserverurl" type="text" class="form-control" required>
        </div>
    </div>

    <div class="mb-3">
        <label for="gotify-priority" class="form-label">{{ $t("Priority") }}</label>
        <input id="gotify-priority" v-model="$parent.notification.gotifyPriority" type="number" class="form-control" required min="0" max="10" step="1">
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.gotifyPriority === "undefined") {
            this.$parent.notification.gotifyPriority = 8;
        }
    },
};
</script>
