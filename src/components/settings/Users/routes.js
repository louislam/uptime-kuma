import { h } from "vue";
import { RouterView } from "vue-router";

// Needed for settings enter/leave CSS animation
const AnimatedRouterView = () => h("div", [ h(RouterView) ]);
AnimatedRouterView.displayName = "AnimatedRouterView";

export default {
    path: "users",
    component: AnimatedRouterView,
    children: [
        {
            path: "",
            name: "settings.users",
            component: () => import("./Users.vue")
        },
        {
            path: "add",
            name: "settings.users.add",
            component: () => import("./AddUser.vue")
        },
        {
            path: "edit/:id",
            name: "settings.users.edit",
            props: true,
            component: () => import("./EditUser.vue")
        },
    ]
};
