<template>
    <div class="mb-3">
        <label for="fluxer-webhook-url" class="form-label">{{ $t("Fluxer Webhook URL") }}</label>
        <HiddenInput
            id="fluxer-webhook-url"
            v-model="$parent.notification.fluxerWebhookUrl"
            type="url"
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
</template>
<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        TemplatedTextarea,
        HiddenInput,
    },
    mounted() {
        if (!this.$parent.notification.fluxerChannelType) {
            this.$parent.notification.fluxerChannelType = "channel";
        }
        if (this.$parent.notification.disableUrl === undefined) {
            this.$parent.notification.disableUrl = false;
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
