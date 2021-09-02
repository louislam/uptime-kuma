import "bootstrap";
import { createApp, h } from "vue";
import { createI18n } from "vue-i18n"
import { createRouter, createWebHistory } from "vue-router";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import App from "./App.vue";
import "./assets/app.scss";
import { FontAwesomeIcon } from "./icon.js";
import EmptyLayout from "./layouts/EmptyLayout.vue";
import Layout from "./layouts/Layout.vue";
import socket from "./mixins/socket";
import theme from "./mixins/theme";
import mobile from "./mixins/mobile";
import datetime from "./mixins/datetime";
import Dashboard from "./pages/Dashboard.vue";
import DashboardHome from "./pages/DashboardHome.vue";
import Details from "./pages/Details.vue";
import EditMonitor from "./pages/EditMonitor.vue";
import Settings from "./pages/Settings.vue";
import Setup from "./pages/Setup.vue";
import List from "./pages/List.vue";

import { appName } from "./util.ts";

import en from "./languages/en";
import zhHK from "./languages/zh-HK";
import deDE from "./languages/de-DE";
import nlNL from "./languages/nl-NL";
import fr from "./languages/fr";
import ja from "./languages/ja";
import daDK from "./languages/da-DK";
import svSE from "./languages/sv-SE";
import koKR from "./languages/ko-KR";
import ruRU from "./languages/ru-RU";

const routes = [
    {
        path: "/",
        component: Layout,
        children: [
            {
                name: "root",
                path: "",
                component: Dashboard,
                children: [
                    {
                        name: "DashboardHome",
                        path: "/dashboard",
                        component: DashboardHome,
                        children: [
                            {
                                path: "/dashboard/:id",
                                component: EmptyLayout,
                                children: [
                                    {
                                        path: "",
                                        component: Details,
                                    },
                                    {
                                        path: "/edit/:id",
                                        component: EditMonitor,
                                    },
                                ],
                            },
                            {
                                path: "/add",
                                component: EditMonitor,
                            },
                            {
                                path: "/list",
                                component: List,
                            },
                        ],
                    },
                    {
                        path: "/settings",
                        component: Settings,
                    },
                ],
            },

        ],

    },
    {
        path: "/setup",
        component: Setup,
    },
]

const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
})

const languageList = {
    en,
    "zh-HK": zhHK,
    "de-DE": deDE,
    "nl-NL": nlNL,
    "fr": fr,
    "ja": ja,
    "da-DK": daDK,
    "sv-SE": svSE,
    "ko-KR": koKR,
    "ru-RU": ruRU,
};

const i18n = createI18n({
    locale: localStorage.locale || "en",
    fallbackLocale: "en",
    silentFallbackWarn: true,
    silentTranslationWarn: true,
    messages: languageList
});

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
