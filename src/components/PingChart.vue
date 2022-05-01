<template>
    <div>
        <div class="period-options">
            <button type="button" class="btn btn-light dropdown-toggle btn-period-toggle" data-bs-toggle="dropdown" aria-expanded="false">
                {{ chartPeriodOptions[chartPeriodHrs] }}&nbsp;
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
                <li v-for="(item, key) in chartPeriodOptions" :key="key">
                    <a class="dropdown-item" :class="{ active: chartPeriodHrs == key }" href="#" @click="chartPeriodHrs = key">{{ item }}</a>
                </li>
            </ul>
        </div>
        <div class="chart-wrapper" :class="{ loading : loading}">
            <LineChart :chart-data="chartData" :options="chartOptions" />
        </div>
    </div>
</template>

<script lang="ts">
import { BarController, BarElement, Chart, Filler, LinearScale, LineController, LineElement, PointElement, TimeScale, Tooltip } from "chart.js";
import "chartjs-adapter-dayjs";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { LineChart } from "vue-chart-3";
import { useToast } from "vue-toastification";
import { DOWN, log } from "../util.ts";

dayjs.extend(utc);
dayjs.extend(timezone);
const toast = useToast();

Chart.register(LineController, BarController, LineElement, PointElement, TimeScale, BarElement, LinearScale, Tooltip, Filler);

export default {
    components: { LineChart },
    props: {
        monitorId: {
            type: Number,
            required: true,
        },
    },
    data() {
        return {

            loading: false,

            // Configurable filtering on top of the returned data
            chartPeriodHrs: 0,

            chartPeriodOptions: {
                0: this.$t("recent"),
                3: "3h",
                6: "6h",
                24: "24h",
                168: "1w",
            },

            // A heartbeatList for 3h, 6h, 24h, 1w
            // Uses the $root.heartbeatList when value is null
            heartbeatList: null
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
                        // Hide points on chart unless mouse-over
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
                            }
                        },
                        ticks: {
                            maxRotation: 0,
                            autoSkipPadding: 30,
                        },
                        grid: {
                            color: this.$root.theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                            offset: false,
                        },
                    },
                    y: {
                        title: {
                            display: true,
                            text: this.$t("respTime"),
                        },
                        offset: false,
                        grid: {
                            color: this.$root.theme === "light" ? "rgba(0,0,0,0.1)" : "rgba(255,255,255,0.1)",
                        },
                    },
                    y1: {
                        display: false,
                        position: "right",
                        grid: {
                            drawOnChartArea: false,
                        },
                        min: 0,
                        max: 1,
                        offset: false,
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
                        filter: function (tooltipItem) {
                            return tooltipItem.datasetIndex === 0;  // Hide tooltip on Bar Chart
                        },
                        callbacks: {
                            label: (context) => {
                                return ` ${new Intl.NumberFormat().format(context.parsed.y)} ms`;
                            },
                        }
                    },
                    legend: {
                        display: false,
                    },
                },
            };
        },
        chartData() {
            let pingData = [];  // Ping Data for Line Chart, y-axis contains ping time
            let downData = [];  // Down Data for Bar Chart, y-axis is 1 if target is down, 0 if target is up

            let heartbeatList = this.heartbeatList ||
             (this.monitorId in this.$root.heartbeatList && this.$root.heartbeatList[this.monitorId]) ||
             [];

            heartbeatList
                .filter(
                    // Filtering as data gets appended
                    // not the most efficient, but works for now
                    (beat) => dayjs.utc(beat.time).tz(this.$root.timezone).isAfter(
                        dayjs().subtract(Math.max(this.chartPeriodHrs, 6), "hours")
                    )
                )
                .map((beat) => {
                    const x = this.$root.datetime(beat.time);
                    pingData.push({
                        x,
                        y: beat.ping,
                    });
                    downData.push({
                        x,
                        y: beat.status === DOWN ? 1 : 0,
                    });
                });

            return {
                datasets: [
                    {
                        // Line Chart
                        data: pingData,
                        fill: "origin",
                        tension: 0.2,
                        borderColor: "#5CDD8B",
                        backgroundColor: "#5CDD8B38",
                        yAxisID: "y",
                    },
                    {
                        // Bar Chart
                        type: "bar",
                        data: downData,
                        borderColor: "#00000000",
                        backgroundColor: "#DC354568",
                        yAxisID: "y1",
                        barThickness: "flex",
                        barPercentage: 1,
                        categoryPercentage: 1,
                    },
                ],
            };
        },
    },
    watch: {
        // Update chart data when the selected chart period changes
        chartPeriodHrs: function (newPeriod) {

            // eslint-disable-next-line eqeqeq
            if (newPeriod == "0") {
                this.heartbeatList = null;
                this.$root.storage().removeItem(`chart-period-${this.monitorId}`);
            } else {
                this.loading = true;

                this.$root.getMonitorBeats(this.monitorId, newPeriod, (res) => {
                    if (!res.ok) {
                        toast.error(res.msg);
                    } else {
                        this.heartbeatList = res.data;
                        this.$root.storage()[`chart-period-${this.monitorId}`] = newPeriod;
                    }
                    this.loading = false;
                });
            }
        }
    },
    created() {
        // Setup Watcher on the root heartbeatList,
        // And mirror latest change to this.heartbeatList
        this.$watch(() => this.$root.heartbeatList[this.monitorId],
            (heartbeatList) => {

                log.debug("ping_chart", `this.chartPeriodHrs type ${typeof this.chartPeriodHrs}, value: ${this.chartPeriodHrs}`);

                // eslint-disable-next-line eqeqeq
                if (this.chartPeriodHrs != "0") {
                    const newBeat = heartbeatList.at(-1);
                    if (newBeat && dayjs.utc(newBeat.time) > dayjs.utc(this.heartbeatList.at(-1)?.time)) {
                        this.heartbeatList.push(heartbeatList.at(-1));
                    }
                }
            },
            { deep: true }
        );

        // Load chart period from storage if saved
        let period = this.$root.storage()[`chart-period-${this.monitorId}`];
        if (period != null) {
            this.chartPeriodHrs = Math.min(period, 6);
        }
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.form-select {
    width: unset;
    display: inline-flex;
}

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
