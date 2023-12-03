<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Add a Remote Browser") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="remote-browser-name" class="form-label">{{ $t("Friendly Name") }}</label>
                            <input id="remote-browser-name" v-model="remoteBrowser.name" type="text" class="form-control" required>
                        </div>

                        <div class="mb-3">
                            <label for="remote-browser-url" class="form-label">{{ $t("URL") }}</label>
                            <input id="remote-browser-url" v-model="remoteBrowser.url" type="text" class="form-control" required>

                            <div class="form-text mt-3">
                                {{ $t("Examples") }}:
                                <ul>
                                    <li>ws://chrome.browserless.io/playwright?token=YOUR-API-TOKEN</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button v-if="id" type="button" class="btn btn-danger" :disabled="processing" @click="deleteConfirm">
                            {{ $t("Delete") }}
                        </button>
                        <button type="button" class="btn btn-warning" :disabled="processing" @click="test">
                            {{ $t("Test") }}
                        </button>
                        <button type="submit" class="btn btn-primary" :disabled="processing">
                            <div v-if="processing" class="spinner-border spinner-border-sm me-1"></div>
                            {{ $t("Save") }}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteDockerHost">
        {{ $t("deleteRemoteBrowserMessage") }}
    </Confirm>
</template>

<script>
import { Modal } from "bootstrap";
import Confirm from "./Confirm.vue";

export default {
    components: {
        Confirm,
    },
    props: {},
    emits: [ "added" ],
    data() {
        return {
            modal: null,
            processing: false,
            id: null,
            remoteBrowser: {
                name: "",
                url: "",
                // Do not set default value here, please scroll to show()
            }
        };
    },

    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {

        /**
         * Confirm deletion of docker host
         * @returns {void}
         */
        deleteConfirm() {
            this.modal.hide();
            this.$refs.confirmDelete.show();
        },

        /**
         * Show specified docker host
         * @param {number} remoteBrowserID ID of host to show
         * @returns {void}
         */
        show(remoteBrowserID) {
            if (remoteBrowserID) {
                let found = false;

                this.id = remoteBrowserID;

                for (let n of this.$root.remoteBrowserList) {
                    if (n.id === remoteBrowserID) {
                        this.remoteBrowser = n;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    this.$root.toastError(this.$t("Remote Browser not found!"));
                }

            } else {
                this.id = null;
                this.remoteBrowser = {
                    name: "",
                    url: "",
                };
            }

            this.modal.show();
        },

        /**
         * Add docker host
         * @returns {void}
         */
        submit() {
            this.processing = true;
            this.$root.getSocket().emit("addRemoteBrowser", this.remoteBrowser, this.id, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.modal.hide();

                    // Emit added event, doesn't emit edit.
                    if (! this.id) {
                        this.$emit("added", res.id);
                    }

                }
            });
        },

        /**
         * Test the docker host
         * @returns {void}
         */
        test() {
            this.processing = true;
            this.$root.getSocket().emit("testRemoteBrowser", this.remoteBrowser, (res) => {
                this.$root.toastRes(res);
                this.processing = false;
            });
        },

        /**
         * Delete this docker host
         * @returns {void}
         */
        deleteDockerHost() {
            this.processing = true;
            this.$root.getSocket().emit("deleteRemoteBrowser", this.id, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.modal.hide();
                }
            });
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
