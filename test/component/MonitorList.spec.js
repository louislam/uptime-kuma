import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MonitorList from "../../src/components/MonitorList.vue";
import MonitorListItem from "../../src/components/MonitorListItem.vue";

// Mock child components
vi.mock("../../src/components/MonitorListItem.vue", {
    default: {
        name: "MonitorListItem",
        template: "<div class=\"monitor-list-item\"></div>"
    }
});

describe("MonitorList.vue", () => {
    let wrapper;
    const mockMonitors = [
        {
            id: 1,
            name: "Test Monitor 1",
            type: "http",
            status: "up",
            url: "https://example.com"
        },
        {
            id: 2,
            name: "Test Monitor 2",
            type: "ping",
            status: "down",
            hostname: "example.org"
        }
    ];

    beforeEach(() => {
        wrapper = mount(MonitorList, {
            props: {
                monitors: mockMonitors,
                activeMonitor: null,
                showTags: true,
                showStatus: true,
                showPing: true,
                showAverage: true
            },
            global: {
                stubs: {
                    MonitorListItem: true
                }
            }
        });
    });

    it("renders monitor list items", () => {
        const items = wrapper.findAllComponents(MonitorListItem);
        expect(items).toHaveLength(mockMonitors.length);
    });

    it("emits select-monitor event when monitor is clicked", async () => {
        const items = wrapper.findAll(".monitor-list-item");
        await items[0].trigger("click");

        expect(wrapper.emitted("select-monitor")).toBeTruthy();
        expect(wrapper.emitted("select-monitor")[0]).toEqual([mockMonitors[0]]);
    });

    it("applies active class to selected monitor", async () => {
        await wrapper.setProps({
            activeMonitor: mockMonitors[0]
        });

        const items = wrapper.findAll(".monitor-list-item");
        expect(items[0].classes()).toContain("active");
        expect(items[1].classes()).not.toContain("active");
    });

    it("filters monitors based on search text", async () => {
        const searchInput = wrapper.find("input[type=\"search\"]");
        await searchInput.setValue("Test Monitor 1");

        const items = wrapper.findAllComponents(MonitorListItem);
        expect(items).toHaveLength(1);
    });

    it("sorts monitors by status", async () => {
        const sortButton = wrapper.find(".sort-status");
        await sortButton.trigger("click");

        const items = wrapper.findAllComponents(MonitorListItem);
        const firstMonitorProps = items[0].props();
        expect(firstMonitorProps.monitor.status).toBe("down");
    });

    it("toggles visibility of columns", async () => {
        await wrapper.setProps({
            showPing: false,
            showAverage: false
        });

        expect(wrapper.find(".ping-column").exists()).toBe(false);
        expect(wrapper.find(".average-column").exists()).toBe(false);
    });
});
