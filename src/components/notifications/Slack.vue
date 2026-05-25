<template>
    <div class="mb-3">
        <label for="slack-webhook-url" class="form-label">
            {{ $t("Webhook URL") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="slack-webhook-url"
            v-model="$parent.notification.slackwebhookURL"
            type="text"
            class="form-control"
            required
        />
        <label for="slack-username" class="form-label">{{ $t("Username") }}</label>
        <input id="slack-username" v-model="$parent.notification.slackusername" type="text" class="form-control" />
        <div class="form-text">
            {{ $t("aboutSlackUsername") }}
        </div>
        <label for="slack-iconemo" class="form-label">{{ $t("Icon Emoji") }}</label>
        <input id="slack-iconemo" v-model="$parent.notification.slackiconemo" type="text" class="form-control" />
        <label for="slack-channel" class="form-label">{{ $t("Channel Name") }}</label>
        <input id="slack-channel-name" v-model="$parent.notification.slackchannel" type="text" class="form-control" />

        <label class="form-label">{{ $t("Message format") }}</label>
        <div class="form-check form-switch">
            <input
                id="slack-text-message"
                v-model="$parent.notification.slackrichmessage"
                type="checkbox"
                class="form-check-input"
            />
            <label for="slack-text-message" class="form-label">{{ $t("Send rich messages") }}</label>
        </div>

        <div class="mb-3">
            <div class="form-check form-switch">
                <input
                    id="slack-include-group-name"
                    v-model="$parent.notification.slackIncludeGroupName"
                    type="checkbox"
                    class="form-check-input"
                />
                <label for="slack-include-group-name" class="form-check-label">{{ $t("slackIncludeGroupName") }}</label>
            </div>
            <div class="form-text">
                {{ $t("slackIncludeGroupNameDescription") }}
            </div>
        </div>

        <div class="mb-3">
            <div class="form-check form-switch">
                <input v-model="$parent.notification.slackUseTemplate" class="form-check-input" type="checkbox" />
                <label class="form-check-label">{{ $t("slackUseTemplate") }}</label>
            </div>
            <div class="form-text">
                {{ $t("slackUseTemplateDescription") }}
            </div>
        </div>

        <template v-if="$parent.notification.slackUseTemplate">
            <div class="mb-3">
                <label class="form-label" for="slack-message-template">{{ $t("Message Template") }}</label>
                <TemplatedTextarea
                    id="slack-message-template"
                    v-model="$parent.notification.slackTemplate"
                    :required="true"
                    :placeholder="slackTemplatedTextareaPlaceholder"
                ></TemplatedTextarea>
            </div>
        </template>

        <div class="form-text">
            <span style="color: red"><sup>*</sup></span>
            {{ $t("Required") }}
            <i18n-t tag="p" keypath="aboutWebhooks" style="margin-top: 8px">
                <a href="https://api.slack.com/messaging/webhooks" target="_blank">
                    https://api.slack.com/messaging/webhooks
                </a>
            </i18n-t>
            <p style="margin-top: 8px">
                {{ $t("aboutChannelName", ["slack"]) }}
            </p>
            <p style="margin-top: 8px">
                {{ $t("aboutKumaURL") }}
            </p>
            <i18n-t tag="p" keypath="emojiCheatSheet" style="margin-top: 8px">
                <a href="https://www.webfx.com/tools/emoji-cheat-sheet/" target="_blank">
                    https://www.webfx.com/tools/emoji-cheat-sheet/
                </a>
            </i18n-t>
        </div>

        <div class="form-check form-switch">
            <input
                id="slack-channel-notify"
                v-model="$parent.notification.slackchannelnotify"
                type="checkbox"
                class="form-check-input"
            />
            <label for="slack-channel-notify" class="form-label">{{ $t("Notify Channel") }}</label>
        </div>
        <div class="form-text">
            {{ $t("aboutNotifyChannel") }}
        </div>
    </div>
</template>

<script>
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        TemplatedTextarea,
    },
    computed: {
        slackTemplatedTextareaPlaceholder() {
            return this.$t("Example:", [
                `
Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}
{% if monitorJSON and monitorJSON.path and monitorJSON.path.length > 1 %}_{{ monitorJSON.path.slice(0, -1).join(' / ') }}_\n{% endif %}
{{ msg }}
                `,
            ]);
        },
    },
    mounted() {
        if (typeof this.$parent.notification.slackIncludeGroupName === "undefined") {
            this.$parent.notification.slackIncludeGroupName = true;
        }
    },
};
</script>
