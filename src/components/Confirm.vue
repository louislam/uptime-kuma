<template>
    <div ref="modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 id="exampleModalLabel" class="modal-title">
                        {{ $t("Confirm") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <slot />
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" :class="btnStyle" data-bs-dismiss="modal" @click="yes">
                        {{ yesText }}
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
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
        btnStyle: {
            type: String,
            default: "btn-primary",
        },
        yesText: {
            type: String,
            default: "Yes",     // TODO: No idea what to translate this
        },
        noText: {
            type: String,
            default: "No",
        },
    },
    emits: [ "yes" ],
    data: () => ({
        modal: null,
    }),
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {
        show() {
            this.modal.show();
        },
        yes() {
            this.$emit("yes");
        },
    },
};
</script>
