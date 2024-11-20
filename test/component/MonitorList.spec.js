import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import MonitorList from "../../src/components/MonitorList.vue";

// Mock child components
vi.mock("../../src/components/MonitorListItem.vue", {
    default: {
        name: "MonitorListItem",
        template: "<div class=\"monitor-list-item\"></div>"
    }
});

vi.mock("../../src/components/Confirm.vue", {
    default: {
        name: "Confirm",
        template: "<div class=\"confirm-dialog\"></div>"
    }
});

vi.mock("../../src/components/MonitorListFilter.vue", {
    default: {
        name: "MonitorListFilter",
        template: "<div class=\"monitor-list-filter\"></div>"
    }
});

describe("MonitorList.vue", () => {
    let wrapper;
    const mockMonitors = {
        1: {
            id: 1,
            name: "Test Monitor 1",
            type: "http",
            status: "up",
            active: true,
            interval: 60,
            parent: null
        },
        2: {
            id: 2,
            name: "Test Monitor 2",
            type: "ping",
            status: "down",
            active: false,
            interval: 60,
            parent: null
        }
    };

    const mockRouter = {
        push: vi.fn()
    };

    beforeEach(() => {
        wrapper = mount(MonitorList, {
            props: {
                scrollbar: true
            },
            global: {
                mocks: {
                    $t: (key) => key, // Mock translation function
                    $router: mockRouter,
                    $root: {
                        monitorList: mockMonitors
                    }
                },
                provide: {
                    socket: {
                        emit: vi.fn()
                    }
                },
                stubs: {
                    MonitorListItem: {
                        name: "MonitorListItem",
                        template: "<div class='monitor-list-item' :class='{ active: active }' @click='$emit(\"click\")'><slot></slot></div>",
                        props: [ "active" ]
                    },
                    Confirm: true,
                    MonitorListFilter: true,
                    "font-awesome-icon": true,
                    "router-link": true
                }
            }
        });
    });

    it("renders monitor list items", () => {
        const items = wrapper.findAll("[data-testid='monitor-list'] .monitor-list-item");
        expect(items.length).toBe(2);
    });

    it("emits select-monitor event when monitor is clicked", async () => {
        const items = wrapper.findAll("[data-testid='monitor-list'] .monitor-list-item");
        await items[0].trigger("click");
        expect(wrapper.emitted("select-monitor")).toBeTruthy();
        expect(wrapper.emitted("select-monitor")[0]).toEqual([ 1 ]);
    });

    it("applies active class to selected monitor", async () => {
        await wrapper.setData({ selectedMonitorId: 1 });
        const items = wrapper.findAll("[data-testid='monitor-list'] .monitor-list-item");
        expect(items[0].classes()).toContain("active");
        expect(items[1].classes()).not.toContain("active");
    });

    it("filters monitors based on search text", async () => {
        await wrapper.setData({ searchText: "Test Monitor 1" });
        const items = wrapper.findAll("[data-testid='monitor-list'] .monitor-list-item");
        expect(items.length).toBe(1);
    });

    it("sorts monitors by status", async () => {
        await wrapper.setData({ sortBy: "status" });
        const items = wrapper.findAll("[data-testid='monitor-list'] .monitor-list-item");
        expect(items.length).toBe(2);
    });

    it("toggles selection mode", async () => {
        await wrapper.setData({ selectionMode: true });
        const items = wrapper.findAll("[data-testid='monitor-list'] .monitor-list-item");
        expect(items.length).toBe(2);
        expect(wrapper.vm.selectionMode).toBe(true);
    });
});
