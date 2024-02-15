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
    async mounted() {
        if (!this.$root.isMobile) {
            this.$router.push("/dashboard");
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
