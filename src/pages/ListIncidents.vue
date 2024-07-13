<template>
    <div>
        <h1>Incident Reports</h1>
        <div v-if="isLoading">Loading...</div>
        <div v-else-if="incidentReports.length">
            <div v-for="report in incidentReports" :key="report._id">

                <h3>{{ formatDate(report._createdDate) }}</h3>
                <hr>
                <h4>{{ report._title }}</h4>
                <p>{{ report._content }}</p>
                <hr><br><br>

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
                console.log(data);
            } catch (error) {
                this.error = error;
                console.error("Error fetching incident reports:", error);
            } finally {
                this.isLoading = false;
                this.filteredReports = this.incidentReports.slice(-25); // Get the last 25 reports
            }
        },
        formatDate(dateString) { const date = new Date(dateString); return date.toLocaleDateString('en-US', { year: 'numeric',month: 'long',day: 'numeric' });
    },
    },
    computed: {
        filteredReports() {
            // You can implement additional filtering/sorting logic here
            return this.incidentReports.slice(-25);
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
.jumbotron {
  background-color: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px; /* Add spacing between jumbotrons */
}

</style>
