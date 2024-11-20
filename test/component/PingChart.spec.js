import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PingChart from "../../src/components/PingChart.vue";
import { Line } from "vue-chartjs";

// Mock Chart.js components
vi.mock("vue-chartjs", () => ({
    Line: {
        name: "Line",
        template: "<canvas></canvas>"
    }
}));

describe("PingChart.vue", () => {
    let wrapper;
    const mockData = {
        labels: ["12:00", "12:01", "12:02"],
        datasets: [{
            label: "Ping",
            data: [100, 150, 120],
            borderColor: "#42b983",
            tension: 0.3
        }]
    };

    const mockOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: "Response Time (ms)"
                }
            }
        }
    };

    beforeEach(() => {
        wrapper = mount(PingChart, {
            props: {
                chartData: mockData,
                options: mockOptions
            },
            global: {
                stubs: {
                    Line: true
                }
            }
        });
    });

    it("renders the chart component", () => {
        expect(wrapper.findComponent(Line).exists()).toBe(true);
    });

    it("passes correct data to chart component", () => {
        const chart = wrapper.findComponent(Line);
        expect(chart.props("data")).toEqual(mockData);
    });

    it("passes correct options to chart component", () => {
        const chart = wrapper.findComponent(Line);
        expect(chart.props("options")).toEqual(mockOptions);
    });

    it("updates chart when data changes", async () => {
        const newData = {
            labels: ["12:03", "12:04"],
            datasets: [{
                label: "Ping",
                data: [130, 140],
                borderColor: "#42b983",
                tension: 0.3
            }]
        };

        await wrapper.setProps({ chartData: newData });
        const chart = wrapper.findComponent(Line);
        expect(chart.props("data")).toEqual(newData);
    });

    it("handles empty data gracefully", async () => {
        const emptyData = {
            labels: [],
            datasets: [{
                label: "Ping",
                data: [],
                borderColor: "#42b983",
                tension: 0.3
            }]
        };

        await wrapper.setProps({ chartData: emptyData });
        const chart = wrapper.findComponent(Line);
        expect(chart.props("data")).toEqual(emptyData);
    });

    it("applies custom styling options", async () => {
        const customOptions = {
            ...mockOptions,
            plugins: {
                legend: {
                    display: false
                }
            }
        };

        await wrapper.setProps({ options: customOptions });
        const chart = wrapper.findComponent(Line);
        expect(chart.props("options")).toEqual(customOptions);
    });
});
