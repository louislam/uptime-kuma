import { createRouter, createWebHistory } from "vue-router";
import EmptyLayout from "./layouts/EmptyLayout.vue";
import Layout from "./layouts/Layout.vue";
import Dashboard from "./pages/Dashboard.vue";
import DashboardHome from "./pages/DashboardHome.vue";
import Details from "./pages/Details.vue";
import EditMonitor from "./pages/EditMonitor.vue";
import List from "./pages/List.vue";
import Settings from "./pages/Settings.vue";
import Setup from "./pages/Setup.vue";
import StatusPage from "./pages/StatusPage.vue";

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
    {
        path: "/status-page",
        component: StatusPage,
    },
];

export const router = createRouter({
    linkActiveClass: "active",
    history: createWebHistory(),
    routes,
});
