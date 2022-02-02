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

        <router-link :to="'/status'">
            <span class="route-back"><font-awesome-icon icon="chevron-left"
                                                        class="chevron-left"/> {{ $t("backToStatus") }}</span>
        </router-link>

        <!-- Incidents -->
        <template v-if="Object.entries(incidents).length">
            <div v-for="incidents in sortByYear(incidents)"
                 class="shadow-box alert mb-4 p-4 incident mt-4 position-relative d-flex flex-column year-box" role="alert">
                <h1>{{ incidents[0] }}</h1>
                <div v-for="incidents in sortByMonth(incidents[1])"
                     class="shadow-box alert mb-4 p-4 incident mt-4 position-relative month-box" role="alert">
                    <h1>{{ $root.getMonthName(incidents[0]) }}</h1>
                    <div v-for="incident in incidents[1]"
                         class="shadow-box alert mb-4 p-4 incident mt-4 position-relative incident-box" role="alert">
                        <div class="item">
                            <div class="row">
                                <div class="col-1 col-md-1 d-flex justify-content-center align-items-center">
                                    <font-awesome-icon v-if="incident.style === 'info'" icon="info-circle"
                                                       class="incident-icon incident-bg-info"/>
                                    <font-awesome-icon v-if="incident.style === 'warning'" icon="exclamation-triangle"
                                                       class="incident-icon incident-bg-warning"/>
                                    <font-awesome-icon v-if="incident.style === 'critical'" icon="exclamation-circle"
                                                       class="incident-icon incident-bg-danger"/>
                                </div>
                                <div class="col-11 col-md-11">
                                    <router-link :to="'/incident/' + incident.id">
                                        <h4 class="alert-heading">{{ incident.title }}</h4>
                                    </router-link>
                                    <div class="content">{{ incident.description }}</div>

                                    <!-- Incident Date -->
                                    <div class="date mt-3">
                                        {{ $t("Opened") }}: {{ $root.datetime(incident.createdDate) }} ({{
                                            dateFromNow(incident.createdDate)
                                        }})<br/>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </template>

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

let feedInterval;

export default {
    components: {},

    data() {
        return {
            config: {},
            imgDataUrl: "/icon.svg",
            loadedTheme: false,
            loadedData: false,
            baseURL: "",
            incident: [],
            incidents: [],
        };
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

        axios.get("/api/status-page/incidents/").then((res) => {
            if (res.data.ok) {
                this.incidents = this.$root.groupTimesBy(this.sortedIncidentHistory(res.data.incidents));
            }
        });
    },
    methods: {
        sortByYear(incidents) {
            let result = Object.entries(incidents);

            result.sort((y1, y2) => y2[0] - y1[0]);

            return result;
        },

        sortByMonth(incidents) {
            let result = Object.entries(incidents);

            result.sort((m1, m2) => m2[0] - m1[0]);

            return result;
        },
        
        sortedIncidentHistory(incidents) {
            let result = Object.values(incidents);
            
            result.sort((i1, i2) => {
                if (Date.parse(i1.createdDate) > Date.parse(i2.createdDate)) {
                    return -1;
                }

                if (Date.parse(i2.createdDate) < Date.parse(i1.createdDate)) {
                    return 1;
                }
            });
            
            return result;
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

.dark .shadow-box.year-box {
    background-color: #0d1117;
}

.dark .shadow-box.month-box {
    background-color: #090c11;
}

.dark .shadow-box.incident-box {
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
