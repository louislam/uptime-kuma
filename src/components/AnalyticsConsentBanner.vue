<template>
    <div
        v-if="visible"
        class="analytics-consent-banner shadow-box p-3"
        role="dialog"
        aria-live="polite"
        data-testid="analytics-consent-banner"
    >
        <p class="mb-2">{{ $t("analyticsConsentBannerText") }}</p>
        <div class="d-flex gap-2 justify-content-end">
            <button
                type="button"
                class="btn btn-outline-secondary btn-sm"
                data-testid="analytics-consent-decline"
                @click="decline"
            >
                {{ $t("Decline") }}
            </button>
            <button type="button" class="btn btn-primary btn-sm" data-testid="analytics-consent-accept" @click="accept">
                {{ $t("Accept") }}
            </button>
        </div>
    </div>
</template>

<script>
const STORAGE_PREFIX = "analyticsConsent:";
const MARKER_ATTRIBUTES = ["type", "data-uk-consent", "data-original-type"];

export default {
    props: {
        slug: {
            type: String,
            required: true,
        },
    },

    data() {
        return {
            visible: false,
        };
    },

    computed: {
        storageKey() {
            return STORAGE_PREFIX + this.slug;
        },
    },

    mounted() {
        const choice = this.readChoice();

        if (choice === "granted") {
            this.activateScripts();
        } else if (choice !== "denied") {
            this.visible = true;
        }
    },

    methods: {
        readChoice() {
            try {
                return localStorage.getItem(this.storageKey);
            } catch {
                return null;
            }
        },

        saveChoice(choice) {
            try {
                localStorage.setItem(this.storageKey, choice);
            } catch {
                // Storage unavailable (private mode): ask again next visit
            }
        },

        accept() {
            this.saveChoice("granted");
            this.visible = false;
            this.activateScripts();
        },

        decline() {
            const previous = this.readChoice();
            this.saveChoice("denied");
            this.visible = false;

            if (previous === "granted") {
                // Scripts already running can't be unloaded: reload without them
                location.reload();
            }
        },

        open() {
            this.visible = true;
        },

        activateScripts() {
            document.querySelectorAll('script[data-uk-consent="analytics"]').forEach((dormant) => {
                const script = document.createElement("script");

                for (const attr of dormant.attributes) {
                    if (!MARKER_ATTRIBUTES.includes(attr.name)) {
                        script.setAttribute(attr.name, attr.value);
                    }
                }

                const originalType = dormant.getAttribute("data-original-type");
                if (originalType) {
                    script.type = originalType;
                }

                script.text = dormant.text;
                dormant.replaceWith(script);
            });
        },
    },
};
</script>

<style lang="scss" scoped>
.analytics-consent-banner {
    position: fixed;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    width: min(560px, calc(100% - 2rem));
    z-index: 1050;
}
</style>
