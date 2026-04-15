<template>
    <div class="mb-3">
        <label for="pushbullet-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <HiddenInput
            id="pushbullet-access-token"
            v-model="$parent.notification.pushbulletAccessToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>

    <i18n-t tag="p" keypath="More info on:" style="margin-top: 8px">
        <a href="https://docs.pushbullet.com" target="_blank">https://docs.pushbullet.com</a>
    </i18n-t>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input
                id="pushbullet-use-template"
                v-model="$parent.notification.pushbulletUseTemplate"
                class="form-check-input"
                type="checkbox"
            />
            <label class="form-check-label" for="pushbullet-use-template">
                {{ $t("useTemplate") }}
            </label>
        </div>
        <div class="form-text">
            {{ $t("useTemplateDescription") }}
        </div>
    </div>

    <div v-show="$parent.notification.pushbulletUseTemplate">
        <div class="mb-3">
            <label for="pushbullet-title-template" class="form-label">{{ $t("Title Template") }}</label>
            <TemplatedInput
                id="pushbullet-title-template"
                v-model="$parent.notification.pushbulletTitleTemplate"
                :required="false"
                placeholder=""
            ></TemplatedInput>
            <div class="form-text">{{ $t("templateFallback") }}</div>
        </div>

        <div class="mb-3">
            <label for="pushbullet-message-template" class="form-label">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="pushbullet-message-template"
                v-model="$parent.notification.pushbulletMessageTemplate"
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
};
</script>
