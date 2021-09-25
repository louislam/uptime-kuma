<template>
    <router-view />
</template>

<script>

import { i18n, localeDirection } from "./i18n";

export default {
    created() {
    
    this.setPageLocale();
  },
  methods: {
      setPageLocale() {
        const html = document.documentElement 
        html.setAttribute('lang', this.$i18n.locale )
        html.setAttribute('dir', localeDirection() )
      }
  },
  watch: {
        "$i18n.locale"() {
            this.setPageLocale();
        },
    },
}
</script>
