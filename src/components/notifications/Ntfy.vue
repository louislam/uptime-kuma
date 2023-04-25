<template>
    <div class="mb-3">
        <label for="ntfy-ntfytopic" class="form-label">{{ $t("ntfy Topic") }}</label>
        <div class="input-group mb-3">
            <input id="ntfy-ntfytopic" v-model="$parent.notification.ntfytopic" type="text" class="form-control" required>
        </div>
    </div>
    <div class="mb-3">
        <label for="ntfy-server-url" class="form-label">{{ $t("Server URL") }}</label>
        <div class="input-group mb-3">
            <input id="ntfy-server-url" v-model="$parent.notification.ntfyserverurl" type="text" class="form-control" required>
        </div>
    </div>
    <div class="mb-3">
        <label for="ntfy-priority" class="form-label">{{ $t("Priority") }}</label>
        <input id="ntfy-priority" v-model="$parent.notification.ntfyPriority" type="number" class="form-control" required min="1" max="5" step="1">
    </div>
    <div class="mb-3">
        <label for="authentication-method" class="form-label">{{ $t("ntfyAuthenticationMethod") }}</label>
        <select id="authentication-method" v-model="$parent.notification.ntfyAuthenticationMethod" class="form-select">
            <option v-for="(name, type) in authenticationMethods" :key="type" :value="type">{{ name }}</option>
        </select>
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'usernamePassword'" class="mb-3">
        <label for="ntfy-username" class="form-label">{{ $t("Username") }}</label>
        <div class="input-group mb-3">
            <input id="ntfy-username" v-model="$parent.notification.ntfyusername" type="text" class="form-control">
        </div>
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'usernamePassword'" class="mb-3">
        <label for="ntfy-password" class="form-label">{{ $t("Password") }}</label>
        <div class="input-group mb-3">
            <HiddenInput id="ntfy-password" v-model="$parent.notification.ntfypassword" autocomplete="new-password"></HiddenInput>
        </div>
    </div>
    <div v-if="$parent.notification.ntfyAuthenticationMethod === 'accessToken'" class="mb-3">
        <label for="ntfy-access-token" class="form-label">{{ $t("Access Token") }}</label>
        <div class="input-group mb-3">
            <HiddenInput id="ntfy-access-token" v-model="$parent.notification.ntfyaccesstoken"></HiddenInput>
        </div>
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
