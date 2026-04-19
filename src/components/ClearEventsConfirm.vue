<template>
    <div ref="modalElement" class="modal fade" tabindex="-1" @click.self="close">
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            class="me-2 text-warning"
                        >
                            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                            <path d="M12 9v4" />
                            <path d="M12 17h.01" />
                        </svg>
                        {{ $t("Clear All Events") }}
                    </h5>
                    <button type="button" class="btn-close" :aria-label="$t('Close')" @click="close" />
                </div>
                <div class="modal-body">
                    <p class="text-body-secondary mb-3">
                        {{ $t("clearAllEventsMsgTimelineOnly") }}
                    </p>
                    <div class="form-check border rounded p-3">
                        <input
                            id="clearMsgCheckbox"
                            v-model="clearMsg"
                            type="checkbox"
                            class="form-check-input"
                        />
                        <label for="clearMsgCheckbox" class="form-check-label">
                            <span class="fw-medium">{{ $t("Also clear historical event data") }}</span>
                            <small class="d-block text-body-secondary">
                                {{ $t("clearAllEventsMsgDataWarning") }}
                            </small>
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @click="close">
                        {{ $t("Cancel") }}
                    </button>
                    <button
                        type="button"
                        class="btn"
                        :class="clearMsg ? 'btn-danger' : 'btn-primary'"
                        @click="confirm"
                    >
                        {{ $t("Confirm") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";

export default {
    data() {
        return {
            modal: null,
            clearMsg: false,
        };
    },
    emits: [ "yes" ],
    mounted() {
        this.modal = new Modal(this.$refs.modalElement);
        this.$refs.modalElement.addEventListener("hidden.bs.modal", () => {
            this.clearMsg = false;
        });
    },
    methods: {
        /**
         * Show the confirm dialog
         */
        show() {
            this.clearMsg = false;
            this.modal.show();
        },
        /**
         * Close the modal
         */
        close() {
            this.modal.hide();
        },
        /**
         * Confirm action - emit yes event with clearMsg value
         * @fires string "yes" Notify the parent with { clearMsg: boolean }
         */
        confirm() {
            this.$emit("yes", { clearMsg: this.clearMsg });
            this.modal.hide();
        },
    },
};
</script>

<style scoped>
.form-check {
    transition: background-color 200ms ease-out;
}

.form-check:hover {
    background-color: var(--bs-light-bg-subtle, #f8f9fa);
}

.form-check-input:checked {
    background-color: var(--bs-danger, #dc3545);
    border-color: var(--bs-danger, #dc3545);
}

.form-check-input:focus {
    box-shadow: 0 0 0 0.25rem rgba(220, 53, 69, 0.25);
}

.btn-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.btn-danger:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(220, 53, 69, 0.3);
}
</style>