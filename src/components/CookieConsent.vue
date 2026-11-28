<template>
    <div v-if="visible" class="cookie-consent" data-testid="cookie-consent">
        <span>{{ $t("Cookie Consent Message") }}</span>
        <button class="btn btn-primary btn-sm" data-testid="cookie-accept" @click="choose(true)">
            {{ $t("Accept") }}
        </button>
        <button class="btn btn-secondary btn-sm" data-testid="cookie-decline" @click="choose(false)">
            {{ $t("Decline") }}
        </button>
    </div>
</template>

<script>
const STORAGE_KEY = "analyticsConsent";

export default {
    data() {
        return { visible: false };
    },
    mounted() {
        try {
            let consent = localStorage.getItem(STORAGE_KEY);
            if (consent === "granted") {
                this.applyConsent(true);
                this.visible = false;
            } else if (consent === "denied") {
                this.applyConsent(false);
                this.visible = false;
            } else {
                this.visible = true;
            }
        } catch (e) {
            console.error("Failed to read consent choice", e);
            this.visible = true;
        }
    },
    methods: {
        /**
         *  Apply the user's choice and store it in localStorage.
         * @param {boolean} granted - Whether the user granted consent or not.
         */
        choose(granted) {
            try {
                localStorage.setItem(STORAGE_KEY, granted ? "granted" : "denied");
            } catch (e) {
                console.error("Failed to store consent choice", e);
            }
            this.applyConsent(granted);
            this.visible = false;
        },
        /**
         *  Apply the user's choice to Google Analytics.
         * @param {boolean} granted - Whether the user granted consent or not.
         */
        applyConsent(granted) {
            if (window.gtag) {
                window.gtag("consent", "update", {
                    analytics_storage: granted ? "granted" : "denied",
                });
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.cookie-consent {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;

    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 16px;

    background-color: white;
    border-top: 1px solid #ededed;
    box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.1);

    .dark & {
        background-color: $dark-header-bg;
        border-top-color: $dark-border-color;
        color: $dark-font-color;
        box-shadow: 0 -2px 20px rgba(0, 0, 0, 0.5);
    }
}
</style>
