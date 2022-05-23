<template>
    <div class="mb-3">
        <label for="ntfy-ntfytopic" class="form-label">{{ $t("ntfy Topic") }}</label>
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
        <input id="ntfy-priority" v-model="$parent.notification.ntfyPriority" type="number" class="form-control" required min="1" max="5" step="1">
    </div>
</template>

<script>
export default {
    mounted() {
        if (typeof this.$parent.notification.ntfyPriority === "undefined") {
            this.$parent.notification.ntfyserverurl = "https://ntfy.sh";
            this.$parent.notification.ntfyPriority = 5;
        }
    },
};
</script>
