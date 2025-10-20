<template>
    <router-view />
</template>

<script>
import { setPageLocale } from "./util-frontend";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";
export default {
    created() {
        setPageLocale();
    },
};
polyfillCountryFlagEmojis();
</script>
