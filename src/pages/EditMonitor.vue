<template>
    <h1 class="mb-3">{{ pageName }}</h1>
    <form @submit.prevent="submit">

    <div class="shadow-box">
        <div class="row">
            <div class="col-md-6">
                <h2>General</h2>

                    <div class="mb-3">
                        <label for="type" class="form-label">Monitor Type</label>
                        <select class="form-select" aria-label="Default select example" id="type" v-model="monitor.type">
                            <option value="http">HTTP(s)</option>
                            <option value="port">TCP Port</option>
                            <option value="ping">Ping</option>
                            <option value="keyword">HTTP(s) - Keyword</option>
                        </select>
                    </div>

                    <div class="mb-3">
                        <label for="name" class="form-label">Friendly Name</label>
                        <input type="text" class="form-control" id="name" v-model="monitor.name" required>
                    </div>

                    <div class="mb-3" v-if="monitor.type === 'http' || monitor.type === 'keyword' ">
                        <label for="url" class="form-label">URL</label>
                        <input type="url" class="form-control" id="url" v-model="monitor.url" pattern="https?://.+" required>
                    </div>

                    <div class="mb-3" v-if="monitor.type === 'keyword' ">
                        <label for="keyword" class="form-label">Keyword</label>
                        <input type="text" class="form-control" id="keyword" v-model="monitor.keyword" required>
                        <div class="form-text">Search keyword in plain html response and it is case-sensitive</div>
                    </div>

                    <div class="mb-3" v-if="monitor.type === 'port' || monitor.type === 'ping' ">
                        <label for="hostname" class="form-label">Hostname</label>
                        <input type="text" class="form-control" id="hostname" v-model="monitor.hostname" required>
                    </div>

                    <div class="mb-3" v-if="monitor.type === 'port' ">
                        <label for="port" class="form-label">Port</label>
                        <input type="number" class="form-control" id="port" v-model="monitor.port" required min="0" max="65535" step="1">
                    </div>

                    <div class="mb-3">
                        <label for="interval" class="form-label">Heartbeat Interval (Every {{ monitor.interval }} seconds)</label>
                        <input type="number" class="form-control" id="interval" v-model="monitor.interval" required min="20" step="1">
                    </div>

                    <div>
                        <button class="btn btn-primary" type="submit" :disabled="processing">Save</button>
                    </div>

            </div>

            <div class="col-md-6">

                <div class="mt-3" v-if="$root.isMobile"></div>

                <h2>Notifications</h2>
                <p v-if="$root.notificationList.length === 0">Not available, please setup.</p>

                <div class="form-check form-switch mb-3" v-for="notification in $root.notificationList">
                    <input class="form-check-input" type="checkbox" :id=" 'notification' + notification.id" v-model="monitor.notificationIDList[notification.id]">

                    <label class="form-check-label" :for=" 'notification' + notification.id">
                        {{ notification.name }}
                        <a href="#" @click="$refs.notificationDialog.show(notification.id)">Edit</a>
                    </label>
                </div>

                <button class="btn btn-primary me-2" @click="$refs.notificationDialog.show()" type="button">Setup Notification</button>
            </div>
        </div>
    </div>
    </form>

    <NotificationDialog ref="notificationDialog" />
</template>

<script>
import NotificationDialog from "../components/NotificationDialog.vue";
import { useToast } from 'vue-toastification'
const toast = useToast()

export default {
    components: {
        NotificationDialog
    },
    mounted() {
        this.init();
    },
    data() {
        return {
            processing: false,
            monitor: {
                notificationIDList: {},
            },
        }
    },
    computed: {
        pageName() {
            return (this.isAdd) ? "Add New Monitor" : "Edit"
        },
        isAdd() {
            return this.$route.path === "/add";
        },
        isEdit() {
            return this.$route.path.startsWith("/edit");
        }
    },
    methods: {
        init() {
            if (this.isAdd) {
                console.log("??????")
                this.monitor = {
                    type: "http",
                    name: "",
                    url: "https://",
                    interval: 60,
                    notificationIDList: {},
                }
            } else if (this.isEdit) {
                this.$root.getSocket().emit("getMonitor", this.$route.params.id, (res) => {
                    if (res.ok) {
                        this.monitor = res.monitor;
                    } else {
                        toast.error(res.msg)
                    }
                })
            }

        },

        submit() {
            this.processing = true;

            if (this.isAdd) {
                this.$root.add(this.monitor, (res) => {
                    this.processing = false;

                    if (res.ok) {
                        toast.success(res.msg);
                        this.$router.push("/dashboard/" + res.monitorID)
                    } else {
                        toast.error(res.msg);
                    }

                })
            } else {
                this.$root.getSocket().emit("editMonitor", this.monitor, (res) => {
                    this.processing = false;
                    this.$root.toastRes(res)
                })
            }
        }
    },
    watch: {
        '$route.fullPath' () {
            this.init();
        }
    },
}
</script>

<style scoped>
    .shadow-box {
        padding: 20px;
    }
</style>
