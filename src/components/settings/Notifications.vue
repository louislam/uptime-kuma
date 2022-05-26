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

        <div class="my-4">
            <h4>{{ $t("settingsCertificateExpiry") }}</h4>
            <p>{{ $t("certificationExpiryDescription") }}</p>
            <div class="mt-2 mb-4 ps-2 cert-exp-days col-12 col-xl-6">
                <div v-for="day in settings.tlsExpiryNotifyDays" :key="day" class="d-flex align-items-center justify-content-between cert-exp-day-row py-2">
                    <span>{{ day }} {{ $t("day(s)") }}</span>
                    <button type="button" class="btn-rm-expiry btn btn-outline-danger ms-2 py-1" @click="removeExpiryNotifDay(day)">
                        <font-awesome-icon class="" icon="times" />
                    </button>
                </div>
            </div>
            <div class="col-12 col-xl-6">
                <ActionInput v-model="expiryNotifInput" :type="'number'" :placeholder="$t('day(s)')" :icon="'plus'" :action="() => addExpiryNotifDay(expiryNotifInput)" />
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

    methods: {
        removeExpiryNotifDay(day) {
            this.settings.tlsExpiryNotifyDays = this.settings.tlsExpiryNotifyDays.filter(d => d !== day);
        },
        addExpiryNotifDay(day) {
            if (day != null && day !== "") {
                const parsedDay = parseInt(day);
                if (parsedDay != null && !isNaN(parsedDay) && parsedDay > 0) {
                    if (!this.settings.tlsExpiryNotifyDays.includes(parsedDay)) {
                        this.settings.tlsExpiryNotifyDays.push(parseInt(day));
                        this.expiryNotifInput = null;
                    }
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
