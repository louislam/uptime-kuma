<template>
    <div class="mb-3">
        <label for="ntfy-ntfytopic" class="form-label">{{ $t("ntfy Topic") }}</label>
        <input id="ntfy-ntfytopic" v-model="$parent.notification.ntfytopic" type="text" class="form-control" required>
    </div>
    <div class="mb-3">
        <label for="ntfy-server-url" class="form-label">{{ $t("Server URL") }}</label>
        <input id="ntfy-server-url" v-model="$parent.notification.ntfyserverurl" type="text" class="form-control" required>
        <div class="form-text">
            {{ $t("Server URL should not contain the nfty topic") }}
        </div>
    </div>
    <div class="mb-3">
        <label for="ntfy-priority" class="form-label">{{ $t("Priority") }}</label>
        <input id="ntfy-priority" v-model="$parent.notification.ntfyPriority" type="number" class="form-control" required min="1" max="5" step="1">
        <label for="ntfy-priority-down" class="form-label">{{ $t("ntfyPriorityDown") }}</label>
        <input id="ntfy-priority-down" v-model="$parent.notification.ntfyPriorityDown" type="number" class="form-control" required min="1" max="5" step="1">
        <div class="form-text">
            <p v-if="$parent.notification.ntfyPriority == $parent.notification.ntfyPriorityDown && $parent.notification.ntfyPriority >= 5">
                {{ $t("ntfyPriorityHelptextAllEvents") }}
            </p>
            <i18n-t v-else-if="$parent.notification.ntfyPriority > $parent.notification.ntfyPriorityDown" tag="p" keypath="ntfyPriorityHelptextPriorityHigherThanDown">
                <code>DOWN</code>
                <code>{{ $parent.notification.ntfyPriority }}</code>
                <code>{{ $parent.notification.ntfyPriorityDown }}</code>
            </i18n-t>
            <i18n-t v-else tag="p" keypath="ntfyPriorityHelptextAllExceptDown">
                <code>DOWN</code>
                <code>{{ $parent.notification.ntfyPriorityDown }}</code>
            </i18n-t>
        </div>
    </div>
    <div class="mb-3">
        <label for="authentication-method" class="form-label">{{ $t("ntfyAuthenticationMethod") }}</label>
        <select id="authentication-method" v-model="$parent.notification.ntfyAuthenticationMethod" class="form-select">
            <option v-for="(name, type) in authenticationMethods" :key="type" :value="type">{{ name }}</option>
        </select>
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'usernamePassword'" class="mb-3">
        <label for="ntfy-username" class="form-label">{{ $t("Username") }}</label>
        <input id="ntfy-username" v-model="$parent.notification.ntfyusername" type="text" class="form-control">
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'usernamePassword'" class="mb-3">
        <label for="ntfy-password" class="form-label">{{ $t("Password") }}</label>
        <HiddenInput id="ntfy-password" v-model="$parent.notification.ntfypassword" autocomplete="new-password"></HiddenInput>
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'accessToken'" class="mb-3">
        <label for="ntfy-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <HiddenInput id="ntfy-access-token" v-model="$parent.notification.ntfyaccesstoken"></HiddenInput>
    </div>
    <div class="mb-3">
        <label for="ntfy-icon" class="form-label">{{ $t("IconUrl") }}</label>
        <input id="ntfy-icon" v-model="$parent.notification.ntfyIcon" type="text" class="form-control">
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },
    computed: {
        authenticationMethods() {
            return {
                none: this.$t("None"),
                usernamePassword: this.$t("ntfyUsernameAndPassword"),
                accessToken: this.$t("Access Token")
            };
        }
    },
    mounted() {
        if (typeof this.$parent.notification.ntfyPriority === "undefined") {
            this.$parent.notification.ntfyserverurl = "https://ntfy.sh";
            this.$parent.notification.ntfyPriority = 5;
        }

        // Setting down priority if it's undefined
        if (typeof this.$parent.notification.ntfyPriorityDown === "undefined") {
            this.$parent.notification.ntfyPriorityDown = 5;
        }

        // Handling notifications that added before 1.22.0
        if (typeof this.$parent.notification.ntfyAuthenticationMethod === "undefined") {
            if (!this.$parent.notification.ntfyusername) {
                this.$parent.notification.ntfyAuthenticationMethod = "none";
            } else {
                this.$parent.notification.ntfyAuthenticationMethod = "usernamePassword";
            }
        }
    },
};
</script>
