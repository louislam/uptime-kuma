<template>
    <div></div>
</template>

<script>
import axios from "axios";

export default {
    async mounted() {
        let entryPage = (await axios.get("/api/entry-page")).data;

        if (entryPage === "statusPage") {
            this.$router.push("/status");
        } else {
            this.$router.push("/dashboard");
        }
    },

};
</script>
