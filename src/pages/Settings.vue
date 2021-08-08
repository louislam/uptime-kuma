<template>
    <h1 class="mb-3">
        Settings
    </h1>

    <div class="shadow-box">
        <div class="row">
            <div class="col-md-6">
                <h2 class="mb-2">General</h2>
                <form class="mb-3" @submit.prevent="saveGeneral">
                    <div class="mb-3">
                        <label for="timezone" class="form-label">Timezone</label>
                        <select id="timezone" v-model="$root.userTimezone" class="form-select">
                            <option value="auto">
                                Auto: {{ guessTimezone }}
                            </option>
                            <option v-for="(timezone, index) in timezoneList" :key="index" :value="timezone.value">
                                {{ timezone.name }}
                            </option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <div class="btn-group" role="group" aria-label="Basic checkbox toggle button group">
                            <input id="btncheck1" v-model="$root.userTheme" type="radio" class="btn-check" name="theme" autocomplete="off" value="light">
                            <label class="btn btn-outline-primary" for="btncheck1">Light</label>

                            <input id="btncheck2" v-model="$root.userTheme" type="radio" class="btn-check" name="theme" autocomplete="off" value="dark">
                            <label class="btn btn-outline-primary" for="btncheck2">Dark</label>

                            <input id="btncheck3" v-model="$root.userTheme" type="radio" class="btn-check" name="theme" autocomplete="off" value="auto">
                            <label class="btn btn-outline-primary" for="btncheck3">Auto</label>
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit">
                            Save
                        </button>
                    </div>
                </form>

                <template v-if="loaded">
                    <template v-if="! settings.disableAuth">
                        <h2 class="mt-5 mb-2">Change Password</h2>
                        <form class="mb-3" @submit.prevent="savePassword">
                            <div class="mb-3">
                                <label for="current-password" class="form-label">Current Password</label>
                                <input id="current-password" v-model="password.currentPassword" type="password" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label for="new-password" class="form-label">New Password</label>
                                <input id="new-password" v-model="password.newPassword" type="password" class="form-control" required>
                            </div>

                            <div class="mb-3">
                                <label for="repeat-new-password" class="form-label">Repeat New Password</label>
                                <input id="repeat-new-password" v-model="password.repeatNewPassword" type="password" class="form-control" :class="{ 'is-invalid' : invalidPassword }" required>
                                <div class="invalid-feedback">
                                    The repeat password does not match.
                                </div>
                            </div>

                            <div>
                                <button class="btn btn-primary" type="submit">
                                    Update Password
                                </button>
                            </div>
                        </form>
                    </template>

                    <h2 class="mt-5 mb-2">Advanced</h2>

                    <div class="mb-3">
                        <button v-if="settings.disableAuth" class="btn btn-outline-primary me-1" @click="enableAuth">Enable Auth</button>
                        <button v-if="! settings.disableAuth" class="btn btn-primary me-1" @click="confirmDisableAuth">Disable Auth</button>
                        <button v-if="! settings.disableAuth" class="btn btn-danger me-1" @click="$root.logout">Logout</button>
                    </div>
                </template>
            </div>

            <div class="notification-list col-md-6">
                <div v-if="$root.isMobile" class="mt-3" />

                <h2>Notifications</h2>
                <p v-if="$root.notificationList.length === 0">
                    Not available, please setup.
                </p>
                <p v-else>
                    Please assign a notification to monitor(s) to get it to work.
                </p>

                <ul class="list-group mb-3" style="border-radius: 1rem;">
                    <li v-for="(notification, index) in $root.notificationList" :key="index" class="list-group-item">
                        {{ notification.name }}<br>
                        <a href="#" @click="$refs.notificationDialog.show(notification.id)">Edit</a>
                    </li>
                </ul>

                <button class="btn btn-primary me-2" type="button" @click="$refs.notificationDialog.show()">
                    Setup Notification
                </button>
            </div>
        </div>
    </div>

    <NotificationDialog ref="notificationDialog" />

    <Confirm ref="confirmDisableAuth" btn-style="btn-danger" yes-text="I understand, please disable" no-text="Leave" @yes="disableAuth">
        <p>Are you sure want to <strong>disable auth</strong>?</p>
        <p>It is for <strong>someone who have 3rd-party auth</strong> in front of  Uptime Kuma such as Cloudflare Access.</p>
        <p>Please use it carefully.</p>
    </Confirm>
</template>

<script>
import Confirm from "../components/Confirm.vue";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc"
import timezone from "dayjs/plugin/timezone"
import NotificationDialog from "../components/NotificationDialog.vue";
dayjs.extend(utc)
dayjs.extend(timezone)

import { timezoneList } from "../util-frontend";
import { useToast } from "vue-toastification"
const toast = useToast()

export default {
    components: {
        NotificationDialog,
        Confirm,
    },
    data() {
        return {
            timezoneList: timezoneList(),
            guessTimezone: dayjs.tz.guess(),

            invalidPassword: false,
            password: {
                currentPassword: "",
                newPassword: "",
                repeatNewPassword: "",
            },
            settings: {

            },
            loaded: false,
        }
    },
    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
    },

    mounted() {
        this.loadSettings();
    },

    methods: {

        saveGeneral() {
            localStorage.timezone = this.$root.userTimezone;
            toast.success("Saved.")
        },

        savePassword() {
            if (this.password.newPassword !== this.password.repeatNewPassword) {
                this.invalidPassword = true;
            } else {
                this.$root.getSocket().emit("changePassword", this.password, (res) => {
                    this.$root.toastRes(res)
                    if (res.ok) {
                        this.password.currentPassword = ""
                        this.password.newPassword = ""
                        this.password.repeatNewPassword = ""
                    }
                })
            }
        },

        loadSettings() {
            this.$root.getSocket().emit("getSettings", (res) => {
                this.settings = res.data;
                this.loaded = true;
            })
        },

        saveSettings() {
            this.$root.getSocket().emit("setSettings", this.settings, (res) => {
                this.$root.toastRes(res);
                this.loadSettings();
            })
        },

        confirmDisableAuth() {
            this.$refs.confirmDisableAuth.show();
        },

        disableAuth() {
            this.settings.disableAuth = true;
            this.saveSettings();
        },

        enableAuth() {
            this.settings.disableAuth = false;
            this.saveSettings();
            this.$root.storage().removeItem("token");
        },

    },
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.shadow-box {
    padding: 20px;
}

.dark {
    .list-group-item {
        background-color: $dark-bg2;
        color: $dark-font-color;
    }
}
</style>
