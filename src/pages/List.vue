<template>
    <transition name="slide-fade" appear>
        <MonitorList :scrollbar="true" />
    </transition>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";
import mobile from "../mixins/mobile";

export default {
    components: {
        MonitorList,
    },
    async mounted() {
        if (!mobile.computed.isMobile()) {
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
