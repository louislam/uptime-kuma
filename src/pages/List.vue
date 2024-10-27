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
    mounted() {
        if (!this.$root.isMobile && this.$route.path === '/list') {
            this.$router.push('/dashboard');
        }
    },
    watch: {
        '$root.isMobile'(newVal) {
            if (!newVal && this.$route.path === '/list') {
                this.$router.push('/dashboard');
            }
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars";

.shadow-box {
    padding: 20px;
}

.slide-fade-enter-active, .slide-fade-leave-active {
    transition: all 0.5s ease;
}
.slide-fade-enter, .slide-fade-leave-to {
    transform: translateX(10px);
    opacity: 0;
}
</style>
