import { createRouter, createWebHistory } from "vue-router";
import EmptyLayout from "./layouts/EmptyLayout.vue";
import Layout from "./layouts/Layout.vue";
import Dashboard from "./pages/Dashboard.vue";
import DashboardHome from "./pages/DashboardHome.vue";
import Details from "./pages/Details.vue";
import IncidentDetails from "./pages/IncidentDetails.vue";
import EditMonitor from "./pages/EditMonitor.vue";
import EditIncident from "./pages/EditIncident.vue";
import List from "./pages/List.vue";
const Settings = () => import("./pages/Settings.vue");
import Setup from "./pages/Setup.vue";
const StatusPage = () => import("./pages/StatusPage.vue");
const IncidentPage = () => import("./pages/IncidentPage.vue");
const IncidentsPage = () => import("./pages/IncidentsPage.vue");
import Entry from "./pages/Entry.vue";

import Appearance from "./components/settings/Appearance.vue";
import General from "./components/settings/General.vue";
import Notifications from "./components/settings/Notifications.vue";
import MonitorHistory from "./components/settings/MonitorHistory.vue";
import Security from "./components/settings/Security.vue";
import Backup from "./components/settings/Backup.vue";
import About from "./components/settings/About.vue";

const routes = [
    {
        path: "/",
        component: Entry,
    },
    {
        // If it is "/dashboard", the active link is not working
        // If it is "", it overrides the "/" unexpectedly
        // Give a random name to solve the problem.
        path: "/empty",
        component: Layout,
        children: [
            {
                path: "",
                component: Dashboard,
                children: [
                    {
                        name: "DashboardHome",
                        path: "/dashboard",
                        component: DashboardHome,
                        children: [
                            {
                                path: "/dashboard/monitor/:id",
                                component: EmptyLayout,
                                children: [
                                    {
                                        path: "",
                                        component: Details,
                                    },
                                    {
                                        path: "/editMonitor/:id",
                                        component: EditMonitor,
                                    },
                                ],
                            },
                            {
                                path: "/dashboard/incident/:id",
                                component: EmptyLayout,
                                children: [
                                    {
                                        path: "",
                                        component: IncidentDetails,
                                    },
                                    {
                                        path: "/editIncident/:id",
                                        component: EditIncident,
                                    },
                                ],
                            },
                            {
                                path: "/addMonitor",
                                component: EditMonitor,
                            },
                            {
                                path: "/addIncident",
                                component: EditIncident,
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
                        children: [
                            {
                                path: "general",
                                alias: "",
                                component: General,
                            },
                            {
                                path: "appearance",
                                component: Appearance,
                            },
                            {
                                path: "notifications",
                                component: Notifications,
                            },
                            {
                                path: "monitor-history",
                                component: MonitorHistory,
                            },
                            {
                                path: "security",
                                component: Security,
                            },
                            {
                                path: "backup",
                                component: Backup,
                            },
                            {
                                path: "about",
                                component: About,
                            },
                        ]
                    },
                ],
            },
        ],
    },
    {
        path: "/setup",
        component: Setup,
    },
    {
        path: "/status-page",
        component: StatusPage,
    },
    {
        path: "/status",
        component: EmptyLayout,
        children: [
            {
                path: "",
                component: StatusPage,
            },
            {
                path: "/incident/:id",
                component: IncidentPage,
            },
            {
                path: "/incidents",
                component: IncidentsPage,
            },
        ],
    },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});
