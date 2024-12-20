import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import PingChart from "../../src/components/PingChart.vue";
import { Line } from "vue-chartjs";

// Mock Chart.js
vi.mock("chart.js", () => ({
    Chart: vi.fn(),
    registerables: []
}));

// Mock vue-chartjs
vi.mock("vue-chartjs", () => ({
    Line: {
        name: "Line",
        template: "<canvas></canvas>"
    }
}));

describe("PingChart.vue", () => {
    let wrapper;
    const mockMonitorId = 1;
    const monitorList = {
        1: {
            id: 1,
            name: "Test Monitor",
            interval: 60,
            type: "http"
        }
    };

    const mockStorage = {
        "chart-period-1": "24"
    };

    beforeEach(() => {
        wrapper = mount(PingChart, {
            props: {
                monitorId: mockMonitorId
            },
            global: {
                mocks: {
                    $t: (key) => key, // Mock translation function
                    $root: {
                        monitorList,
                        storage: () => mockStorage
                    }
                },
                stubs: {
                    Line: true
                }
            }
        });
    });

    it("renders the chart component", () => {
        expect(wrapper.findComponent(Line).exists()).toBe(true);
    });

    it("initializes with correct period options", () => {
        expect(wrapper.vm.chartPeriodOptions).toEqual({
            0: "recent",
            3: "3h",
            6: "6h",
            24: "24h",
            168: "1w"
        });
    });

    it("updates chart period when option is selected", async () => {
        await wrapper.setData({ chartPeriodHrs: "24" });
        expect(wrapper.vm.chartPeriodHrs).toBe("24");
    });

    it("shows loading state while fetching data", async () => {
        await wrapper.setData({ loading: true });
        expect(wrapper.find(".chart-wrapper").classes()).toContain("loading");
    });

    it("computes correct chart options", () => {
        const options = wrapper.vm.chartOptions;
        expect(options.responsive).toBe(true);
        expect(options.maintainAspectRatio).toBe(false);
        expect(options.scales.x.type).toBe("time");
    });

    it("handles empty chart data gracefully", () => {
        expect(wrapper.vm.chartRawData).toBe(null);
        const chartData = wrapper.vm.chartData;
        expect(chartData.datasets).toBeDefined();
        expect(chartData.datasets.length).toBe(2); // One for ping data, one for status
    });
});
