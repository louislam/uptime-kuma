<template>
    <div>
        <h1>Incident Reports</h1>
        <div v-if="isLoading">Loading...</div>
        <div v-else-if="filteredReports.length">
            <div
                v-for="report in filteredReports"
                :key="report._id"
                class="big-padding"
            >
                <h3>{{ formatDate(report._createdDate) }}</h3>
                <hr />
                <h4>{{ report._title }}</h4>
                <p>{{ report._content }}</p>
                <hr />
                <br /><br />
            </div>
        </div>
        <p v-else>No incident reports found or an error occurred.</p>
    </div>
</template>

<script>
export default {
    data() {
        return {
            incidentReports: [],
            isLoading: false,
            error: null,
        };
    },
    computed: {
        filteredReports() {
            return this.incidentReports
                .slice() // Create a copy to avoid mutating the original array
                .sort(
                    (a, b) =>
                        new Date(b._createdDate) - new Date(a._createdDate),
                )
                .slice(-25); // Get the last 25 sorted reports
        },
    },

    mounted() {
        this.fetchIncidentReports();
    },
    methods: {
        async fetchIncidentReports() {
            this.isLoading = true;
            try {
                const response = await fetch("/api/incident-reports"); // Replace with your API endpoint
                const data = await response.json();
                this.incidentReports = data;
            } catch (error) {
                this.error = error;
                console.error("Error fetching incident reports:", error);
            } finally {
                this.isLoading = false;
            }
        },
        formatDate(dateString) {
            const date = new Date(dateString);
            return date.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            });
        },
    },
};
</script>
<style>
.incident-report-container {
    display: flex;
    flex-direction: column;
    gap: 10px; /* Adjust gap between boxes */
}

.incident-report {
    background-color: #fff;
    border-radius: 10px;
    padding: 20px;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
}

</style>

