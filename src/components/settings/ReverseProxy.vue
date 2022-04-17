<template>
    <div>
        <h4 class="mt-4">Cloudflare Tunnel</h4>

        <div class="my-3">
            <div>
                cloudflared:
                <span v-if="installed === true" class="text-primary">{{ $t("Installed") }}</span>
                <span v-else-if="installed === false" class="text-danger">{{ $t("Not installed") }}</span>
            </div>

            <div>
                {{ $t("Status") }}:
                <span v-if="running" class="text-primary">{{ $t("Running") }}</span>
                <span v-else-if="!running" class="text-danger">{{ $t("Not running") }}</span>
            </div>

            <div v-if="false">
                {{ message }}
            </div>

            <div v-if="errorMessage" class="mt-3">
                {{ $t("Message:") }}
                <textarea v-model="errorMessage" class="form-control" readonly></textarea>
            </div>

            <i18n-t v-if="installed === false" tag="p" keypath="wayToGetCloudflaredURL">
                <a
                    href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
                    target="_blank"
                >{{ $t("cloudflareWebsite") }}</a>
            </i18n-t>
        </div>

        <!-- If installed show token input -->
        <div v-if="installed" class="mb-2">
            <div class="mb-4">
                <label class="form-label" for="cloudflareTunnelToken">
                    Cloudflare Tunnel {{ $t("Token") }}
                </label>
                <HiddenInput
                    id="cloudflareTunnelToken"
                    v-model="cloudflareTunnelToken"
                    autocomplete="one-time-code"
                    :readonly="running"
                />
                <div class="form-text">
                    <div v-if="cloudflareTunnelToken" class="mb-3">
                        <span v-if="!running" class="remove-token" @click="removeToken">{{ $t("Remove Token") }}</span>
                    </div>

                    {{ $t("Don't know how to get the token? Please read the guide:") }}<br />
                    <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy-with-Cloudflare-Tunnel" target="_blank">
                        https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy-with-Cloudflare-Tunnel
                    </a>
                </div>
            </div>

            <div>
                <button v-if="!running" class="btn btn-primary" type="submit" @click="start">
                    {{ $t("Start") }} cloudflared
                </button>

                <button v-if="running" class="btn btn-danger" type="submit" @click="$refs.confirmStop.show();">
                    {{ $t("Stop") }} cloudflared
                </button>

                <Confirm ref="confirmStop" btn-style="btn-danger" :yes-text="$t('Stop') + ' cloudflared'" :no-text="$t('Cancel')" @yes="stop">
                    {{ $t("The current connection may be lost if you are currently connecting via Cloudflare Tunnel. Are you sure want to stop it? Type your current password to confirm it.") }}

                    <div class="mt-3">
                        <label for="current-password2" class="form-label">
                            {{ $t("Current Password") }}
                        </label>
                        <input
                            id="current-password2"
                            v-model="currentPassword"
                            type="password"
                            class="form-control"
                            required
                        />
                    </div>
                </Confirm>
            </div>
        </div>

        <h4 class="mt-4">{{ $t("Other Software") }}</h4>
        <div>
            {{ $t("For example: nginx, Apache and Traefik.") }} <br />
            {{ $t("Please read") }} <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" target="_blank">https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy</a>.
        </div>
    </div>
</template>

<script>
import HiddenInput from "../../components/HiddenInput.vue";
import Confirm from "../Confirm.vue";

const prefix = "cloudflared_";

export default {
    components: {
        HiddenInput,
        Confirm
    },
    data() {
        // See /src/mixins/socket.js
        return this.$root.cloudflared;
    },
    computed: {

    },
    watch: {

    },
    created() {
        this.$root.getSocket().emit(prefix + "join");
    },
    unmounted() {
        this.$root.getSocket().emit(prefix + "leave");
    },
    methods: {
        start() {
            this.$root.getSocket().emit(prefix + "start", this.cloudflareTunnelToken);
        },
        stop() {
            this.$root.getSocket().emit(prefix + "stop", this.currentPassword, (res) => {
                this.$root.toastRes(res);
            });
        },
        removeToken() {
            this.$root.getSocket().emit(prefix + "removeToken");
            this.cloudflareTunnelToken = "";
        }
    }
};
</script>

<style lang="scss" scoped>
.remove-token {
    text-decoration: underline;
    cursor: pointer;
}
</style>
