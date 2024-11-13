<template>
    <div class="mb-3">
        <label for="pumble-webhook-url" class="form-label mb-2">{{ $t("Webhook URL") }}</label><span style="color: red;"><sup>*</sup></span>
        <input id="pumble-webhook-url" v-model="$parent.notification.pumblewebhookURL" type="text" class="form-control" required>
    </div>
</template>
<script setup lang="ts">
</script>
