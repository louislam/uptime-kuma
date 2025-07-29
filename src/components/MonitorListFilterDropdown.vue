<template>
    <div tabindex="-1" class="dropdown" @focusin="open = true" @focusout="handleFocusOut">
        <button type="button" class="filter-dropdown-status" :class="{ 'active': filterActive }" tabindex="0">
            <div class="px-1 d-flex align-items-center">
                <slot name="status"></slot>
            </div>
            <span class="px-1">
                <font-awesome-icon icon="angle-down" />
            </span>
        </button>
        <ul class="filter-dropdown-menu" :class="{ 'open': open }">
            <slot name="dropdown"></slot>
        </ul>
    </div>
</template>

<script>

export default {
    components: {

    },
    props: {
        filterActive: {
            type: Boolean,
            required: true,
        }
    },
    data() {
        return {
            open: false
        };
    },
    methods: {
        handleFocusOut(e) {
            if (e.relatedTarget != null && this.$el.contains(e.relatedTarget)) {
                return;
            }
            this.open = false;
        }
    }
};
</script>

<style lang="scss">
@import "../assets/vars.scss";
@import "../assets/app.scss";

.filter-dropdown-menu {
    z-index: 100;
    transition: all 0.2s;
    padding: 5px 0 !important;
    border-radius: 16px;
    overflow: hidden;

    position: absolute;
    inset: 0 auto auto 0;
    margin: 0;
    transform: translate(0, 36px);
    box-shadow: 0 15px 70px rgba(0, 0, 0, 0.1);
    visibility: hidden;
    list-style: none;
    height: 0;
    opacity: 0;
    background: white;

    &.open {
        height: unset;
        visibility: inherit;
        opacity: 1;
    }

    .dropdown-item {
        padding: 5px 15px;
    }

    .dropdown-item:focus {
        background: $highlight-white;

        .dark & {
            background: $dark-bg2;
        }
    }

    .dark & {
        background-color: $dark-bg;
        color: $dark-font-color;
        border-color: $dark-border-color;

        .dropdown-item {
            color: $dark-font-color;

            &.active {
                color: $dark-font-color2;
                background-color: $highlight !important;
            }

            &:hover {
                background-color: $dark-bg2;
            }
        }
    }
}

.filter-dropdown-status {
    @extend .btn-outline-normal;
    display: flex;
    align-items: center;
    margin-left: 5px;
    color: $link-color;

    .dark & {
        color: $dark-font-color;
    }

    &:focus {
        background-color: $highlight-white;

        .dark & {
            background-color: $dark-font-color2;
        }
    }

    &.active {
        border: 1px solid $highlight;
        background-color: $highlight-white;

        .dark & {
            background-color: $dark-font-color2;
        }
    }
}

.filter-active {
    color: $highlight;
}
</style>
