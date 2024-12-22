<template>
    <div ref="modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        {{ $t("New Group") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <form @submit.prevent="confirm">
                        <div>
                            <label for="draftGroupName" class="form-label">{{ $t("Group Name") }}</label>
                            <input id="draftGroupName" v-model="groupName" type="text" class="form-control">
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        {{ $t("Cancel") }}
                    </button>
                    <button type="button" class="btn btn-primary" data-bs-dismiss="modal" :disabled="groupName == '' || groupName == null" @click="confirm">
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
    props: {},
    emits: [ "added" ],
    data: () => ({
        modal: null,
        groupName: null,
    }),
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    beforeUnmount() {
        this.cleanupModal();
    },
    methods: {
        /**
         * Show the confirm dialog
         * @returns {void}
         */
        show() {
            this.modal.show();
        },
        /**
         * Dialog confirmed
         * @returns {void}
         */
        confirm() {
            this.$emit("added", this.groupName);
            this.modal.hide();
        },
        /**
         * Clean up modal and restore scroll behavior
         * @returns {void}
         */
        cleanupModal() {
            if (this.modal) {
                try {
                    this.modal.hide();
                } catch (e) {
                    console.warn("Modal hide failed:", e);
                }
            }
        }
    },
};
</script>
