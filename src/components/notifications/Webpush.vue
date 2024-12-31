<template>
    <button
        class="mb-3"
        type="button" :class="[
            'btn',
            browserSupportsServiceWorkers ? 'btn-primary' : 'btn-danger'
        ]"
        :disabled="!btnEnabled"
        @click="registerWebpush"
    >
        <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
        <span v-else-if="$parent.notification.subscription" class="me-1">✓</span>
        {{ btnText }}
    </button>

    <div class="form-text">
        {{ $t("Webpush Helptext") }}
    </div>
</template>

<script>
export default {
    data() {
        return {
            btnEnabled: false,
            btnText: "",
            processing: false,
            browserSupportsServiceWorkers: false,
            publicVapidKey: null,
        };
    },
    mounted() {
        if (this.$parent.notification.subscription) {
            this.btnEnabled = false;
            this.browserSupportsServiceWorkers = true;
            this.btnText = this.$t("Notifications Enabled");
        } else {
            if (("serviceWorker" in navigator)) {
                this.btnText = this.$t("Allow Notifications");
                this.browserSupportsServiceWorkers = true;
                this.btnEnabled = true;
            } else {
                this.btnText = this.$t("Browser not supported");
                this.browserSupportsServiceWorkers = false;
                this.btnEnabled = false;
            }
        }
    },
    methods: {
        async registerWebpush() {
            this.processing = true;

            try {
                const publicKey = await new Promise((resolve, reject) => {
                    this.$root.getSocket().emit("getWebpushVapidPublicKey", (resp) => {
                        if (!resp.ok) {
                            reject(new Error(resp.msg));
                        }
                        console.log(resp.msg);
                        resolve(resp.msg);
                    });
                });

                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    this.$root.toastRes({
                        ok: false,
                        msg: this.$t("Unable to get permission to notify"),
                    });
                    this.processing = false;
                    return;
                }

                const registration = await navigator.serviceWorker.ready;

                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: publicKey,
                });

                this.$parent.notification.subscription = subscription;
                this.btnEnabled = false;
                this.browserSupportsServiceWorkers = true;
                this.btnText = this.$t("Notifications Enabled");
            } catch (error) {
                console.error("Subscription failed:", error);
                this.$root.toastRes({
                    ok: false,
                    msg: error
                });
            } finally {
                this.processing = false;
            }
        }
    },
};
</script>
