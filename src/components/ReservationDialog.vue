<template>
    <Teleport to="body">
        <div ref="ReservationDialog" class="modal fade" tabindex="-1" data-bs-backdrop="static">
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            {{ $t("reserveMonitor") }}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                    </div>
                    <div class="modal-body">
                    <div v-if="monitor">
                        <p class="mb-3">{{ $t("reserveMonitorDescription", [monitor.name]) }}</p>
                        
                        <div class="mb-3">
                            <label for="reserved-by" class="form-label">{{ $t("yourName") }}</label>
                            <input 
                                id="reserved-by" 
                                v-model="reservedBy" 
                                type="text" 
                                class="form-control" 
                                :placeholder="$t('enterYourName')"
                                required
                            >
                        </div>
                        
                        <div class="mb-3">
                            <label for="reserved-until" class="form-label">{{ $t("reserveUntil") }}</label>
                            <input 
                                id="reserved-until" 
                                v-model="reservedUntil" 
                                type="datetime-local" 
                                class="form-control"
                                :min="minDateTime"
                                required
                            >
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        {{ $t("cancel") }}
                    </button>
                    <button type="button" class="btn btn-primary" @click="reserve" :disabled="!canReserve">
                        {{ $t("reserve") }}
                    </button>
                </div>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script>
import { Modal } from "bootstrap";
import dayjs from "dayjs";

export default {
    data() {
        return {
            modal: null,
            monitor: null,
            reservedBy: "",
            reservedUntil: "",
            minDateTime: "",
        };
    },
    computed: {
        /**
         * Check if reservation can be made
         * @returns {boolean} True if all required fields are filled
         */
        canReserve() {
            return this.reservedBy.trim() !== "" && this.reservedUntil !== "";
        }
    },
    mounted() {
        this.modal = new Modal(this.$refs.ReservationDialog);
        this.updateMinDateTime();
    },
    methods: {
        /**
         * Show the reservation dialog
         * @param {object} monitor Monitor to reserve
         * @returns {void}
         */
        show(monitor) {
            this.monitor = monitor;
            this.reservedBy = "";
            this.reservedUntil = "";
            this.updateMinDateTime();
            this.modal.show();
        },
        
        /**
         * Update minimum datetime to current time
         * @returns {void}
         */
        updateMinDateTime() {
            this.minDateTime = dayjs().format("YYYY-MM-DDTHH:mm");
        },
        
        /**
         * Reserve the monitor
         * @returns {void}
         */
        reserve() {
            if (!this.canReserve) {
                return;
            }
            
            this.$root.getSocket().emit("reserveMonitor", this.monitor.id, this.reservedBy, this.reservedUntil, (res) => {
                if (res.ok) {
                    this.$root.toastSuccess(this.$t("reservationSuccess"));
                    this.modal.hide();
                } else {
                    this.$root.toastError(res.msg);
                }
            });
        }
    }
};
</script>

<style scoped>
.modal-body p {
    color: #333;
}

.dark .modal-body p {
    color: #ccc;
}
</style>

<style>
/* Ensure modal and backdrop have proper z-index */
.modal-backdrop {
    z-index: 100000 !important;
}

.modal {
    z-index: 100001 !important;
}
</style>
