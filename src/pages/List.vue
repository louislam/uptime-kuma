<template>
    <transition name="slide-fade" appear>
        <MonitorList />
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

