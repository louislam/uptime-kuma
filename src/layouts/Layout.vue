<template>

    <div class="lost-connection" v-if="! $root.socket.connected && ! $root.socket.firstConnect">
        <div class="container-fluid">
            Lost connection to the socket server. Reconnecting...
        </div>
    </div>

    <header class="d-flex flex-wrap justify-content-center py-3 mb-3 border-bottom">

        <router-link to="/dashboard" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
            <object class="bi me-2 ms-4" width="40" data="/icon.svg"></object>
            <span class="fs-4 title">Uptime Kuma</span>
        </router-link>

        <ul class="nav nav-pills">
            <li class="nav-item"><router-link to="/dashboard" class="nav-link">📊 Dashboard</router-link></li>
            <li class="nav-item"><router-link to="/settings" class="nav-link">⚙ Settings</router-link></li>
        </ul>

    </header>

    <main>
        <!-- Add :key to disable vue router re-use the same component -->
        <router-view v-if="$root.loggedIn" :key="$route.fullPath" />
        <Login v-if="! $root.loggedIn && $root.allowLoginDialog" />
    </main>

</template>

<script>
import Login from "../components/Login.vue";

export default {
    components: {
        Login
    },
    mounted() {
        this.init();
    },
    watch: {
        $route (to, from) {
            this.init();
        }
    },
    methods: {
        init() {
            if (this.$route.name === "root") {
                this.$router.push("/dashboard")
            }
        }
    }
}
</script>

<style scoped>
    .title {
        font-weight: bold;
    }

    .nav {
        margin-right: 25px;
    }

    .lost-connection {
        padding: 5px;
        background-color: crimson;
        color: white;
    }

    main {
        margin-bottom: 30px;
    }
</style>
