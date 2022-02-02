<template>
    <div v-if="loadedTheme" class="container mt-3">
        <!-- Logo & Title -->
        <h1 class="mb-4">
            <!-- Logo -->
            <span class="logo-wrapper">
                <img :src="logoURL" alt class="logo me-2"/>
            </span>

            <!-- Title -->
            <span>{{ config.title }}</span>
        </h1>

        <router-link v-if="prevRoute === '/status' || !prevRoute" :to="'/status'">
            <span class="route-back">
                <font-awesome-icon icon="chevron-left" class="chevron-left"/>
                {{ $t("backToStatus") }}
            </span>
        </router-link>
        <router-link v-if="prevRoute === '/incidents'" :to="'/incidents'">
            <span class="route-back">
                <font-awesome-icon icon="chevron-left" class="chevron-left"/>
                {{ $t("backToIncidents") }}
            </span>
        </router-link>

        <!-- Incident -->
        <h2 class="incident-title">{{ $t("Incident") }}</h2>
        <div class="shadow-box alert mb-4 p-4 incident mt-4 position-relative" role="alert">
            <div class="item">
                <div class="row">
                    <div class="col-12 col-md-12">
                        <div class="div-title d-flex">
                            <font-awesome-icon v-if="incidentDetails.style === 'info'" icon="info-circle"
                                               class="incident-icon incident-bg-info"/>
                            <font-awesome-icon v-else-if="incidentDetails.style === 'warning'"
                                               icon="exclamation-triangle"
                                               class="incident-icon incident-bg-warning"/>
                            <font-awesome-icon v-else-if="incidentDetails.style === 'critical'"
                                               icon="exclamation-circle"
                                               class="incident-icon incident-bg-danger"/>
                            {{ incidentDetails.title }}
                            <span class="actual-status">
                                <span v-if="incidentDetails.resolved" class="status">{{ $t("Resolved") }}</span>
                                <span v-if="!incidentDetails.resolved" class="status">{{ $t("Ongoing") }}</span>
                            </span>
                        </div>

                        <div v-if="this.affectedMonitors.length" style="margin-top: 10px">
                            <button v-for="monitor in this.affectedMonitors" class="btn btn-monitor"
                                    style="margin: 5px; cursor: auto; font-weight: 500">
                                {{ monitor.name }}
                            </button>
                        </div>

                        <div class="incident-timeline">
                            <div id="timeline-content">
                                <ul class="timeline">
                                    <li v-for="incident_line in sortedIncidentHistory()" class="event"
                                        :data-date="$t(incident_line.type)">
                                        <p class="description">{{ incident_line.description }}</p>
                                        <p class="date">{{ $t("Created") }}:
                                            {{ $root.datetime(incident_line.createdDate) }}</p>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <footer class="mt-5 mb-4">
            {{ $t("Powered by") }} <a target="_blank"
                                      href="https://github.com/louislam/uptime-kuma">{{ $t("Uptime Kuma") }}</a>
        </footer>
    </div>
</template>

<script>
import axios from "axios";
import {useToast} from "vue-toastification";
import dayjs from "dayjs";

const toast = useToast();

export default {
    components: {},

    data() {
        return {
            prevRoute: null,
            config: {},
            imgDataUrl: "/icon.svg",
            loadedTheme: false,
            loadedData: false,
            baseURL: "",
            incident: [],
            incidentDetails: {},
            affectedMonitors: [],
        };
    },

    async beforeRouteEnter(to, from, next) {
        //TODO: remember from where I came after refresh
        next(vm => {
            if (from.path !== "/") {
                vm.prevRoute = from.path;
            }
        })
    },
    computed: {
        logoURL() {
            if (this.imgDataUrl.startsWith("data:")) {
                return this.imgDataUrl;
            } else {
                return this.baseURL + this.imgDataUrl;
            }
        },

        isPublished() {
            return this.config.statusPagePublished;
        },

        theme() {
            return this.config.statusPageTheme;
        },

    },
    watch: {

        // Set Theme
        "config.statusPageTheme"() {
            this.$root.statusPageTheme = this.config.statusPageTheme;
            this.loadedTheme = true;
        },

        "config.title"(title) {
            document.title = title;
        }

    },
    async created() {
        // Special handle for dev
        const env = process.env.NODE_ENV;
        if (env === "development" || localStorage.dev === "dev") {
            this.baseURL = location.protocol + "//" + location.hostname + ":3001";
        }
    },
    async mounted() {
        axios.get("/api/status-page/config").then((res) => {
            this.config = res.data;

            if (this.config.logo) {
                this.imgDataUrl = this.config.logo;
            }
        });

        axios.get("/api/status-page/incident/" + this.$route.params.id).then((res) => {
            if (res.data.ok) {
                this.incident = res.data.incidents;
                this.incidentDetails = this.sortedIncidentHistory(res.data.incidents)[0];
                this.affectedMonitors = res.data.monitors;
            }
        });
    },
    methods: {
        sortedIncidentHistory() {
            return Object.values(this.incident).sort((i1, i2) => Date.parse(i1.createdDate) - Date.parse(i2.createdDate));
        },

        dateFromNow(date) {
            return dayjs.utc(date).fromNow();
        },

    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";
@import "../assets/timeline.scss";

h1 {
    font-size: 30px;

    img {
        vertical-align: middle;
        height: 60px;
        width: 60px;
    }
}

a {
    text-decoration: none;
}

.route-back {
    color: #637381;

    .chevron-left {
        font-size: 13px;
    }
}

.dark .route-back {
    color: #b0b7bf;
}

.incident-title {
    margin-top: 50px;
}

footer {
    text-align: center;
    font-size: 14px;
}

.description span {
    min-width: 50px;
}

.logo-wrapper {
    display: inline-block;
    position: relative;
}

.logo {
    transition: all $easing-in 0.2s;
}

.mobile {
    h1 {
        font-size: 22px;
    }

    .overall-status {
        font-size: 20px;
    }
}

.div-title {
    font-size: 1.5rem;
    font-weight: 500;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    column-gap: 10px;
}

.incident-bg-info {
    color: rgba(53, 162, 220, 0.52);
}

.incident-bg-warning {
    color: rgba(255, 165, 0, 0.52);
}

.incident-bg-danger {
    color: #dc354585;
}

.incident-icon {
    font-size: 30px;
    vertical-align: middle;
}

.dark .shadow-box {
    background-color: #0d1117;
}

.btn-monitor {
    color: white;
    background-color: #5cdd8b;
}

.dark .btn-monitor {
    color: #0d1117 !important;
}

.actual-status {
    margin-top: auto;
    color: #637381;
    font-size: 13px;
}

</style>
