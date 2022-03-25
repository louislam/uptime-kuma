<template>
    <div>
        <!--
            TODO: If the domain name matched, directly render the <StatusPage> component.
        -->
    </div>
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
