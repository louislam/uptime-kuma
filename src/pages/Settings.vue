<template>
    <h1 class="mb-3">
        Settings
    </h1>

    <div class="shadow-box">
        <div class="row">
            <div class="col-md-6">
                <h2>General</h2>
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

                    <div>
                        <button class="btn btn-primary" type="submit">
                            Save
                        </button>
                    </div>
                </form>

                <h2>Change Password</h2>
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

                <div>
                    <button class="btn btn-danger" @click="$root.logout">
                        Logout
                    </button>
                </div>
            </div>

            <div class="col-md-6">
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
</template>

<script>
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
        }
    },
    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        },
    },

    mounted() {

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
    },
}
</script>

<style scoped>
    .shadow-box {
        padding: 20px;
    }
</style>
