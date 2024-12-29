<template>
    <transition name="slide-fade" appear>
        <MonitorList :scrollbar="true" />
    </transition>
</template>

<script>
import MonitorList from "../components/MonitorList.vue";
import mobileMixin from "../mixins/mobile.js";

export default {
    components: {
        MonitorList,
    },
    mixins: [ mobileMixin ],
    created() {
        if (!this.isMobile) {
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
