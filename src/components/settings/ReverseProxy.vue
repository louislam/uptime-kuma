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

            <div class="mt-3">
                Message:
                <textarea v-model="errorMessage" class="form-control" readonly></textarea>
            </div>

            <p v-if="installed === false">(Download cloudflared from <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/">Cloudflare Website</a>)</p>
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
                />
                <div class="form-text">
                    Don't know how to get the token? Please read the guide:<br />
                    <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy-with-Cloudflare-Tunnel" target="_blank">
                        https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy-with-Cloudflare-Tunnel
                    </a>
                </div>
            </div>

            <!-- Save Button -->
            <div>
                <button v-if="!running" class="btn btn-primary" type="submit" @click="start">
                    {{ $t("Start") }} cloudflared
                </button>

                <button v-if="running" class="btn btn-danger" type="submit" @click="stop">
                    {{ $t("Stop") }} cloudflared
                </button>
            </div>
        </div>

        <h4 class="mt-4">Other Software</h4>
        <div>
            For example: nginx, Apache and Traefik. <br />
            Please read <a href="https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy" target="_blank">https://github.com/louislam/uptime-kuma/wiki/Reverse-Proxy</a>.
        </div>
    </div>
</template>

<script>
import HiddenInput from "../../components/HiddenInput.vue";

const prefix = "cloudflared_";

export default {
    components: {
        HiddenInput,
    },
    data() {
        return this.$root.cloudflared;
    },
    computed: {

    },
    watch: {

    },
    mounted() {
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
            this.$root.getSocket().emit(prefix + "stop");
        },
    }
};
</script>

<style lang="scss" scoped>
.logo {
    margin: 4em 1em;
}
.update-link {
    font-size: 0.9em;
}
</style>
