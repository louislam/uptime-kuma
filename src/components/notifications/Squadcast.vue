<template>
    <div class="mb-3">
        <label for="webhook-url" class="form-label">{{ $t("Post URL") }}</label>
        <input id="webhook-url" v-model="$parent.notification.squadcastWebhookURL" type="url" pattern="https?://.+" class="form-control" required>
    </div>
</template>
