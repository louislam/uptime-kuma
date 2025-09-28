<template>
    <div ref="modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 id="exampleModalLabel" class="modal-title">
                        {{ title || $t("Confirm") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <slot />
                    <div class="form-check mt-3">
                        <input
                            id="doNotShowAgain"
                            v-model="doNotShowAgain"
                            class="form-check-input"
                            type="checkbox"
                        />
                        <label class="form-check-label" for="doNotShowAgain">
                            {{ $t("Do not show this again") }}
                        </label>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" :class="btnStyle" data-bs-dismiss="modal" @click="yes">
                        {{ yesText }}
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" @click="no">
                        {{ noText }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";

export default {
    props: {
        /** Style of button */
        btnStyle: {
            type: String,
            default: "btn-primary",
        },
        /** Text to use as yes */
        yesText: {
            type: String,
            default: "Yes",
        },
        /** Text to use as no */
        noText: {
            type: String,
            default: "No",
        },
        /** Title to show on modal. Defaults to translated version of "Confirm" */
        title: {
            type: String,
            default: null,
        }
    },
    emits: [ "yes", "no" ],
    data() {
        return {
            modal: null,
            doNotShowAgain: false,
        };
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {
        /**
         * Show the confirm dialog
         * @returns {void}
         */
        show() {
            this.doNotShowAgain = false;
            this.modal.show();
        },
        /**
         * @fires string "yes" Notify the parent when Yes is pressed
         * @returns {void}
         */
        yes() {
            if (this.doNotShowAgain) {
                localStorage.setItem("uptime-kuma-pause-confirm-disabled", "true");
            }
            this.$emit("yes");
        },
        /**
         * @fires string "no" Notify the parent when No is pressed
         * @returns {void}
         */
        no() {
            this.$emit("no");
        }
    },
};
</script>