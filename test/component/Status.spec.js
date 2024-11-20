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
        const wrapper = mountStatus(1); // UP status
        expect(wrapper.find(".badge").classes()).toContain("bg-primary");
        expect(wrapper.text()).toBe("Up");
    });

    it("renders DOWN status correctly", () => {
        const wrapper = mountStatus(0); // DOWN status
        expect(wrapper.find(".badge").classes()).toContain("bg-danger");
        expect(wrapper.text()).toBe("Down");
    });

    it("renders PENDING status correctly", () => {
        const wrapper = mountStatus(2); // PENDING status
        expect(wrapper.find(".badge").classes()).toContain("bg-warning");
        expect(wrapper.text()).toBe("Pending");
    });

    it("renders MAINTENANCE status correctly", () => {
        const wrapper = mountStatus(3); // MAINTENANCE status
        expect(wrapper.find(".badge").classes()).toContain("bg-maintenance");
        expect(wrapper.text()).toBe("statusMaintenance");
    });

    it("handles unknown status gracefully", () => {
        const wrapper = mountStatus(999); // Unknown status
        expect(wrapper.find(".badge").classes()).toContain("bg-secondary");
        expect(wrapper.text()).toBe("Unknown");
    });

    it("updates when status prop changes", async () => {
        const wrapper = mountStatus(1); // UP status
        expect(wrapper.find(".badge").classes()).toContain("bg-primary");

        await wrapper.setProps({ status: 0 }); // Change to DOWN status
        expect(wrapper.find(".badge").classes()).toContain("bg-danger");
    });
});
