<template>
    <Confirm
        ref="confirm"
        :show-checkbox="true"
        v-bind="$attrs"
        @yes="handleYes"
        @no="handleNo"
    >
        <slot />
    </Confirm>
</template>

<script>
import Confirm from "./Confirm.vue";

export default {
    components: {
        Confirm,
    },
    props: {
        settingsKey: {
            type: String,
            required: true,
        },
    },
    emits: [ "yes", "no" ],
    methods: {
        /**
         * Show the confirm dialog
         * @returns {void}
         */
        show() {
            if (this.$root.info && this.$root.info[this.settingsKey]) {
                this.$emit("yes", true);
                return;
            }
            this.$refs.confirm.show();
        },
        /**
         * Handle yes button click
         * @param {boolean} doNotShowAgain Whether "Do not show again" was checked
         * @returns {void}
         */
        handleYes(doNotShowAgain) {
            if (doNotShowAgain) {
                this.$root.getSocket().emit("setSettings", {
                    [this.settingsKey]: true
                }, "", (res) => {
                    if (res.ok && this.$root.info) {
                        this.$root.info[this.settingsKey] = true;
                    }
                });
            }
            this.$emit("yes", doNotShowAgain);
        },
        /**
         * Handle no button click
         * @returns {void}
         */
        handleNo() {
            this.$emit("no");
        }
    },
};
</script>
