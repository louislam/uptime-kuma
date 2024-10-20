<template>
    <transition name="slide-fade" appear>
        <MonitorList v-if="$root.isMobile" :scrollbar="true" />
    </transition>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";

export default {
    components: {
        MonitorList,
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.shadow-box {
    padding: 20px;
}

</style>
