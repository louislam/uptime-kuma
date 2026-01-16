<template>
    <div>
        <div class="period-options">
            <button
                type="button"
                class="btn btn-light dropdown-toggle btn-period-toggle"
                data-bs-toggle="dropdown"
                aria-expanded="false"
            >
                {{ chartPeriodOptions[chartPeriodHrs] }}&nbsp;
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
                <li v-for="(item, key) in chartPeriodOptions" :key="key">
                    <button
                        type="button"
                        class="dropdown-item"
                        :class="{ active: chartPeriodHrs == key }"
                        @click="chartPeriodHrs = key"
                    >
                        {{ item }}
                    </button>
                </li>
            </ul>
        </div>
        <div class="chart-wrapper" :class="{ loading: loading }">
            <Line :data="chartData" :options="chartOptions" />
        </div>
    </div>
</template>

<script lang="js">
import {
    BarController,
    BarElement,
    Chart,
    Filler,
    LinearScale,
    LineController,
    LineElement,
    PointElement,
    TimeScale,
    Tooltip,
    Legend,
} from "chart.js";
import "chartjs-adapter-dayjs-4";
import { Line } from "vue-chartjs";

Chart.register(
    LineController,
    BarController,
    LineElement,
    PointElement,
    TimeScale,
    BarElement,
    LinearScale,
    Tooltip,
    Filler,
    Legend
);

