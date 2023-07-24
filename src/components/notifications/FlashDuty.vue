<template>
    <div class="mb-3">
        <label for="flashduty-integration-url" class="form-label">{{ $t("Integration URL") }}</label>
        <input id="flashduty-integration-url" v-model="$parent.notification.flashdutyIntegrationUrl" type="text" class="form-control" autocomplete="false">
    </div>
    <div class="mb-3">
        <label for="flashduty-priority" class="form-label">{{ $t("Priority") }}</label>
        <select id="flashduty-priority" v-model="$parent.notification.flashdutyPriority" class="form-select">
            <option value="Info" selected="selected">Info</option>
            <option value="Warning">Warning</option>
            <option value="Critical">Critical</option>
        </select>
    </div>
</template>

<script>

export default {
    mounted() {
    }
};
</script>
