<template>
    <div class="mb-3">
        <label for="gotify-application-token" class="form-label">{{ $t("Application Token") }}</label>
        <HiddenInput
            id="gotify-application-token"
            v-model="$parent.notification.gotifyapplicationToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="gotify-server-url" class="form-label">{{ $t("Server URL") }}</label>
        <input
            id="gotify-server-url"
            v-model="$parent.notification.gotifyserverurl"
            type="text"
            class="form-control"
            required
        />
    </div>

    <div class="mb-3">
        <label for="gotify-priority" class="form-label">{{ $t("Priority") }}</label>
        <input
            id="gotify-priority"
            v-model="$parent.notification.gotifyPriority"
            type="number"
            class="form-control"
            required
            min="0"
            max="10"
            step="1"
        />
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                id="gotify-use-template"
                v-model="$parent.notification.gotifyUseTemplate"
                class="form-check-input"
                type="checkbox"
            />
            <label class="form-check-label" for="gotify-use-template">
                {{ $t("useTemplate") }}
            </label>
        </div>
        <div class="form-text">
            {{ $t("useTemplateDescription") }}
        </div>
    </div>

    <div v-show="$parent.notification.gotifyUseTemplate">
        <div class="mb-3">
            <label for="gotify-title-template" class="form-label">{{ $t("Title Template") }}</label>
            <TemplatedInput
                id="gotify-title-template"
                v-model="$parent.notification.gotifyTitleTemplate"
                :required="false"
                placeholder=""
            ></TemplatedInput>
            <div class="form-text">{{ $t("templateFallback") }}</div>
        </div>

        <div class="mb-3">
            <label for="gotify-message-template" class="form-label">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="gotify-message-template"
                v-model="$parent.notification.gotifyMessageTemplate"
                :required="false"
                placeholder=""
            ></TemplatedTextarea>
            <div class="form-text">{{ $t("templateFallback") }}</div>
        </div>
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedInput from "../TemplatedInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        HiddenInput,
        TemplatedInput,
        TemplatedTextarea,
    },
    mounted() {
        if (typeof this.$parent.notification.gotifyPriority === "undefined") {
            this.$parent.notification.gotifyPriority = 8;
        }
    },
};
</script>
