import axios from "axios";

const env = process.env.NODE_ENV || "production";

// change the axios base url for development
if (env === "development" || localStorage.dev === "dev") {
    axios.defaults.baseURL = location.protocol + "//" + location.hostname + ":3001";
}

// Add a response interceptor to catch 404 errors in dymanic routes such as /status/:slug
axios.interceptors.response.use(function (response) {
    return response;
}, function (error) {
    if(error.response.status === 404){
        location.href = "/page-not-found";
    }
    console.log(error);
    return Promise.reject(error);
});

export default {
    data() {
        return {
            publicGroupList: [],
        };
    },
    computed: {
        publicMonitorList() {
            let result = {};

            for (let group of this.publicGroupList) {
                for (let monitor of group.monitorList) {
                    result[monitor.id] = monitor;
                }
            }
            return result;
        },

        publicLastHeartbeatList() {
            let result = {};

            for (let monitorID in this.publicMonitorList) {
                if (this.lastHeartbeatList[monitorID]) {
                    result[monitorID] = this.lastHeartbeatList[monitorID];
                }
            }

            return result;
        },

        baseURL() {
            if (this.$root.info.primaryBaseURL) {
                return this.$root.info.primaryBaseURL;
            }

            if (env === "development" || localStorage.dev === "dev") {
                return axios.defaults.baseURL;
            } else {
                return location.protocol + "//" + location.host;
            }
        },
    }
};
