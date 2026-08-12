<template>
    <div ref="GroupSubscribersModal" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">{{ $t("Subscribers") }} ({{ count }})</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                </div>
                <div class="modal-body">
                    <table class="table" data-testid="subscriber-table">
                        <thead>
                            <tr>
                                <th>{{ $t("Email") }}</th>
                                <th>{{ $t("Status") }}</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="s in subscribers" :key="s.id" data-testid="subscriber-row">
                                <td>{{ s.email }}</td>
                                <td>{{ s.confirmed ? $t("Confirmed") : $t("Pending") }}</td>
                                <td>
                                    <font-awesome-icon
                                        icon="times"
                                        class="action remove"
                                        role="button"
                                        data-testid="remove-subscriber-button"
                                        @click="remove(s)"
                                    />
                                </td>
                            </tr>
                            <tr v-if="subscribers.length === 0">
                                <td colspan="3" class="text-center text-muted">{{ $t("No Subscribers") }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-danger" data-bs-dismiss="modal">
                        {{ $t("Close") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from "bootstrap";

export default {
    data() {
        return {
            groupId: null,
            subscribers: [],
            count: 0,
            modal: null,
        };
    },
    mounted() {
        this.modal = new Modal(this.$refs.GroupSubscribersModal);
    },
    methods: {
        /**
         * Show the modal for a group's subscribers
         * @param {object} group Group to show subscribers for
         * @returns {void}
         */
        show(group) {
            this.groupId = group.id;
            this.load();
            this.modal.show();
        },

        /**
         * (Re)load the subscriber list from the server
         * @returns {void}
         */
        load() {
            this.$root.getSocket().emit("getGroupSubscribers", this.groupId, (res) => {
                if (res.ok) {
                    this.subscribers = res.subscribers;
                    this.count = res.count;
                }
            });
        },

        /**
         * Remove a subscriber
         * @param {object} subscriber Subscriber to remove
         * @returns {void}
         */
        remove(subscriber) {
            this.$root.getSocket().emit("removeGroupSubscriber", this.groupId, subscriber.id, (res) => {
                if (res.ok) {
                    this.load();
                }
            });
        },
    },
};
</script>
