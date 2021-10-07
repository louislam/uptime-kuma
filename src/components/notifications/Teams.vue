<template>
    <div class="mb-3">
        <label for="teams-webhookurl" class="form-label">{{ $t("Webhook URL") }}</label>
        <input
            id="teams-webhookurl"
            v-model="$parent.notification.webhookUrl"
            type="text"
            class="form-control"
            required
        />
        <i18n-t tag="div" keypath="wayToGetTeamsURL" class="form-text">
            <a
                href="https://docs.microsoft.com/en-us/microsoftteams/platform/webhooks-and-connectors/how-to/add-incoming-webhook"
                target="_blank"
            >{{ $t("here") }}</a>
        </i18n-t>
    </div>
</template>
