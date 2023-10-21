<template>
    <div ref="modal" class="modal fade" tabindex="-1">
        <div class="modal-dialog modal-xl modal-dialog-centered">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        {{ $t("Browser Screenshot") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                </div>
                <div class="modal-body"></div>
                <img :src="imageURL" alt="screenshot of the website">
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Modal } from "bootstrap";

export default {
    props: {
        imageURL: {
            type: String,
            required: true,
        },
    },
    data() {
        return {
            modal: null,
        };
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {
        show() {
            this.modal.show();
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {
    .modal-dialog .form-text, .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
