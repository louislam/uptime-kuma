<template>
    <div class="mb-3">
        <label for="mattermost-webhook-url" class="form-label">
            {{ $t("Webhook URL") }}
            <span style="color: red"><sup>*</sup></span>
        </label>
        <input
            id="mattermost-webhook-url"
            v-model="$parent.notification.mattermostWebhookUrl"
            type="text"
            class="form-control"
            required
        />
        <label for="mattermost-username" class="form-label">{{ $t("Username") }}</label>
        <input
            id="mattermost-username"
            v-model="$parent.notification.mattermostusername"
            type="text"
            class="form-control"
        />
        <label for="mattermost-iconurl" class="form-label">{{ $t("Icon URL") }}</label>
        <input
            id="mattermost-iconurl"
            v-model="$parent.notification.mattermosticonurl"
            type="text"
            class="form-control"
        />
        <label for="mattermost-iconemo" class="form-label">{{ $t("Icon Emoji") }}</label>
        <input
            id="mattermost-iconemo"
            v-model="$parent.notification.mattermosticonemo"
            type="text"
            class="form-control"
        />
        <label for="mattermost-channel" class="form-label">{{ $t("Channel Name") }}</label>
        <input
            id="mattermost-channel-name"
            v-model="$parent.notification.mattermostchannel"
            type="text"
            class="form-control"
        />
        <div class="form-text">
            <span style="color: red"><sup>*</sup></span>
            {{ $t("Required") }}
            <i18n-t tag="p" keypath="aboutWebhooks" style="margin-top: 8px">
                <a href="https://developers.mattermost.com/integrate/webhooks/incoming/" target="_blank">
                    https://developers.mattermost.com/integrate/webhooks/incoming/
                </a>
            </i18n-t>
            <p style="margin-top: 8px">
                {{ $t("aboutMattermostChannelName") }}
            </p>
            <p style="margin-top: 8px">
                {{ $t("aboutKumaURL") }}
            </p>
            <p style="margin-top: 8px">
                {{ $t("aboutIconURL") }}
            </p>
            <i18n-t tag="p" keypath="emojiCheatSheet" style="margin-top: 8px">
                <a href="https://www.webfx.com/tools/emoji-cheat-sheet/" target="_blank">
                    https://www.webfx.com/tools/emoji-cheat-sheet/
                </a>
            </i18n-t>
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                id="mattermost-use-template"
                v-model="$parent.notification.mattermostUseTemplate"
                class="form-check-input"
                type="checkbox"
            />
            <label class="form-check-label" for="mattermost-use-template">
                {{ $t("useTemplate") }}
            </label>
        </div>
        <div class="form-text">
            {{ $t("useTemplateDescription") }}
        </div>
    </div>

    <div v-show="$parent.notification.mattermostUseTemplate">
        <div class="mb-3">
            <label for="mattermost-message-template" class="form-label">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="mattermost-message-template"
                v-model="$parent.notification.mattermostMessageTemplate"
                :required="false"
                placeholder=""
            ></TemplatedTextarea>
            <div class="form-text">{{ $t("templateFallback") }}</div>
        </div>
    </div>
</template>

<script>
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        TemplatedTextarea,
    },
};
</script>
