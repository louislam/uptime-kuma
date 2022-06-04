import { createRouter, createWebHistory } from "vue-router";

const EmptyLayout = () => import("./layouts/EmptyLayout.vue");
const Layout = () => import("./layouts/Layout.vue");
const Dashboard = () => import("./pages/Dashboard.vue");
const DashboardHome = () => import("./pages/DashboardHome.vue");
const Details = () => import("./pages/Details.vue");
const EditMonitor = () => import("./pages/EditMonitor.vue");
const List = () => import("./pages/List.vue");
const Settings = () => import("./pages/Settings.vue");
const Setup = () => import("./pages/Setup.vue");
const StatusPage = () => import("./pages/StatusPage.vue");
const Entry = () => import("./pages/Entry.vue");
const ManageStatusPage = () => import("./pages/ManageStatusPage.vue");
const AddStatusPage = () => import("./pages/AddStatusPage.vue");
const NotFound = () => import("./pages/NotFound.vue");

// Settings - Sub Pages
const Appearance = () => import("./components/settings/Appearance.vue");
const General = () => import("./components/settings/General.vue");
const Notifications = () => import("./components/settings/Notifications.vue");
const ReverseProxy = () => import("./components/settings/ReverseProxy.vue");
const MonitorHistory = () => import("./components/settings/MonitorHistory.vue");
const Security = () => import("./components/settings/Security.vue");
const Proxies = () => import("./components/settings/Proxies.vue");
const Backup = () => import("./components/settings/Backup.vue");
const About = () => import("./components/settings/About.vue");

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
                                path: "monitor-history",
                                component: MonitorHistory,
                            },
                            {
                                path: "security",
                                component: Security,
                            },
                            {
                                path: "proxies",
                                component: Proxies,
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
                    {
                        path: "/manage-status-page",
                        component: ManageStatusPage,
                    },
                    {
                        path: "/add-status-page",
                        component: AddStatusPage,
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
        component: StatusPage,
    },
    {
        path: "/status/:slug",
        component: StatusPage,
    },
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
