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
            >
                {{ $t("here") }}
            </a>
        </i18n-t>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.teamsEnableTags" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("teamsEnableTags") }}</label>
        </div>

        <div class="form-text">
            {{ $t("teamsEnableTagsDescription") }}
        </div>
    </div>
</template>
