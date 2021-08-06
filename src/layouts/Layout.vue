<template>
    <div :class="$root.theme">
        <div v-if="! $root.socket.connected && ! $root.socket.firstConnect" class="lost-connection">
            <div class="container-fluid">
                {{ $root.connectionErrorMsg }}
            </div>
        </div>

        <!-- Desktop header -->
        <header v-if="! $root.isMobile" class="d-flex flex-wrap justify-content-center py-3 mb-3 border-bottom">
            <router-link to="/dashboard" class="d-flex align-items-center mb-3 mb-md-0 me-md-auto text-dark text-decoration-none">
                <object class="bi me-2 ms-4" width="40" height="40" data="/icon.svg" alt="Logo" />
                <span class="fs-4 title">Uptime Kuma</span>
            </router-link>

            <ul class="nav nav-pills">
                <li class="nav-item">
                    <router-link to="/dashboard" class="nav-link">
                        <font-awesome-icon icon="tachometer-alt" /> Dashboard
                    </router-link>
                </li>
                <li class="nav-item">
                    <router-link to="/settings" class="nav-link">
                        <font-awesome-icon icon="cog" /> Settings
                    </router-link>
                </li>
            </ul>
        </header>

        <!-- Mobile header -->
        <header v-else class="d-flex flex-wrap justify-content-center mt-3 mb-3">
            <router-link to="/dashboard" class="d-flex align-items-center text-dark text-decoration-none">
                <object class="bi" width="40" height="40" data="/icon.svg" />
                <span class="fs-4 title ms-2">Uptime Kuma</span>
            </router-link>
        </header>

        <main>
            <!-- Add :key to disable vue router re-use the same component -->
            <router-view v-if="$root.loggedIn" :key="$route.fullPath" />
            <Login v-if="! $root.loggedIn && $root.allowLoginDialog" />
        </main>

        <footer>
            <div class="container-fluid">
                Uptime Kuma -
                Version: {{ $root.info.version }} -
                <a href="https://github.com/louislam/uptime-kuma/releases" target="_blank" rel="noopener">Check Update On GitHub</a>
            </div>
        </footer>

        <!-- Mobile Only -->
        <div v-if="$root.isMobile" style="width: 100%;height: 60px;" />
        <nav v-if="$root.isMobile" class="bottom-nav">
            <router-link to="/dashboard" class="nav-link" @click="$root.cancelActiveList">
                <div><font-awesome-icon icon="tachometer-alt" /></div>
                Dashboard
            </router-link>

            <a href="#" :class=" { 'router-link-exact-active' : $root.showListMobile } " @click="$root.showListMobile = ! $root.showListMobile">
                <div><font-awesome-icon icon="list" /></div>
                List
            </a>

            <router-link to="/add" class="nav-link" @click="$root.cancelActiveList">
                <div><font-awesome-icon icon="plus" /></div>
                Add
            </router-link>

            <router-link to="/settings" class="nav-link" @click="$root.cancelActiveList">
                <div><font-awesome-icon icon="cog" /></div>
                Settings
            </router-link>
        </nav>
    </div>
</template>

<script>
import Login from "../components/Login.vue";

export default {
    components: {
        Login,
    },
    data() {
        return {}
    },
    computed: {},
    watch: {
        $route (to, from) {
            this.init();
        },
    },
    mounted() {
        this.init();
    },
    methods: {
        init() {
            if (this.$route.name === "root") {
                this.$router.push("/dashboard")
            }
        },

    },
}
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.bottom-nav {
    z-index: 1000;
    position: fixed;
    bottom: 0;
    height: 60px;
    width: 100%;
    left: 0;
    box-shadow: 0 15px 47px 0 rgba(0, 0, 0, 0.05), 0 5px 14px 0 rgba(0, 0, 0, 0.05);
    text-align: center;
    white-space: nowrap;
    padding: 0 10px;

    a {
        text-align: center;
        width: 25%;
        display: inline-block;
        height: 100%;
        padding: 8px 10px 0;
        font-size: 13px;
        color: #c1c1c1;
        overflow: hidden;
        text-decoration: none;

        &.router-link-exact-active {
            color: $primary;
            font-weight: bold;
        }

        div {
            font-size: 20px;
        }
    }
}

.dark {
    .bottom-nav {
        background-color: var(--background-navbar);
    }
}

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

footer {
    color: #AAA;
    font-size: 13px;
    margin-top: 10px;
    margin-bottom: 30px;
    margin-left: 10px;
    text-align: center;
}

</style>
