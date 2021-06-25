<template>
    <h1>{{ monitor.name }}</h1>
    <h2>{{ monitor.url }}</h2>

    <div class="functions">
        <button class="btn btn-light" @click="pauseDialog" v-if="monitor.active">Pause</button>
        <button class="btn btn-primary" @click="resumeMonitor"  v-if="! monitor.active">Resume</button>
        <router-link :to=" '/edit/' + monitor.id " class="btn btn-light">Edit</router-link>
        <button class="btn btn-danger" @click="deleteDialog">Delete</button>
    </div>

    <div class="shadow-box">

        <div class="hp-bar-big">
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
            <div></div>
        </div>

        <div class="row">
            <div class="col-md-8">

            </div>
            <div class="col-md-4">

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

export default {
    components: {
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
            let id = parseInt(this.$route.params.id)

            for (let monitor of this.$root.monitorList) {
                if (monitor.id === id) {
                    return monitor;
                }
            }
            return {};
        },
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

h2 {
    color: $primary;
    margin-bottom: 20px;
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
</style>
