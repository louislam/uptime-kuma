import axios from "axios";
import { buildUrl } from "../util-badges";

const env = process.env.NODE_ENV || "production";

// change the axios base url for development
if (env === "development" || localStorage.dev === "dev") {
    axios.defaults.baseURL = location.protocol + "//" + location.hostname + ":3001";
}

export default {
    computed: {
        badgeBaseURL() {
            if (this.$root.info.primaryBaseURL) {
                return this.$root.info.primaryBaseURL;
            }

            if (env === "development" || localStorage.dev === "dev") {
                return axios.defaults.baseURL + "/api/badge";
            } else {
                return location.protocol + "//" + location.host + "/api/badge";
            }
        },
    },
    methods: {
        getBadgesUrl(monitorId, path, pathParams, searchParams) {

            const pathParamGlobal = /\/\{(\w+)\}/ig;
            const pathParam = /\/\{(\w+)\}/i;

            const matches = path.match(pathParamGlobal);

            matches && matches.forEach((match) => {
                const [ , name ] = match.match(pathParam) ?? [];
                path = path.replace(match, name && pathParams[name] ? `/${pathParams[name]}` : "");
            });

            return buildUrl(`${this.$root.badgeBaseURL}/${monitorId}/${path}`, searchParams);
        }
    }
};
