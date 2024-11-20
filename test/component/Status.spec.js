import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import Status from "../../src/components/Status.vue";
import { UP, DOWN, PENDING, MAINTENANCE } from "../../src/util";

describe("Status.vue", () => {
    const mountStatus = (status) => {
        return mount(Status, {
            props: {
                status
            }
        });
    };

    it("renders UP status correctly", () => {
        const wrapper = mountStatus(UP);
        expect(wrapper.find(".badge").classes()).toContain("bg-success");
        expect(wrapper.text()).toContain("UP");
    });

    it("renders DOWN status correctly", () => {
        const wrapper = mountStatus(DOWN);
        expect(wrapper.find(".badge").classes()).toContain("bg-danger");
        expect(wrapper.text()).toContain("DOWN");
    });

    it("renders PENDING status correctly", () => {
        const wrapper = mountStatus(PENDING);
        expect(wrapper.find(".badge").classes()).toContain("bg-warning");
        expect(wrapper.text()).toContain("PENDING");
    });

    it("renders MAINTENANCE status correctly", () => {
        const wrapper = mountStatus(MAINTENANCE);
        expect(wrapper.find(".badge").classes()).toContain("bg-info");
        expect(wrapper.text()).toContain("MAINTENANCE");
    });

    it("handles unknown status gracefully", () => {
        const wrapper = mountStatus("UNKNOWN");
        expect(wrapper.find(".badge").classes()).toContain("bg-secondary");
        expect(wrapper.text()).toContain("UNKNOWN");
    });

    it("updates when status prop changes", async () => {
        const wrapper = mountStatus(UP);
        expect(wrapper.find(".badge").classes()).toContain("bg-success");

        await wrapper.setProps({ status: DOWN });
        expect(wrapper.find(".badge").classes()).toContain("bg-danger");
    });
});
