<template>
    <div>
        <div class="period-options">
            {{ $t("show") }}: <select id="chart-period-select" v-model="chartPeriodHrs" class="form-select form-select-sm ms-1">
                <option value="0">{{ $t("recent") }}</option>
                <option value="3">3h</option>
                <option value="6">6h</option>
                <option value="24">24h</option>
                <option value="168">1w</option>
            </select>
        </div>
        <div class="chart-wrapper">
            <LineChart :chart-data="chartData" :options="chartOptions" />
        </div>
    </div>
</template>

<script>
import { BarController, BarElement, Chart, Filler, LinearScale, LineController, LineElement, PointElement, TimeScale, Tooltip } from "chart.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "chartjs-adapter-dayjs";
import { LineChart } from "vue-chart-3";
import { useToast } from "vue-toastification";

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
            // Configurable filtering on top of the returned data
            chartPeriodHrs: 0,

            // Just Draft:
            // A heartbeatList for 3h, 6h, 24h, 1w
            // Set it to null, switch back to realtime (last 100 beats)
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
            if (this.monitorId in this.$root.heartbeatList) {
                this.$root.heartbeatList[this.monitorId]
                    .filter(
                        (beat) => dayjs.utc(beat.time).tz(this.$root.timezone).isAfter(dayjs().subtract(Math.max(this.chartPeriodHrs, 6), "hours")))
                    .map((beat) => {
                        const x = this.$root.datetime(beat.time);
                        pingData.push({
                            x,
                            y: beat.ping,
                        });
                        downData.push({
                            x,
                            y: beat.status === 0 ? 1 : 0,
                        });
                    });
            }
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
        chartPeriodHrs: function (newPeriod) {
            if (newPeriod == "0") {
                newPeriod = null;
            }
            this.$root.getMonitorBeats(this.monitorId, newPeriod, (res) => {
                if (!res.ok) {
                    toast.error(res.msg);
                }
            });
        }
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.form-select {
    width: unset;
    display: inline-flex;
}

.period-options {
    padding: 0.3em 1.5em;
    margin-bottom: -1.5em;
    float: right;
    position: relative;
    z-index: 10;
    font-size: 0.8em;
}

.chart-wrapper {
    margin-bottom: 1.5em;
}
</style>
