import axios from "axios";
import { getDevContainerServerHostname, isDevContainer } from "../util-frontend";

const env = process.env.NODE_ENV || "production";

// change the axios base url for development
if (env === "development" && isDevContainer()) {
    axios.defaults.baseURL = location.protocol + "//" + getDevContainerServerHostname();
} else if (env === "development" || localStorage.dev === "dev") {
    axios.defaults.baseURL = location.protocol + "//" + location.hostname + ":3001";
}

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
