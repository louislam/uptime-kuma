```vue
<template>
    <div>
        <div class="my-4">
            <div class="row g-3">
                <div class="col-md-4">
                    <label for="filter-monitor" class="form-label">{{ $t("Monitor") }}</label>
                    <select id="filter-monitor" v-model="filterMonitorID" class="form-select">
                        <option :value="null">{{ $t("All Monitors") }}</option>
                        <option
                            v-for="monitor in monitorList"
                            :key="monitor.id"
                            :value="monitor.id"
                        >
                            {{ monitor.name }}
                        </option>
                    </select>
                </div>

                <div class="col-md-4">
                    <label for="filter-channel" class="form-label">{{ $t("Channel") }}</label>
                    <select id="filter-channel" v-model="filterNotificationID" class="form-select">
                        <option :value="null">{{ $t("All Channels") }}</option>
                        <option
                            v-for="notification in notificationList"
                            :key="notification.id"
                            :value="notification.id"
                        >
                            {{ notification.name }}
                        </option>
                    </select>
                </div>

                <div class="col-md-4">
                    <label for="filter-status" class="form-label">{{ $t("Status") }}</label>
                    <select id="filter-status" v-model="filterStatus" class="form-select">
                        <option :value="null">{{ $t("All Statuses") }}</option>
                        <option value="success">{{ $t("Success") }}</option>
                        <option value="failed">{{ $t("Failed") }}</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="shadow-box p-0">
            <div v-if="loading && records.length === 0" class="text-center py-4">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">{{ $t("Loading...") }}</span>
                </div>
            </div>

            <div v-else-if="records.length === 0" class="text-center py-4 text-muted">
                {{ $t("No notification history available") }}
            </div>

            <div v-else class="table-responsive">
                <table class="table table-hover mb-0">
                <thead>
                <tr>
                 <th>{{ $t("مانیتور") }}</th>
                  <th>{{ $t("کانال") }}</th>
                   <th>{{ $t("نتیجه") }}</th>
                    <th class="message-column">{{ $t("پیام") }}</th>
                    <th>{{ $t("تاریخ") }}</th>
                     </tr> 
                     </thead>

                    <tbody>
                        <tr v-for="record in records" :key="record.id">
                            <td>
                                {{ record.monitor_name || "—" }}
                            </td>

                            <td>
                                {{ record.notification_name || record.type || "—" }}
                            </td>

                            <td>
                                <span
                                    v-if="record.status === 'success'"
                                    class="badge bg-success"
                                >
                                    {{ $t("Success") }}
                                </span>

                                <span
                                    v-else
                                    class="badge bg-danger"
                                >
                                    {{ $t("Failed") }}
                                </span>
                            </td>
                           
                            <td class="message-cell">
                                <span v-if="record.message">
                                    {{ record.message }}
                                </span>

                                <span v-else class="text-muted">
                                    —
                                </span>
                            </td>
                              <td>
                                {{ record.created_date || "—" }}
                            </td>
                           
                        </tr>
                    </tbody>
                </table>
            </div>

            <div
                v-if="!loading && records.length > 0"
                class="d-flex justify-content-center kuma_pagination p-3"
            >
                <pagination
                    v-model="page"
                    :records="totalRecords"
                    :per-page="perPage"
                    :options="paginationConfig"
                />
            </div>
        </div>
    </div>
</template>

<script>
import Pagination from "v-pagination-3";

export default {
    name: "NotificationHistory",

    components: {
        Pagination,
    },

    data() {
        return {
            page: 1,
            perPage: 25,

            paginationConfig: {
                hideCount: true,
                chunksNavigation: "scroll",
            },

            loading: false,
            records: [],
            totalRecords: 0,

            filterMonitorID: null,
            filterNotificationID: null,
            filterStatus: null,
        };
    },

    computed: {
        monitorList() {
            return Object.values(this.$root.monitorList).sort((a, b) =>
                a.name.localeCompare(b.name)
            );
        },

        notificationList() {
            return [...this.$root.notificationList].sort((a, b) =>
                a.name.localeCompare(b.name)
            );
        },
    },

    watch: {
        filterMonitorID() {
            this.page = 1;
            this.loadHistory();
        },

        filterNotificationID() {
            this.page = 1;
            this.loadHistory();
        },

        filterStatus() {
            this.page = 1;
            this.loadHistory();
        },

        page() {
            this.loadHistory();
        },
    },

    mounted() {
        this.loadHistory();
    },

    methods: {
        loadHistory() {
            this.loading = true;

            const offset = (this.page - 1) * this.perPage;

            this.$root.getSocket().emit(
                "getNotificationHistory",
                this.filterMonitorID,
                this.filterNotificationID,
                this.filterStatus,
                offset,
                this.perPage,
                (res) => {
                    this.loading = false;

                    if (res.ok) {
                        this.records = res.data;
                        this.totalRecords = res.total;
                    }
                }
            );
        },
    },
};
</script>

```vue

```scss
<style lang="scss" scoped>
.table-responsive {
    overflow-x: auto;
    width: 100%;
}

.table {
    min-width: 700px;
    margin-bottom: 0;
}

.table thead th {
    font-size: 1rem;
    font-weight: 600;
    padding: 0.45rem 0.7rem;
    white-space: nowrap;
    vertical-align: middle;
}

.table tbody td {
    padding: 0.55rem 0.7rem;
    vertical-align: middle;
}

.message-column {
    width: 280px;
    min-width: 280px;
}

.message-cell {
    width: 280px;
    max-width: 280px;
    font-size: 0.8rem;
    line-height: 1.4;
    white-space: normal;
    word-break: break-word;
    overflow-wrap: anywhere;
}

.kuma_pagination {
    padding-top: 0.6rem !important;
    padding-bottom: 0.6rem !important;
}
</style>


```
