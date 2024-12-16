<template>
    <button 
        type="button" :class="[
            'btn', 
            canRegister ? 'btn-primary' : 'btn-danger'
        ]" :disabled="!canRegister || subscriptionReceived" 
        @click="registerWebpush"
        class="mb-3">
        <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
        <span v-else-if="subscriptionReceived" class="me-1">✓</span>
        {{ registerText }}
    </button>
   

    <div class="mb-3 form-text">
        <a href="TODO" target="_blank">{{ $t("documentationOf", ["Webpush"]) }}</a>
    </div>
</template>

<script>
export default {
    data() {
        return {
            subscription: '',
            registerText: '',
            processing: false,
            canRegister: false,
            subscriptionReceived: false,
            publicVapidKey: "",
        }
    },
    mounted() {
        if (("serviceWorker" in navigator)) {
            this.registerText = "Allow Notifications";
            this.canRegister = true;
        } else {
            this.registerText = "Browser not supported";
            this.canRegister = false;
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
                
                const permission = await Notification.requestPermission();
                if (permission !== 'granted') {
                    this.$root.toastRes({
                        ok: false,
                        msg: "Unable to get permission to notify.",
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

                this.subscriptionReceived = true;
                this.registerText = "Notifications Enabled";
            } catch (error) {
                console.error('Subscription failed:', error);
                this.$root.toastRes({ ok: false, msg: error });
            } finally {
                this.processing = false;
            }
        }
    },
};
</script>