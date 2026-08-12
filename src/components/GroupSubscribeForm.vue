<template>
    <div class="subscribe-line" data-testid="group-subscribe-form">
        <form class="d-flex flex-wrap justify-content-end align-items-center gap-2" @submit.prevent="submit">
            <font-awesome-icon icon="envelope" class="text-muted" />
            <span class="text-muted small">{{ $t("subscribeDescription") }}</span>
            <input
                v-model="email"
                type="email"
                class="form-control form-control-sm"
                style="max-width: 200px"
                :placeholder="$t('Email')"
                required
                data-testid="subscribe-email-input"
            />
            <button
                class="btn btn-outline-secondary btn-sm"
                type="submit"
                :disabled="submitting"
                data-testid="subscribe-submit-button"
            >
                {{ $t("Subscribe") }}
            </button>
        </form>
        <div v-if="message" class="form-text mt-1 text-end" data-testid="subscribe-message">
            {{ message }}
        </div>
    </div>
</template>

<script>
import axios from "axios";

export default {
    props: {
        /** Id of the group being subscribed to */
        groupId: {
            type: [String, Number],
            required: true,
        },
    },
    data() {
        return {
            email: "",
            submitting: false,
            message: "",
        };
    },
    methods: {
        /**
         * Submit the subscribe form
         * @returns {Promise<void>}
         */
        async submit() {
            this.submitting = true;

            try {
                await axios.post(`/api/status-page/group/${this.groupId}/subscribe`, {
                    email: this.email,
                });
            } catch (error) {
                // Fall through - the message shown below is intentionally the
                // same regardless of outcome, matching the backend's response.
            } finally {
                this.submitting = false;
                this.email = "";
                this.message = this.$t("subscribeConfirmationSent");
            }
        },
    },
};
</script>
