<template>
    <div class="my-3 py-3">
        <h5 @click="isOpen = !isOpen">
            <div
                class="
                    w-50
                    d-flex
                    justify-content-between
                    align-items-center
                    pe-2
                "
            >
                <span class="pb-2">{{ heading }}</span>
                <font-awesome-icon
                    icon="chevron-down"
                    class="animated"
                    :class="{ open: isOpen }"
                />
            </div>
        </h5>
        <transition name="slide-fade-up">
            <div v-if="isOpen" class="mt-3">
                <slot></slot>
            </div>
        </transition>
    </div>
</template>

<script>
export default {
    props: {
        /** Heading of the section */
        heading: {
            type: String,
            default: "",
        },
        /** Should the section be open by default? */
        defaultOpen: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            isOpen: this.defaultOpen,
        };
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

h5::after {
    content: "";
    display: block;
    width: 50%;
    padding-top: 8px;
    border-bottom: 1px solid $dark-border-color;
}

.open {
    transform: rotate(180deg);
}

.animated {
    transition: all 0.2s $easing-in;
}
</style>
