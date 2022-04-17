<template>
    <form @submit.prevent="submit">
        <div ref="modal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 id="exampleModalLabel" class="modal-title">
                            {{ $t("Setup Notification") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label for="notification-type" class="form-label">{{ $t("Notification Type") }}</label>
                            <select id="notification-type" v-model="notification.type" class="form-select">
                                <option v-for="type in notificationTypes" :key="type" :value="type">{{ $t(type) }}</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="notification-name" class="form-label">{{ $t("Friendly Name") }}</label>
                            <input id="notification-name" v-model="notification.name" type="text" class="form-control" required>
                        </div>

                        <!-- form body -->
                        <component :is="currentForm" />

                        <div class="mb-3 mt-4">
                            <hr class="dropdown-divider mb-4">

                            <div class="form-check form-switch">
                                <input v-model="notification.isDefault" class="form-check-input" type="checkbox">
                                <label class="form-check-label">{{ $t("Default enabled") }}</label>
                            </div>
                            <div class="form-text">
                                {{ $t("enableDefaultNotificationDescription") }}
                            </div>

                            <br>

                            <div class="form-check form-switch">
                                <input v-model="notification.applyExisting" class="form-check-input" type="checkbox">
                                <label class="form-check-label">{{ $t("Apply on all existing monitors") }}</label>
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

    <Confirm ref="confirmDelete" btn-style="btn-danger" :yes-text="$t('Yes')" :no-text="$t('No')" @yes="deleteNotification">
        {{ $t("deleteNotificationMsg") }}
    </Confirm>
</template>

<script lang="ts">
import { Modal } from "bootstrap";

import Confirm from "./Confirm.vue";
import NotificationFormList from "./notifications";

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
            notificationTypes: Object.keys(NotificationFormList).sort((a, b) => {
                return a.toLowerCase().localeCompare(b.toLowerCase());
            }),
            notification: {
                name: "",
                /** @type { null | keyof NotificationFormList } */
                type: null,
                isDefault: false,
                // Do not set default value here, please scroll to show()
            }
        };
    },

    computed: {
        currentForm() {
            if (!this.notification.type) {
                return null;
            }
            return NotificationFormList[this.notification.type];
        }
    },

    watch: {
        "notification.type"(to, from) {
            let oldName;
            if (from) {
                oldName = this.getUniqueDefaultName(from);
            } else {
                oldName = "";
            }

            if (! this.notification.name || this.notification.name === oldName) {
                this.notification.name = this.getUniqueDefaultName(to);
            }
        },
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal);
    },
    methods: {

        deleteConfirm() {
            this.modal.hide();
            this.$refs.confirmDelete.show();
        },

        show(notificationID) {
            if (notificationID) {
                this.id = notificationID;

                for (let n of this.$root.notificationList) {
                    if (n.id === notificationID) {
                        this.notification = JSON.parse(n.config);
                        break;
                    }
                }
            } else {
                this.id = null;
                this.notification = {
                    name: "",
                    type: "telegram",
                    isDefault: false,
                };
            }

            this.modal.show();
        },

        submit() {
            this.processing = true;
            this.$root.getSocket().emit("addNotification", this.notification, this.id, (res) => {
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

        test() {
            this.processing = true;
            this.$root.getSocket().emit("testNotification", this.notification, (res) => {
                this.$root.toastRes(res);
                this.processing = false;
            });
        },

        deleteNotification() {
            this.processing = true;
            this.$root.getSocket().emit("deleteNotification", this.id, (res) => {
                this.$root.toastRes(res);
                this.processing = false;

                if (res.ok) {
                    this.modal.hide();
                }
            });
        },
        /**
         * @param {keyof NotificationFormList} notificationKey
         * @return {string}
         */
        getUniqueDefaultName(notificationKey) {
            let index = 1;
            let name = "";
            do {
                name = this.$t("defaultNotificationName", {
                    notification: this.$t(notificationKey).replace(/\(.+\)/, "").trim(),
                    number: index++
                });
            } while (this.$root.notificationList.find(it => it.name === name));
            return name;
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
