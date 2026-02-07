import { createRouter, createWebHistory } from "vue-router";

import EmptyLayout from "./layouts/EmptyLayout.vue";
import Layout from "./layouts/Layout.vue";
import Dashboard from "./pages/Dashboard.vue";
import DashboardHome from "./pages/DashboardHome.vue";
import Details from "./pages/Details.vue";
import EditMonitor from "./pages/EditMonitor.vue";
import EditMaintenance from "./pages/EditMaintenance.vue";
import List from "./pages/List.vue";
const Settings = () => import("./pages/Settings.vue");
import Setup from "./pages/Setup.vue";
import StatusPage from "./pages/StatusPage.vue";
import Entry from "./pages/Entry.vue";
import ManageStatusPage from "./pages/ManageStatusPage.vue";
import AddStatusPage from "./pages/AddStatusPage.vue";
import NotFound from "./pages/NotFound.vue";
import DockerHosts from "./components/settings/Docker.vue";
import ManageMaintenance from "./pages/ManageMaintenance.vue";
import APIKeys from "./components/settings/APIKeys.vue";
import SetupDatabase from "./pages/SetupDatabase.vue";

import {
    ROUTES,
    getMonitorURL,
    getMonitorEditURL,
    getMonitorCloneURL,
    getMaintenanceEditURL,
    getMaintenanceCloneURL,
} from "./routes.ts";

// Settings - Sub Pages
import Appearance from "./components/settings/Appearance.vue";
import General from "./components/settings/General.vue";
const Notifications = () => import("./components/settings/Notifications.vue");
import ReverseProxy from "./components/settings/ReverseProxy.vue";
import Tags from "./components/settings/Tags.vue";
import MonitorHistory from "./components/settings/MonitorHistory.vue";
const Security = () => import("./components/settings/Security.vue");
import Proxies from "./components/settings/Proxies.vue";
import About from "./components/settings/About.vue";
import RemoteBrowsers from "./components/settings/RemoteBrowsers.vue";

const routes = [
    {
        path: ROUTES.ROOT,
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
                        path: ROUTES.DASHBOARD,
                        component: DashboardHome,
                        children: [
                            {
                                path: ROUTES.DASHBOARD_MONITOR,
                                component: EmptyLayout,
                                children: [
                                    {
                                        path: "",
                                        component: Details,
                                    },
                                    {
                                        path: ROUTES.MONITOR_EDIT,
                                        component: EditMonitor,
                                    },
                                ],
                            },
                        ],
                    },
                    {
                        path: ROUTES.MONITOR_ADD,
                        component: EditMonitor,
                        children: [
                            {
                                path: ROUTES.MONITOR_CLONE,
                                component: EditMonitor,
                            },
                        ],
                    },
                    {
                        path: ROUTES.MONITOR_LIST,
                        component: List,
                    },
                    {
                        path: ROUTES.SETTINGS,
                        component: Settings,
                        children: [
                            {
                                path: "general",
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
                                path: "reverse-proxy",
                                component: ReverseProxy,
                            },
                            {
                                path: "tags",
                                component: Tags,
                            },
                            {
                                path: "monitor-history",
                                component: MonitorHistory,
                            },
                            {
                                path: "docker-hosts",
                                component: DockerHosts,
                            },
                            {
                                path: "remote-browsers",
                                component: RemoteBrowsers,
                            },
                            {
                                path: "security",
                                component: Security,
                            },
                            {
                                path: "api-keys",
                                component: APIKeys,
                            },
                            {
                                path: "proxies",
                                component: Proxies,
                            },
                            {
                                path: "about",
                                component: About,
                            },
                        ],
                    },
                    {
                        path: ROUTES.STATUS_PAGE_MANAGE,
                        component: ManageStatusPage,
                    },
                    {
                        path: ROUTES.STATUS_PAGE_ADD,
                        component: AddStatusPage,
                    },
                    {
                        path: ROUTES.MAINTENANCE,
                        component: ManageMaintenance,
                    },
                    {
                        path: ROUTES.MAINTENANCE_ADD,
                        component: EditMaintenance,
                    },
                    {
                        path: ROUTES.MAINTENANCE_EDIT,
                        component: EditMaintenance,
                    },
                    {
                        path: ROUTES.MAINTENANCE_CLONE,
                        component: EditMaintenance,
                    },
                ],
            },
        ],
    },
    {
        path: ROUTES.SETUP,
        component: Setup,
    },
    {
        path: ROUTES.SETUP_DATABASE,
        component: SetupDatabase,
    },
    {
        path: ROUTES.STATUS_PAGE_COMPAT,
        component: StatusPage,
    },
    {
        path: ROUTES.STATUS_COMPAT,
        component: StatusPage,
    },
    {
        path: ROUTES.STATUS_PAGE,
        component: StatusPage,
    },
    // Backward-compatibility redirects for old routes
    { path: "/dashboard/:id", redirect: (to) => getMonitorURL(to.params.id) },
    { path: "/dashboard", redirect: ROUTES.DASHBOARD },
    { path: "/add", redirect: ROUTES.MONITOR_ADD },
    { path: "/edit/:id", redirect: (to) => getMonitorEditURL(to.params.id) },
    { path: "/clone/:id", redirect: (to) => getMonitorCloneURL(to.params.id) },
    { path: "/list", redirect: ROUTES.MONITOR_LIST },
    { path: "/manage-status-page", redirect: ROUTES.STATUS_PAGE_MANAGE },
    { path: "/add-status-page", redirect: ROUTES.STATUS_PAGE_ADD },
    { path: "/maintenance/edit/:id", redirect: (to) => getMaintenanceEditURL(to.params.id) },
    { path: "/maintenance/clone/:id", redirect: (to) => getMaintenanceCloneURL(to.params.id) },
    { path: "/maintenance", redirect: ROUTES.MAINTENANCE },
    { path: "/add-maintenance", redirect: ROUTES.MAINTENANCE_ADD },
    { path: "/settings/:page(.*)", redirect: (to) => `${ROUTES.SETTINGS}/${to.params.page}` },
    {
        path: "/:pathMatch(.*)*",
        component: NotFound,
    },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});
