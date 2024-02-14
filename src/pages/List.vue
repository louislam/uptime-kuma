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
};

mobile.methods.onResize();
if (!mobile.computed.isMobile(mobile.methods.windowWidth) && window.location.pathname === "/list") {
    window.location.href = "/dashboard";
}
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.shadow-box {
    padding: 20px;
}

</style>
