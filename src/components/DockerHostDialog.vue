<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Setup Docker Host") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="docker-name" class="form-label">{{ $t("Friendly Name") }}</label>
                            <input id="docker-name" v-model="dockerHost.name" type="text" class="form-control" required>
                        </div>

                        <div class="mb-3">
                            <label for="docker-type" class="form-label">{{ $t("Connection Type") }}</label>
                            <select id="docker-type" v-model="dockerHost.dockerType" class="form-select">
                                <option v-for="type in connectionTypes" :key="type" :value="type">{{ $t(type) }}</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="docker-daemon" class="form-label">{{ $t("Docker Daemon") }}</label>
                            <input id="docker-daemon" v-model="dockerHost.dockerDaemon" type="text" class="form-control" required>

                            <div class="form-text">
                                {{ $t("Examples") }}:
                                <ul>
                                    <li>/var/run/docker.sock</li>
                                    <li>http://localhost:2375</li>
                                    <li>https://localhost:2376 (TLS)</li>
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
        {{ $t("deleteDockerHostMsg") }}
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
    emits: [ "added", "deleted" ],
    data() {
        return {
            modal: null,
            processing: false,
            id: null,
            connectionTypes: [ "socket", "tcp" ],
            dockerHost: {
                name: "",
                dockerDaemon: "",
                dockerType: "",
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
         * @param {number} dockerHostID ID of host to show
         * @returns {void}
         */
        show(dockerHostID) {
            if (dockerHostID) {
                let found = false;

                this.id = dockerHostID;

                for (let n of this.$root.dockerHostList) {
                    if (n.id === dockerHostID) {
                        this.dockerHost = n;
                        found = true;
                        break;
                    }
                }

                if (!found) {
                    this.$root.toastError("Docker Host not found!");
                }

            } else {
                this.id = null;
                this.dockerHost = {
                    name: "",
                    dockerType: "socket",
                    dockerDaemon: "/var/run/docker.sock",
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
            this.$root.getSocket().emit("addDockerHost", this.dockerHost, this.id, (res) => {
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
            this.$root.getSocket().emit("testDockerHost", this.dockerHost, (res) => {
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
            this.$root.getSocket().emit("deleteDockerHost", this.id, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.$emit("deleted", this.id);
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
