<template>
    <transition name="slide-fade" appear>
        <MonitorList :scrollbar="true" />
    </transition>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";

export default {
    components: {
        MonitorList,
    },
    mounted() {
        if (!this.$root.isMobile && this.$route.path === "/list") {
            this.$router.push("dashboard");
        }
    },
    watch: {
        "$root.isMobile"(newVal) {
            if (!newVal && this.$route.path === "/list") {
                this.$router.push("/dashboard");
            }
        }
    }
};
</script>
@import "../assets/vars";

.shadow-box {
    padding: 20px;
}

</style>
