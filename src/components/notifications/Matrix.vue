<template>
    <div class="mb-3">
        <label for="homeserver-url" class="form-label">{{ $t("matrixHomeserverURL") }}</label>
        <span style="color: red"><sup>*</sup></span>
        <input
            id="homeserver-url"
            v-model="$parent.notification.homeserverUrl"
            type="text"
            class="form-control"
            :required="true"
        />
    </div>
    <div class="mb-3">
        <label for="internal-room-id" class="form-label">{{ $t("Internal Room Id") }}</label>
        <span style="color: red"><sup>*</sup></span>
        <input
            id="internal-room-id"
            v-model="$parent.notification.internalRoomId"
            type="text"
            class="form-control"
            required="true"
        />
    </div>
    <div class="mb-3">
        <label for="access-token" class="form-label">{{ $t("Access Token") }}</label>
        <span style="color: red"><sup>*</sup></span>
        <HiddenInput
            id="access-token"
            v-model="$parent.notification.accessToken"
            :required="true"
            autocomplete="new-password"
            :maxlength="500"
        ></HiddenInput>
    </div>

    <div class="form-text">
        <span style="color: red"><sup>*</sup></span>
        {{ $t("Required") }}
        <p style="margin-top: 8px">
            {{ $t("matrixDesc1") }}
        </p>
        <i18n-t tag="p" keypath="matrixDesc2" style="margin-top: 8px">
            <code>
                curl -XPOST --json '{"type": "m.login.password", "identifier": {"user": "botusername", "type":
                "m.id.user"}, "password": "passwordforuser"}' "https://home.server/_matrix/client/v3/login"
            </code>
            .
        </i18n-t>
    </div>

    <div class="mb-3">
        <div class="form-check form-switch">
            <input v-model="$parent.notification.matrixUseTemplate" class="form-check-input" type="checkbox" />
            <label class="form-check-label">{{ $t("matrixUseTemplate") }}</label>
        </div>

        <div class="form-text">
            {{ $t("matrixUseTemplateDescription") }}
        </div>
    </div>

    <template v-if="$parent.notification.matrixUseTemplate">
        <div class="mb-3">
            <label class="form-label" for="message_template">{{ $t("Message Template") }}</label>
            <TemplatedTextarea
                id="message_template"
                v-model="$parent.notification.matrixTemplate"
                :required="true"
                :placeholder="matrixTemplatedTextareaPlaceholder"
            ></TemplatedTextarea>
        </div>
    </template>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";
import TemplatedTextarea from "../TemplatedTextarea.vue";

export default {
    components: {
        HiddenInput,
        TemplatedTextarea,
    },
    computed: {
        matrixTemplatedTextareaPlaceholder() {
            return this.$t("Example:", [
                `
Uptime Kuma Alert{% if monitorJSON %} - {{ monitorJSON['name'] }}{% endif %}

{{ msg }}
                `,
            ]);
        },
    },
};
</script>
