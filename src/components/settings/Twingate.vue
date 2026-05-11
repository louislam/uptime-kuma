<template>
    <div>
        <div class="my-4">
            <h3>{{ $t("twingateSettingsTitle") }}</h3>
            <p class="form-text">
                {{ $t("twingateSettingsDescription") }}
            </p>
        </div>

        <div class="my-3">
            <div class="mb-2">
                <strong>{{ $t("Status") }}: </strong>
                <span>{{ statusText }}</span>
            </div>
            <div v-if="status.lastError" class="alert alert-warning">
                {{ status.lastError }}
            </div>
        </div>

        <button class="btn btn-primary" type="button" :disabled="loading" @click="loadStatus">
            {{ $t("refreshTwingateStatus") }}
        </button>
    </div>
</template>

<script>
export default {
    data() {
        return {
            loading: false,
            status: {
                configured: false,
                starting: false,
                running: false,
                lastError: null,
            },
        };
    },

    computed: {
        statusText() {
            if (this.loading) {
                return this.$t("Loading...");
            }
            if (!this.status.configured) {
                return this.$t("twingateNotConfigured");
            }
            if (this.status.starting) {
                return this.$t("twingateStarting");
            }
            if (this.status.running) {
                return this.$t("Running");
            }
            return this.$t("twingateConfiguredStopped");
        },
    },

    mounted() {
        this.loadStatus();
    },

    methods: {
        async loadStatus() {
            this.loading = true;
            try {
                const response = await fetch("/api/twingate/status");
                if (!response.ok) {
                    throw new Error(await response.text());
                }
                this.status = await response.json();
            } catch (error) {
                this.status = {
                    configured: false,
                    starting: false,
                    running: false,
                    lastError: error.message,
                };
            } finally {
                this.loading = false;
            }
        },
    },
};
</script>