export default {
    components: { Line },
    props: {
        /** ID of monitor */
        monitorId: {
            type: Number,
            required: true,
        },
    },
    data() {
        return {
            loading: false,

            // Time period for the chart to display, in hours
            chartPeriodHrs: "24",

            chartPeriodOptions: {
                3: "3h",
                6: "6h",
                24: "24h",
                168: "1w",
            },

            chartRawData: null,
            chartDataFetchInterval: null,
        };
    },
    computed: {
        chartOptions() {
            return {
                responsive: true,
                maintainAspectRatio: false,
                onResize: (chart) => {
                    chart.canvas.parentNode.style.position = "relative";
                    if (screen.width < 576) {
                        chart.canvas.parentNode.style.height = "275px";
                    } else if (screen.width < 768) {
                        chart.canvas.parentNode.style.height = "320px";
                    } else if (screen.width < 992) {
                        chart.canvas.parentNode.style.height = "300px";
                    } else {
                        chart.canvas.parentNode.style.height = "250px";
                    }
                },
                layout: {
                    padding: {
                        left: 10,
                        right: 30,
                        top: 30,
                        bottom: 10,
                    },
                },

                elements: {
                    point: {
                        radius: 0,
                        hitRadius: 100,
                    },
                },
                scales: {
                    x: {
                        type: "time",
                        time: {
                            minUnit: "minute",
                            round: "second",
                            tooltipFormat: "YYYY-MM-DD HH:mm:ss",
                            displayFormats: {
                                minute: "HH:mm",
                                hour: "MM-DD HH:mm",
                            },
                        },
                        ticks: {
                            sampleSize: 3,
                            maxRotation: 0,
                            autoSkipPadding: 30,
                            padding: 3,
                        },
                        grid: {
                            color: this.$root.theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                            offset: false,
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.$t("value"),
                        },
                        offset: false,
                        grid: {
                            color: this.$root.theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                        },
                    },
                },
                bounds: "ticks",
                plugins: {
                    tooltip: {
                        mode: "nearest",
                        intersect: false,
                        padding: 10,
                        backgroundColor: this.$root.theme === "light" ? "rgba(212,232,222,1.0)" : "rgba(32,42,38,1.0)",
                        bodyColor: this.$root.theme === "light" ? "rgba(12,12,18,1.0)" : "rgba(220,220,220,1.0)",
                        titleColor: this.$root.theme === "light" ? "rgba(12,12,18,1.0)" : "rgba(220,220,220,1.0)",
                        callbacks: {
                            label: (context) => {
                                const label = context.dataset.label;
                                return `${label} ${new Intl.NumberFormat().format(context.parsed.y)}`;
                            },
                        },
                    },
                    legend: {
                        display: true,
                        position: "top",
                        align: "start",
                        onHover: function (event, legendItem, legend) {
                            if (legend && legend.chart && legend.chart.canvas) {
                                legend.chart.canvas.style.cursor = "pointer";
                            }
                        },
                        onLeave: function (event, legendItem, legend) {
                            if (legend && legend.chart && legend.chart.canvas) {
                                legend.chart.canvas.style.cursor = "";
                            }
                        },
                        labels: {
                            color: this.$root.theme === "light" ? "rgba(12,12,18,1.0)" : "rgba(220,220,220,1.0)",
                        },
                    },
                },
            };
        },
        chartData() {
            if (!this.chartRawData || this.chartRawData.length === 0) {
                return {
                    datasets: [],
                };
            }

            let valueData = [];
            let minData = [];
            let maxData = [];

            // Find min and max values for highlighting
            const values = this.chartRawData.map((d) => d.value);
            const minValue = Math.min(...values);
            const maxValue = Math.max(...values);

            for (const datapoint of this.chartRawData) {
                const x = this.$root.unixToDateTime(datapoint.timestamp);

                valueData.push({
                    x,
                    y: datapoint.value,
                });

                // Mark min/max values
                if (datapoint.value === minValue) {
                    minData.push({
                        x,
                        y: datapoint.value,
                    });
                } else {
                    minData.push({
                        x,
                        y: null,
                    });
                }

                if (datapoint.value === maxValue) {
                    maxData.push({
                        x,
                        y: datapoint.value,
                    });
                } else {
                    maxData.push({
                        x,
                        y: null,
                    });
                }
            }

            return {
                datasets: [
                    {
                        // Main value line
                        data: valueData,
                        fill: "origin",
                        tension: 0.2,
                        borderColor: "#4ABF74",
                        backgroundColor: "#4ABF7438",
                        yAxisID: "y",
                        label: this.$t("value"),
                    },
                    {
                        // Maximum values (red background)
                        data: maxData,
                        fill: false,
                        tension: 0,
                        borderColor: "#dc3545",
                        backgroundColor: "#dc354580",
                        pointBackgroundColor: "#dc3545",
                        pointBorderColor: "#dc3545",
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: "y",
                        label: this.$t("maxValue"),
                    },
                    {
                        // Minimum values (red background)
                        data: minData,
                        fill: false,
                        tension: 0,
                        borderColor: "#dc3545",
                        backgroundColor: "#dc354580",
                        pointBackgroundColor: "#dc3545",
                        pointBorderColor: "#dc3545",
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: "y",
                        label: this.$t("minValue"),
                    },
                ],
            };
        },
    },
    watch: {
        chartPeriodHrs: function (newPeriod) {
            if (this.chartDataFetchInterval) {
                clearInterval(this.chartDataFetchInterval);
                this.chartDataFetchInterval = null;
            }

            this.loading = true;

            let period;
            try {
                period = parseInt(newPeriod);
            } catch (e) {
                period = 24;
            }

            this.$root.getMonitorNumericHistory(this.monitorId, period, (res) => {
                if (!res.ok) {
                    this.$root.toastError(res.msg);
                } else {
                    this.chartRawData = res.data;
                }
                this.loading = false;
            });

            this.chartDataFetchInterval = setInterval(
                () => {
                    this.$root.getMonitorNumericHistory(this.monitorId, period, (res) => {
                        if (res.ok) {
                            this.chartRawData = res.data;
                        }
                    });
                },
                5 * 60 * 1000
            );
        },
    },
    created() {
        // Load chart period from storage if saved
        let period = this.$root.storage()["numeric-chart-period"];
        if (period != null) {
            if (typeof period !== "string") {
                period = period.toString();
            }
            this.chartPeriodHrs = period;
        } else {
            this.chartPeriodHrs = "24";
        }
    },
    mounted() {
        // Trigger initial data fetch
        this.loading = true;
        const period = parseInt(this.chartPeriodHrs) || 24;

        this.$root.getMonitorNumericHistory(this.monitorId, period, (res) => {
            if (!res.ok) {
                this.$root.toastError(res.msg);
            } else {
                this.chartRawData = res.data;
            }
            this.loading = false;
        });

        this.chartDataFetchInterval = setInterval(
            () => {
                this.$root.getMonitorNumericHistory(this.monitorId, period, (res) => {
                    if (res.ok) {
                        this.chartRawData = res.data;
                    }
                });
            },
            5 * 60 * 1000
        );
    },
    beforeUnmount() {
        if (this.chartDataFetchInterval) {
            clearInterval(this.chartDataFetchInterval);
        }
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.period-options {
    padding: 0.1em 1em;
    margin-bottom: -1.2em;
    float: right;
    position: relative;
    z-index: 10;

    .dropdown-menu {
        padding: 0;
        min-width: 50px;
        font-size: 0.9em;

        .dark & {
            background: $dark-bg;
        }

        .dropdown-item {
            border-radius: 0.3rem;
            padding: 2px 16px 4px;

            .dark & {
                background: $dark-bg;
                color: $dark-font-color;
            }

            .dark &:hover {
                background: $dark-font-color;
                color: $dark-font-color2;
            }
        }

        .dark & .dropdown-item.active {
            background: $primary;
            color: $dark-font-color2;
        }
    }

    .btn-period-toggle {
        padding: 2px 15px;
        background: transparent;
        border: 0;
        color: $link-color;
        opacity: 0.7;
        font-size: 0.9em;

        &::after {
            vertical-align: 0.155em;
        }

        .dark & {
            color: $dark-font-color;
        }
    }
}

.chart-wrapper {
    margin-bottom: 0.5em;

    &.loading {
        filter: blur(10px);
    }
}
</style>

