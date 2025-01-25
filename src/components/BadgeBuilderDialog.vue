<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Generate Badge") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="badge-builder-badge-style" class="form-label">{{ $t("Badge Style") }}</label>
                            <select id="badge-builder-badge-style" v-model="config.badgeStyle" class="form-select">
                                <option value="flat">Flat</option>
                                <option value="flat-square">Flat Square</option>
                                <option value="for-the-badge">For The Badge</option>
                                <option value="plastic">Plastic</option>
                                <option value="social">Social</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="badge-not-found-text" class="form-label">{{ $t("Return to not found") }}</label>
                            <input
                                id="badge-not-found-text" v-model="config.notFoundText" type="text"
                                class="form-control"
                            >
                        </div>

                        <div class="mb-3">
                            <label for="badge-operational-text" class="form-label">{{ $t("Return to operational")
                            }}</label>
                            <input
                                id="badge-operational-text" v-model="config.allOperationalText" type="text"
                                class="form-control"
                            >
                        </div>

                        <div class="mb-3">
                            <label for="badge-partial-down-text" class="form-label">{{ $t("Return to partial down")
                            }}</label>
                            <input
                                id="badge-partial-down-text" v-model="config.partialDownText" type="text"
                                class="form-control"
                            >
                        </div>

                        <div class="mb-3">
                            <label for="badge-maintenance-text" class="form-label">{{ $t("Return to maintenance")
                            }}</label>
                            <input
                                id="badge-maintenance-text" v-model="config.maintenanceText" type="text"
                                class="form-control"
                            >
                        </div>

                        <div class="mb-3">
                            <label for="badge-unknown-text" class="form-label">{{ $t("Return to unknown")
                            }}</label>
                            <input
                                id="badge-unknown-text" v-model="config.unknownText" type="text"
                                class="form-control"
                            >
                        </div>

                        <div v-if="slug" class="Preview">
                            <div>{{ $t("Preview") }}</div>
                            <img :src="getSvgURL(true)" class="mt-2" />
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" @click="copyImageURL()">
                            <!-- <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div> -->
                            {{ $t("Copy Image URL") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>
</template>

<script>
import { Modal } from "bootstrap";
import { useToast } from "vue-toastification";
import axios from "axios";
const toast = useToast();

export default {
    components: {},
    props: {},
    emits: [],
    data() {
        return {
            model: null,
            slug: null,
            config: {
                badgeStyle: "flat",
                notFoundText: this.$t("not found"),
                allDownText: this.$t("all down"),
                allOperationalText: this.$t("operational"),
                partialDownText: this.$t("partial down"),
                maintenanceText: this.$t("maintenance"),
                unknownText: this.$t("unknown")
            }
        };
    },

    computed: {
    },

    watch: {
    },

    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {
        show(slug) {
            this.slug = slug;
            this.modal.show();
        },

        getSvgURL(disableCache = false) {
            return axios.defaults.baseURL + "/status/" + this.slug + ".svg?config=" + encodeURIComponent(JSON.stringify(this.config)).replace(/%5B/g, "[").replace(/%5D/g, "]") + (disableCache ? "&noCache=" + Date.now() : "");
        },

        copyImageURL() {
            const text = this.getSvgURL();
            navigator.clipboard.writeText(text).then(() => {
                toast.success(this.$t("Image url copied to clipboard."));
            }).catch(err => {
                toast.error(this.$t("Unable to copy image URL."));
            });
        }
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {

    .modal-dialog .form-text,
    .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
