<template>
    <div class="container-fluid">
        <div class="row">
            <div v-if="!$root.isMobile" class="col-12 col-md-5 col-xl-4">
                <div>
                    <router-link to="/add" class="btn btn-primary mb-3"><font-awesome-icon icon="plus" /> {{ $t("Add New Monitor") }}</router-link>
                    <button class="btn btn-outline-primary mb-3 ms-2" @click="exportMonitorsCSV">
    <font-awesome-icon icon="file-export" /> Export CSV
</button>
                </div>
                <MonitorList :scrollbar="true" />
            </div>

            <div ref="container" class="col-12 col-md-7 col-xl-8 mb-3">
                <!-- Add :key to disable vue router re-use the same component -->
                <router-view :key="$route.fullPath" :calculatedHeight="height" />
            </div>
        </div>
    </div>
</template>

<script>

import MonitorList from "../components/MonitorList.vue";

export default {
    components: {
        MonitorList,
    },
    data() {
        return {
            height: 0
        };
    },
    methods: {
        async exportMonitorsCSV() {
            try {
                const token = this.$root.storage().token;
                const res = await fetch("/api/export/monitors/csv", {
                    headers: { Authorization: "Bearer " + token },
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.msg || "Export failed");
                }

                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "uptime-kuma-monitors.csv";
                document.body.appendChild(a);
                a.click();
                a.remove();
                window.URL.revokeObjectURL(url);
            } catch (error) {
                this.$root.toastError(error.message);
            }
        },
    },

    mounted() {
        this.height = this.$refs.container.offsetHeight;
    },
};
</script>

<style lang="scss" scoped>
.container-fluid {
    width: 98%;
}
</style>
