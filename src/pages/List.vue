<template>
    <transition name="slide-fade" appear>
        <MonitorList :scrollbar="true" />
    </transition>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";
import { ROUTES } from "../routes.ts";

export default {
    components: {
        MonitorList,
    },
    watch: {
        "$root.isMobile"(newVal) {
            if (!newVal && this.$route.path === ROUTES.MONITOR_LIST) {
                this.$router.replace({ path: ROUTES.DASHBOARD });
            }
        },
    },
    mounted() {
        if (!this.$root.isMobile && this.$route.path === ROUTES.MONITOR_LIST) {
            this.$router.replace({ path: ROUTES.DASHBOARD });
        }
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.shadow-box {
    padding: 20px;
}
</style>
