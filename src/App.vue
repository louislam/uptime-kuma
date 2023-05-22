<template>
    <router-view />
</template>

<script>
import { setPageLocale } from "./util-frontend";
export default {
    created() {
        setPageLocale();
    },
};
</script>
