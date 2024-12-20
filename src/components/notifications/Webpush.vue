<template>
    <button
        class="mb-3"
        type="button"
        :class="[
            'btn',
            canRegister ? 'btn-primary' : 'btn-danger'
        ]"
        :disabled="!btnEnabled"
        @click="registerWebpush"
    >
        <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
        <span v-else-if="$parent.notification.subscription" class="me-1">✓</span>
        {{ btnText }}
    </button>

    <div class="mb-3 form-text">
        <a href="TODO" target="_blank">{{ $t("documentationOf", ["Webpush"]) }}</a>
    </div>
</template>

<script>
export default {
    data() {
        return {
            //store subscription info
            btnEnabled: false,
            btnText: "",
            processing: false,
            //determines if browser supports service worker
            canRegister: false,
            //store public vapid key
            publicVapidKey: null,
        };
    },
    mounted() {
        // if already subscribed
        if (this.$parent.notification.subscription) {
            this.btnEnabled = false;
            this.canRegister = true;
            this.btnText = "Notifications Enabled";
        } else { //not subscribed
            //check if browser supports service worker
            if (("serviceWorker" in navigator)) {
                this.btnText = "Allow Notifications";
                this.canRegister = true;
                this.btnEnabled = true;
            } else { //browser does not support service worker
                this.btnText = "Browser not supported";
                this.canRegister = false;
                this.btnEnabled = false;
            }
        }
    },
    methods: {
        async registerWebpush() {
            this.processing = true;

            try {
                // Get the VAPID public key from the server
                const publicKey = await new Promise((resolve, reject) => {
                    this.$root.getSocket().emit("getWebpushVapidPublicKey", (resp) => {
                        if (!resp.ok) {
                            reject(new Error(resp.msg));
                        }
                        resolve(resp.msg);
                    });
                });

                //request permission to send notifications
                const permission = await Notification.requestPermission();
                if (permission !== "granted") {
                    this.$root.toastRes({
                        ok: false,
                        msg: "Unable to get permission to notify.",
                    });
                    this.processing = false;
                    return;
                }

                //get service worker registration
                const registration = await navigator.serviceWorker.ready;
                //subscribe to push notifications
                const subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: publicKey,
                });

                //store subscription info and update button
                this.$parent.notification.subscription = subscription;
                this.btnEnabled = false;
                this.canRegister = true;
                this.btnText = "Notifications Enabled";
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
