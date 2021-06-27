<template>
    <h1> {{ monitor.name }}</h1>
    <p class="url"><a :href="monitor.url" target="_blank" v-if="monitor.type === 'http'">{{ monitor.url }}</a></p>

    <div class="functions">
        <button class="btn btn-light" @click="pauseDialog" v-if="monitor.active">Pause</button>
        <button class="btn btn-primary" @click="resumeMonitor"  v-if="! monitor.active">Resume</button>
        <router-link :to=" '/edit/' + monitor.id " class="btn btn-light">Edit</router-link>
        <button class="btn btn-danger" @click="deleteDialog">Delete</button>
    </div>

    <div class="shadow-box">



        <div class="row">
            <div class="col-md-8">
                <HeartbeatBar :monitor-id="monitor.id" />
                <span class="word">Check every {{ monitor.interval }} seconds.</span>
            </div>
            <div class="col-md-4 text-center">
                <span class="badge rounded-pill" :class=" 'bg-' + status.color " style="font-size: 30px">{{ status.text }}</span>
            </div>
        </div>
    </div>

    <Confirm ref="confirmPause" @yes="pauseMonitor">
        Are you sure want to pause?
    </Confirm>

    <Confirm ref="confirmDelete" btnStyle="btn-danger" @yes="deleteMonitor">
        Are you sure want to delete this monitor?
    </Confirm>
</template>

<script>
import { useToast } from 'vue-toastification'
const toast = useToast()
import Confirm from "../components/Confirm.vue";
import HeartbeatBar from "../components/HeartbeatBar.vue";

export default {
    components: {
        HeartbeatBar,
        Confirm
    },
    mounted() {

    },
    data() {
        return {

        }
    },
    computed: {
        monitor() {
            let id = this.$route.params.id
            return this.$root.monitorList[id];
        },

        lastHeartBeat() {
            if (this.monitor.id in this.$root.lastHeartbeatList && this.$root.lastHeartbeatList[this.monitor.id]) {
                return this.$root.lastHeartbeatList[this.monitor.id]
            } else {
                return { status: -1 }
            }
        },

        status() {
            if (this.$root.statusList[this.monitor.id]) {
                return this.$root.statusList[this.monitor.id]
            } else {
                return {

                }
            }
        }

    },
    methods: {
        pauseDialog() {
            this.$refs.confirmPause.show();
        },
        resumeMonitor() {
            this.$root.getSocket().emit("resumeMonitor", this.monitor.id, (res) => {
                this.$root.toastRes(res)
            })
        },
        pauseMonitor() {
            this.$root.getSocket().emit("pauseMonitor", this.monitor.id, (res) => {
                this.$root.toastRes(res)
            })
        },
        deleteDialog() {
            this.$refs.confirmDelete.show();
        },
        deleteMonitor() {
            this.$root.deleteMonitor(this.monitor.id, (res) => {
                if (res.ok) {
                    toast.success(res.msg);
                    this.$router.push("/dashboard")
                } else {
                    toast.error(res.msg);
                }
            })
        }
    }
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.url {
    color: $primary;
    margin-bottom: 20px;
    font-weight: bold;

    a {
        color: $primary;
    }
}

.functions {
    button, a {
        margin-right: 20px;
    }
}

.shadow-box {
    padding: 20px;
    margin-top: 25px;
}

.word {
    color: #AAA;
    font-size: 14px;
}
</style>
