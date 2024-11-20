import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Status from "../../src/components/Status.vue";
import { UP, DOWN, PENDING, MAINTENANCE } from "../../src/util";

describe("Status.vue", () => {
    const mountStatus = (status) => {
        return mount(Status, {
            props: {
                status
            },
            global: {
                mocks: {
                    $t: (key) => key // Mock translation function
                }
            }
        });
    };

    it("renders UP status correctly", () => {
        const wrapper = mountStatus(UP); // UP status
        expect(wrapper.find(".badge").classes()).toContain("bg-primary");
        expect(wrapper.text()).toBe("Up");
    });

    it("renders DOWN status correctly", () => {
        const wrapper = mountStatus(DOWN); // DOWN status
        expect(wrapper.find(".badge").classes()).toContain("bg-danger");
        expect(wrapper.text()).toBe("Down");
    });

    it("renders PENDING status correctly", () => {
        const wrapper = mountStatus(PENDING); // PENDING status
        expect(wrapper.find(".badge").classes()).toContain("bg-warning");
        expect(wrapper.text()).toBe("Pending");
    });

    it("renders MAINTENANCE status correctly", () => {
        const wrapper = mountStatus(MAINTENANCE); // MAINTENANCE status
        expect(wrapper.find(".badge").classes()).toContain("bg-maintenance");
        expect(wrapper.text()).toBe("statusMaintenance");
    });

    it("handles unknown status gracefully", () => {
        const wrapper = mountStatus(999); // Unknown status
        expect(wrapper.find(".badge").classes()).toContain("bg-secondary");
        expect(wrapper.text()).toBe("Unknown");
    });

    it("updates when status prop changes", async () => {
        const wrapper = mountStatus(UP); // UP status
        expect(wrapper.find(".badge").classes()).toContain("bg-primary");

        await wrapper.setProps({ status: DOWN }); // Change to DOWN status
        expect(wrapper.find(".badge").classes()).toContain("bg-danger");
    });

    it("displays correct status classes", async () => {
        // Test UP status
        const wrapper = mountStatus(UP);
        expect(wrapper.find(".badge").classes()).toContain("bg-primary");

        // Test DOWN status
        await wrapper.setProps({ status: DOWN });
        expect(wrapper.find(".badge").classes()).toContain("bg-danger");

        // Test PENDING status
        await wrapper.setProps({ status: PENDING });
        expect(wrapper.find(".badge").classes()).toContain("bg-warning");

        // Test MAINTENANCE status
        await wrapper.setProps({ status: MAINTENANCE });
        expect(wrapper.find(".badge").classes()).toContain("bg-maintenance");
    });

    it("displays correct status text", async () => {
        // Test UP status
        const wrapper = mountStatus(UP);
        expect(wrapper.text()).toBe("Up");

        // Test DOWN status
        await wrapper.setProps({ status: DOWN });
        expect(wrapper.text()).toBe("Down");

        // Test PENDING status
        await wrapper.setProps({ status: PENDING });
        expect(wrapper.text()).toBe("Pending");

        // Test MAINTENANCE status
        await wrapper.setProps({ status: MAINTENANCE });
        expect(wrapper.text()).toBe("statusMaintenance");
    });
});
