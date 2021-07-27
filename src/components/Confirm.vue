<template>
    <div ref="modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 id="exampleModalLabel" class="modal-title">
                        Confirm
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body">
                    <slot />
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" :class="btnStyle" data-bs-dismiss="modal" @click="yes">
                        Yes
                    </button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        No
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap"

export default {
    props: {
        btnStyle: {
            type: String,
            default: "btn-primary",
        },
    },
    data: () => ({
        modal: null,
    }),
    mounted() {
        this.modal = new Modal(this.$refs.modal)
    },
    methods: {
        show() {
            this.modal.show()
        },
        yes() {
            this.$emit("yes");
        },
    },
}
</script>

<style scoped>

</style>
