<template>
    <div class="modal fade" tabindex="-1" ref="modal">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="exampleModalLabel">Confirm</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <slot></slot>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn" :class="btnStyle" @click="yes" data-bs-dismiss="modal">Yes</button>
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">No</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from 'bootstrap'

export default {
    props: {
        btnStyle: {
            type: String,
            default: "btn-primary"
        }
    },
    data: () => ({
        modal: null
    }),
    mounted() {
        this.modal = new Modal(this.$refs.modal)
    },
    methods: {
        show() {
            this.modal.show()
        },
        yes() {
            this.$emit('yes');
        }
    }
}
</script>

<style scoped>

</style>
