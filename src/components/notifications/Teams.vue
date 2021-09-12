<template>
    <div class="mb-3">
        <label for="teams-webhookurl" class="form-label">Webhook URL</label>
        <input
            id="teams-webhookurl"
            v-model="$parent.notification.webhookUrl"
            type="text"
            class="form-control"
            required
        />
        <div class="form-text">
            You can learn how to create a webhook url
            <a
                href="https://docs.microsoft.com/pt-br/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                target="_blank"
            >here</a>.
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            name: "teams",
        };
    },
};
</script>
