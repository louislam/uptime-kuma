<template>
    <div class="mb-3">
        <label for="ntfy-ntfytopic" class="form-label">ntfytopic</label>
        <div class="input-group mb-3">
            <input id="ntfy-ntfytopic" v-model="$parent.notification.ntfytopic" type="text" class="form-control" required>
        </div>
    </div>
    <div class="mb-3">
        <label for="ntfy-server-url" class="form-label">{{ $t("Server URL") }}</label>
        <div class="input-group mb-3">
            <input id="ntfy-server-url" v-model="$parent.notification.ntfyserverurl" type="text" class="form-control" required>
        </div>
    </div>

    <div class="mb-3">
        <label for="ntfy-priority" class="form-label">{{ $t("Priority") }}</label>
        <input id="ntfy-priority" v-model="$parent.notification.ntfyPriority" type="number" class="form-control" required min="0" max="10" step="1">
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    mounted() {
        if (typeof this.$parent.notification.ntfyPriority === "undefined") {
            this.$parent.notification.ntfyPriority = 4;
        }
    },
}
</script>
