<template>
    <div>
        <StatusPage v-if="statusPageSlug" :override-slug="statusPageSlug" />
    </div>
</template>

<script>
import axios from "axios";
import StatusPage from "./StatusPage.vue";

export default {
    components: {
        StatusPage,
    },
    data() {
        return {
            statusPageSlug: null,
        };
    },
    async mounted() {

        // There are only 2 cases that could come in here.
        // 1. Matched status Page domain name
        // 2. Vue Frontend Dev
        let res = (await axios.get("/api/entry-page")).data;

        if (res.type === "statusPageMatchedDomain") {
            this.statusPageSlug = res.statusPageSlug;
            this.$root.forceStatusPageTheme = true;

        } else if (res.type === "entryPage") {          // Dev only. For production, the logic is in the server side
            const entryPage = res.entryPage;

            if (entryPage === "statusPage") {
                this.$router.push("/status");
            } else {
                this.$router.push("/dashboard");
            }
        } else {
            this.$router.push("/dashboard");
        }

    },

};
</script>
