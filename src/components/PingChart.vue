<template>
    <LineChart :chart-data="chartData" :options="chartOptions" />
</template>

<script>
import { BarController, BarElement, Chart, Filler, LinearScale, LineController, LineElement, PointElement, TimeScale, Tooltip } from "chart.js";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import "chartjs-adapter-dayjs";
import { LineChart } from "vue-chart-3";
dayjs.extend(utc);
dayjs.extend(timezone);

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
            chartPeriodHrs: 6,
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
                            text: "Resp. Time (ms)",
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
                        filter: function (tooltipItem) {
                            return tooltipItem.datasetIndex === 0;
                        },
                        callbacks: {
                            label: (context) => {
                                return ` ${new Intl.NumberFormat().format(context.parsed.y)} ms`
                            },
                        }
                    },
                    legend: {
                        display: false,
                    },
                },
            }
        },
        chartData() {
            let ping_data = [];
            let down_data = [];
            if (this.monitorId in this.$root.heartbeatList) {
                ping_data = this.$root.heartbeatList[this.monitorId]
                    .filter(
                        (beat) => dayjs.utc(beat.time).tz(this.$root.timezone).isAfter(dayjs().subtract(this.chartPeriodHrs, "hours")))
                    .map((beat) => {
                        return {
                            x: dayjs.utc(beat.time).tz(this.$root.timezone).format("YYYY-MM-DD HH:mm:ss"),
                            y: beat.ping,
                        };
                    });
                down_data = this.$root.heartbeatList[this.monitorId]
                    .filter(
                        (beat) => dayjs.utc(beat.time).tz(this.$root.timezone).isAfter(dayjs().subtract(this.chartPeriodHrs, "hours")))
                    .map((beat) => {
                        return {
                            x: dayjs.utc(beat.time).tz(this.$root.timezone).format("YYYY-MM-DD HH:mm:ss"),
                            y: beat.status === 0 ? 1 : 0,
                        };
                    });
            }
            return {
                datasets: [
                    {
                        data: ping_data,
                        fill: "origin",
                        tension: 0.2,
                        borderColor: "#5CDD8B",
                        backgroundColor: "#5CDD8B38",
                        yAxisID: "y",
                    },
                    {
                        type: "bar",
                        data: down_data,
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
};
</script>
