<template>
    <div>
        <div class="notification-list my-4">
            <p v-if="$root.notificationList.length === 0">
                {{ $t("Not available, please setup.") }}
            </p>
            <p v-else>
                {{ $t("notificationDescription") }}
            </p>

            <ul class="list-group mb-3" style="border-radius: 1rem;">
                <li v-for="(notification, index) in $root.notificationList" :key="index" class="list-group-item">
                    {{ notification.name }}<br>
                    <a href="#" @click="$refs.notificationDialog.show(notification.id)">{{ $t("Edit") }}</a>
                </li>
            </ul>

            <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                {{ $t("Setup Notification") }}
            </button>
        </div>

        <div class="my-4 pt-4">
            <h5 class="my-4 settings-subheading">{{ $t("monitorToastMessagesLabel") }}</h5>
            <p>{{ $t("monitorToastMessagesDescription") }}</p>

            <div class="my-4">
                <label for="toastErrorTimeoutSecs" class="form-label">
                    {{ $t("toastErrorTimeout") }}
                </label>
                <input
                    id="toastErrorTimeoutSecs"
                    v-model="toastErrorTimeoutSecs"
                    type="number"
                    class="form-control"
                    min="-1"
                    step="1"
                />
            </div>

            <div class="my-4">
                <label for="toastSuccessTimeoutSecs" class="form-label">
                    {{ $t("toastSuccessTimeout") }}
                </label>
                <input
                    id="toastSuccessTimeoutSecs"
                    v-model="toastSuccessTimeoutSecs"
                    type="number"
                    class="form-control"
                    min="-1"
                    step="1"
                />
            </div>
        </div>

        <div class="my-4 pt-4">
            <h5 class="my-4 settings-subheading">{{ $t("settingsCertificateExpiry") }}</h5>
            <p>{{ $t("certificationExpiryDescription") }}</p>
            <p>{{ $t("notificationDescription") }}</p>
            <div class="mt-1 mb-3 ps-2 cert-exp-days col-12 col-xl-6">
                <div v-for="day in settings.tlsExpiryNotifyDays" :key="day" class="d-flex align-items-center justify-content-between cert-exp-day-row py-2">
                    <span>{{ day }} {{ $tc("day", day) }}</span>
                    <button type="button" class="btn-rm-expiry btn btn-outline-danger ms-2 py-1" :aria-label="$t('Remove the expiry notification')" @click="removeExpiryNotifDay(day)">
                        <font-awesome-icon icon="times" />
                    </button>
                </div>
            </div>
            <div class="col-12 col-xl-6">
                <ActionInput v-model="expiryNotifInput" :type="'number'" :placeholder="$t('day')" :icon="'plus'" :action="() => addExpiryNotifDay(expiryNotifInput)" :action-aria-label="$t('Add a new expiry notification day')" />
            </div>
            <div>
                <button class="btn btn-primary" type="button" @click="saveSettings()">
                    {{ $t("Save") }}
                </button>
            </div>
        </div>

        <NotificationDialog ref="notificationDialog" />
    </div>
</template>

<script>
import NotificationDialog from "../../components/NotificationDialog.vue";
import ActionInput from "../ActionInput.vue";

export default {
    components: {
        NotificationDialog,
        ActionInput,
    },

    data() {
        return {
            toastSuccessTimeoutSecs: 20,
            toastErrorTimeoutSecs: -1,
            /**
             * Variable to store the input for new certificate expiry day.
             */
            expiryNotifInput: null,
        };
    },

    computed: {
        settings() {
            return this.$parent.$parent.$parent.settings;
        },
        saveSettings() {
            return this.$parent.$parent.$parent.saveSettings;
        },
        settingsLoaded() {
            return this.$parent.$parent.$parent.settingsLoaded;
        },
    },

    watch: {
        // Parse, store and apply new timeout settings.
        toastSuccessTimeoutSecs(newTimeout) {
            const parsedTimeout = parseInt(newTimeout);
            if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
                localStorage.toastSuccessTimeout = newTimeout > 0 ? newTimeout * 1000 : newTimeout;
            }
        },
        toastErrorTimeoutSecs(newTimeout) {
            const parsedTimeout = parseInt(newTimeout);
            if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
                localStorage.toastErrorTimeout = newTimeout > 0 ? newTimeout * 1000 : newTimeout;
            }
        }
    },

    mounted() {
        this.loadToastTimeoutSettings();
    },

    methods: {
        /**
         * Remove a day from expiry notification days.
         * @param {number} day The day to remove.
         * @returns {void}
         */
        removeExpiryNotifDay(day) {
            this.settings.tlsExpiryNotifyDays = this.settings.tlsExpiryNotifyDays.filter(d => d !== day);
        },
        /**
         * Add a new expiry notification day.
         * Will verify:
         * - day is not null or empty string.
         * - day is a number.
         * - day is > 0.
         * - The day is not already in the list.
         * @param {number} day The day number to add.
         * @returns {void}
         */
        addExpiryNotifDay(day) {
            if (day != null && day !== "") {
                const parsedDay = parseInt(day);
                if (parsedDay != null && !isNaN(parsedDay) && parsedDay > 0) {
                    if (!this.settings.tlsExpiryNotifyDays.includes(parsedDay)) {
                        this.settings.tlsExpiryNotifyDays.push(parseInt(day));
                        this.settings.tlsExpiryNotifyDays.sort((a, b) => a - b);
                        this.expiryNotifInput = null;
                    }
                }
            }
        },

        /**
         * Loads toast timeout settings from storage to component data.
         * @returns {void}
         */
        loadToastTimeoutSettings() {
            const successTimeout = localStorage.toastSuccessTimeout;
            if (successTimeout !== undefined) {
                const parsedTimeout = parseInt(successTimeout);
                if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
                    this.toastSuccessTimeoutSecs = parsedTimeout > 0 ? parsedTimeout / 1000 : parsedTimeout;
                }
            }

            const errorTimeout = localStorage.toastErrorTimeout;
            if (errorTimeout !== undefined) {
                const parsedTimeout = parseInt(errorTimeout);
                if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
                    this.toastErrorTimeoutSecs = parsedTimeout > 0 ? parsedTimeout / 1000 : parsedTimeout;
                }
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.btn-rm-expiry {
    padding-left: 11px;
    padding-right: 11px;
}

.dark {
    .list-group-item {
        background-color: $dark-bg2;
        color: $dark-font-color;
    }
}

.cert-exp-days .cert-exp-day-row {
    border-bottom: 1px solid rgba(0, 0, 0, 0.125);

    .dark & {
        border-bottom: 1px solid $dark-border-color;
    }
}

.cert-exp-days .cert-exp-day-row:last-child {
    border: none;
}
</style>
