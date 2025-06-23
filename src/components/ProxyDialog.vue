<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Setup Proxy") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="proxy-protocol" class="form-label">{{ $t("Proxy Protocol") }}</label>
                            <select id="proxy-protocol" v-model="proxy.protocol" class="form-select">
                                <option value="https">HTTPS</option>
                                <option value="http">HTTP</option>
                                <option value="socks">SOCKS</option>
                                <option value="socks5">SOCKS v5</option>
                                <option value="socks5h">SOCKS v5 (+DNS)</option>
                                <option value="socks4">SOCKS v4</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="proxy-host" class="form-label">{{ $t("Proxy Server") }}</label>
                            <div class="d-flex">
                                <input id="proxy-host" v-model="proxy.host" type="text" class="form-control" required :placeholder="$t('Server Address')">
                                <input v-model="proxy.port" type="number" class="form-control ms-2" style="width: 100px;" required min="1" max="65535" :placeholder="$t('Port')">
                            </div>
                        </div>

                        <div class="mb-3">
                            <div class="form-check form-switch">
                                <input id="mark-auth" v-model="proxy.auth" class="form-check-input" type="checkbox">
                                <label for="mark-auth" class="form-check-label">{{ $t("Proxy server has authentication") }}</label>
                            </div>
                        </div>

                        <div v-if="proxy.auth" class="mb-3">
                            <label for="proxy-username" class="form-label">{{ $t("User") }}</label>
                            <input id="proxy-username" v-model="proxy.username" type="text" class="form-control" required>
                        </div>

                        <div v-if="proxy.auth" class="mb-3">
                            <label for="proxy-password" class="form-label">{{ $t("Password") }}</label>
                            <input id="proxy-password" v-model="proxy.password" type="password" class="form-control" required>
                        </div>

                        <div class="mb-3 mt-4">
                            <hr class="dropdown-divider mb-4">

                            <div class="form-check form-switch">
                                <input id="mark-active" v-model="proxy.active" class="form-check-input" type="checkbox">
                                <label for="mark-active" class="form-check-label">{{ $t("enabled") }}</label>
                            </div>
                            <div class="form-text">
                                {{ $t("enableProxyDescription") }}
                            </div>

                            <br />

                            <div class="form-check form-switch">
                                <input id="mark-default" v-model="proxy.default" class="form-check-input" type="checkbox">
                                <label for="mark-default" class="form-check-label">{{ $t("setAsDefault") }}</label>
                            </div>
                            <div class="form-text">
                                {{ $t("setAsDefaultProxyDescription") }}
                            </div>

                            <br />

                            <div class="form-check form-switch">
                                <input id="apply-existing" v-model="proxy.applyExisting" class="form-check-input" type="checkbox">
                                <label class="form-check-label" for="apply-existing">{{ $t("Apply on all existing monitors") }}</label>
                            </div>
                        </div>
                    </div>

                    <div class="modal-footer">
                        <button v-if="id" type="button" class="btn btn-danger" :disabled="processing" @click="deleteConfirm">
                            {{ $t("Delete") }}
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

    <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteProxy">
        {{ $t("deleteProxyMsg") }}
    </Confirm>
</template>

<script lang="ts">
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
            model: null,
            processing: false,
            id: null,
            proxy: {
                protocol: null,
                host: null,
                port: null,
                auth: false,
                username: null,
                password: null,
                active: false,
                default: false,
                applyExisting: false,
            }
        };
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    beforeUnmount() {
        this.cleanupModal();
    },
    methods: {
        /**
         * Show dialog to confirm deletion
         * @returns {void}
         */
        deleteConfirm() {
            this.modal.hide();
            this.$refs.confirmDelete.show();
        },

        /**
         * Show settings for specified proxy
         * @param {number} proxyID ID of proxy to show
         * @returns {void}
         */
        show(proxyID) {
            if (proxyID) {
                this.id = proxyID;

                for (let proxy of this.$root.proxyList) {
                    if (proxy.id === proxyID) {
                        this.proxy = proxy;
                        break;
                    }
                }
            } else {
                this.id = null;
                this.proxy = {
                    protocol: "https",
                    host: null,
                    port: null,
                    auth: false,
                    username: null,
                    password: null,
                    active: true,
                    default: false,
                    applyExisting: false,
                };
            }

            this.modal.show();
        },

        /**
         * Show dialog to clone a proxy
         * @param {number} proxyID ID of proxy to clone
         * @returns {void}
         */
        showClone(proxyID) {
            if (proxyID) {
                for (let proxy of this.$root.proxyList) {
                    if (proxy.id === proxyID) {
                        // Create a clone of the proxy data
                        this.proxy = {
                            protocol: proxy.protocol,
                            host: proxy.host,
                            port: proxy.port,
                            auth: proxy.auth,
                            username: proxy.username,
                            password: proxy.password,
                            active: proxy.active,
                            default: false, // Cloned proxy should not be default
                            applyExisting: false,
                        };
                        break;
                    }
                }
            }

            // Set id to null to indicate this is a new proxy (clone)
            this.id = null;

            this.modal.show();
        },

        /**
         * Submit form data for saving
         * @returns {void}
         */
        submit() {
            this.processing = true;
            this.$root.getSocket().emit("addProxy", this.proxy, this.id, (res) => {
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
         * Delete this proxy
         * @returns {void}
         */
        deleteProxy() {
            this.processing = true;
            this.$root.getSocket().emit("deleteProxy", this.id, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.modal.hide();
                }
            });
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

<style lang="scss" scoped>
@import "../assets/vars.scss";

.dark {
    .modal-dialog .form-text, .modal-dialog p {
        color: $dark-font-color;
    }
}
</style>
