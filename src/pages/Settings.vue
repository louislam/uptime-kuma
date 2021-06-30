<template>
    <h1 class="mb-3">Settings</h1>

    <div class="shadow-box">
        <div class="row">

            <div class="col-md-6">
                <h2>General</h2>
                <form class="mb-3">
                    <div class="mb-3">
                        <label for="timezone" class="form-label">Timezone</label>
                        <select class="form-select" aria-label="Default select example" id="timezone">
                            <option name="auto">Auto: {{ guessTimezone }}</option>
                            <option v-for="timezone in timezoneList" :value="timezone.value">{{ timezone.name }}</option>
                        </select>
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit">Save</button>
                    </div>
                </form>

                <h2>Change Password</h2>
                <form class="mb-3" @submit.prevent="savePassword">
                    <div class="mb-3">
                        <label for="current-password" class="form-label">Current Password</label>
                        <input type="password" class="form-control" id="current-password" required v-model="password.currentPassword">
                    </div>

                    <div class="mb-3">
                        <label for="new-password" class="form-label">New Password</label>
                        <input type="password" class="form-control" id="new-password" required v-model="password.newPassword">
                    </div>

                    <div class="mb-3">
                        <label for="repeat-new-password" class="form-label">Repeat New Password</label>
                        <input type="password" class="form-control" :class="{ 'is-invalid' : invalidPassword }" id="repeat-new-password" required v-model="password.repeatNewPassword">
                        <div class="invalid-feedback">
                            The repeat password is not match.
                        </div>
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit">Update Password</button>
                    </div>
                </form>

                <div>
                    <button class="btn btn-danger" @click="$root.logout">Logout</button>
                </div>
            </div>

            <div class="col-md-6">
                <h2>Notifications</h2>
                <p>Empty</p>
                <button class="btn btn-primary" type="submit">Add Notification</button>
            </div>

        </div>
    </div>


</template>

<script>
import dayjs from "dayjs";
import utc  from 'dayjs/plugin/utc'
import timezone  from 'dayjs/plugin/timezone'
dayjs.extend(utc)
dayjs.extend(timezone)
import {timezoneList} from "../../server/util";

export default {
    components: {

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
            }
        }
    },
    methods: {
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
    watch: {
        "password.repeatNewPassword"() {
            this.invalidPassword = false;
        }
    }
}
</script>

<style scoped>
    .shadow-box {
        padding: 20px;
    }
</style>
