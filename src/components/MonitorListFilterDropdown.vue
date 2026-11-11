<template>
    <div tabindex="-1" class="dropdown" @focusin="openMenu" @focusout="handleFocusOut">
        <button
            type="button"
            class="filter-dropdown-status"
            :class="{ active: filterActive }"
            tabindex="0"
            :data-testid="testId"
        >
            <div class="px-1 d-flex align-items-center">
                <slot name="status"></slot>
            </div>
            <span class="px-1">
                <font-awesome-icon icon="angle-down" />
            </span>
        </button>
        <ul class="filter-dropdown-menu" :class="{ open: open }">
            <slot name="dropdown"></slot>
        </ul>
    </div>
</template>

<script>
export default {
    components: {},
    props: {
        filterActive: {
            type: Boolean,
            required: true,
        },
        testId: {
            type: String,
            default: undefined,
        },
    },
    emits: ["openMenu"],
    data() {
        return {
            open: false,
        };
    },
    methods: {
        openMenu() {
            this.$emit("openMenu");
            this.open = true;
        },

        handleFocusOut(e) {
            if (e.relatedTarget != null && this.$el.contains(e.relatedTarget)) {
                return;
            }
            this.open = false;
        },
    },
};
</script>

<style lang="scss">
.filter-dropdown-menu {
    z-index: 100;
    padding: var(--space-1) 0 !important;
    border: var(--stroke) solid var(--border-strong);
    border-radius: var(--radius-md);
    overflow: hidden;

    position: absolute;
    inset: 0 auto auto 0;
    margin: 0;
    transform: translate(0, 36px);
    visibility: hidden;
    list-style: none;
    height: 0;
    opacity: 0;
    color: var(--text);
    background: var(--bg-raised);

    &.open {
        height: unset;
        visibility: inherit;
        opacity: 1;
    }

    .dropdown-item:focus {
        background: var(--bg-hover);
    }
}

.filter-dropdown-status {
    display: flex;
    align-items: center;
    min-height: var(--control-sm);
    margin-left: 0;
    padding: 0 var(--space-2);
    color: var(--text);
    background-color: transparent;
    border: var(--stroke) solid var(--border-strong);
    border-radius: var(--radius-md);

    &:focus {
        background-color: var(--bg-hover);
    }

    &.active {
        background-color: var(--bg-selected);
    }
}

.filter-active {
    color: var(--accent-text);
}
</style>
