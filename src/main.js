import "bootstrap";
import { createApp, h } from "vue";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import App from "./App.vue";
import "./assets/app.scss";
import { i18n } from "./i18n";
import { FontAwesomeIcon } from "./icon.js";
import datetime from "./mixins/datetime";
import mobile from "./mixins/mobile";
import socket from "./mixins/socket";
import theme from "./mixins/theme";
import { router } from "./router";
import { appName } from "./util.ts";

const app = createApp({
    mixins: [
        socket,
        theme,
        mobile,
        datetime
    ],
    data() {
        return {
            appName: appName
        }
    },
    render: () => h(App),
})

app.use(router);
app.use(i18n);

const options = {
    position: "bottom-right",
};

app.use(Toast, options);

app.component("FontAwesomeIcon", FontAwesomeIcon)

app.mount("#app")
