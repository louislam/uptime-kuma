<template>
    <div class="mb-3">
        <label for="fluxer-webhook-url" class="form-label">{{ $t("Fluxer Webhook URL") }}</label>
        <input
            id="fluxer-webhook-url"
            v-model="$parent.notification.fluxerWebhookUrl"
            type="text"
            class="form-control"
            required
            autocomplete="false"
        />
        <div class="form-text">
            {{ $t("wayToGetFluxerURL") }}
        </div>
    </div>

    <div class="mb-3">
        <label for="fluxer-username" class="form-label">{{ $t("Bot Display Name") }}</label>
        <input
            id="fluxer-username"
            v-model="$parent.notification.fluxerUsername"
            type="text"
            class="form-control"
            autocomplete="false"
            :placeholder="$root.appName"
        />
    </div>

    <div class="mb-3">
        <label for="fluxer-prefix-message" class="form-label">{{ $t("Prefix Custom Message") }}</label>
        <input
            id="fluxer-prefix-message"
            v-model="$parent.notification.fluxerPrefixMessage"
            type="text"
            class="form-control"
            autocomplete="false"
            :placeholder="$t('Hello @everyone is...')"
        />
    </div>

    <div class="mb-3">
        <label for="fluxer-message-format" class="form-label">{{ $t("fluxerMessageFormat") }}</label>
        <select id="fluxer-message-format" v-model="$parent.notification.fluxerMessageFormat" class="form-select">
            <option value="normal">{{ $t("fluxerMessageFormatNormal") }}</option>
            <option value="minimalist">{{ $t("fluxerMessageFormatMinimalist") }}</option>
            <option value="custom">{{ $t("fluxerMessageFormatCustom") }}</option>
        </select>
    </div>

    <div v-show="$parent.notification.fluxerMessageFormat === 'custom'">
        <div class="mb-3">
            <label for="fluxer-message-template" class="form-label">{{ $t("fluxerMessageTemplate") }}</label>
            <TemplatedTextarea
                id="fluxer-message-template"
                v-model="$parent.notification.fluxerMessageTemplate"
                :required="false"
                placeholder=""
            ></TemplatedTextarea>
            <div class="form-text">{{ $t("fluxerUseMessageTemplateDescription") }}</div>
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                id="fluxer-disable-url"
                v-model="$parent.notification.disableUrl"
                class="form-check-input"
                type="checkbox"
                role="switch"
            />
            <label class="form-check-label" for="fluxer-disable-url">{{ $t("Disable URL in Notification") }}</label>
        </div>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                id="fluxer-suppress-notifications"
                v-model="$parent.notification.fluxerSuppressNotifications"
                class="form-check-input"
                type="checkbox"
                role="switch"
            />
            <label class="form-check-label" for="fluxer-suppress-notifications">
                {{ $t("Suppress Notifications") }}
            </label>
        </div>
        <div class="form-text">
            {{ $t("fluxerSuppressNotificationsHelptext") }}
        </div>
    </div>
</template>
<script>
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        TemplatedTextarea,
    },
    mounted() {
        if (!this.$parent.notification.fluxerChannelType) {
            this.$parent.notification.fluxerChannelType = "channel";
        }
        if (this.$parent.notification.disableUrl === undefined) {
            this.$parent.notification.disableUrl = false;
        }
        if (this.$parent.notification.fluxerSuppressNotifications === undefined) {
            this.$parent.notification.fluxerSuppressNotifications = false;
        }
        // Message format: default "normal"; migrate from old checkbox
        if (typeof this.$parent.notification.fluxerMessageFormat === "undefined") {
            const hadCustom =
                this.$parent.notification.fluxerUseMessageTemplate === true ||
                !!this.$parent.notification.fluxerMessageTemplate?.trim();
            this.$parent.notification.fluxerMessageFormat = hadCustom ? "custom" : "normal";
        }
    },
};
</script>
