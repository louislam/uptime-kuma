<template>
    <div>
        <ul class="nav nav-tabs">
            <li v-for="(tab, index) in tabs" :key="index" class="nav-item">
                <a
                    class="nav-link"
                    :class="{ active: index == selected }"
                    href="#"
                    @click="$emit('update:selected', index)"
                >
                    {{ tab }}
                </a>
            </li>
        </ul>
    </div>
</template>

<script lang="js">
export default {
    props: {
        tabs: {
            type: Array[String],
            required: true,
        },
        selected: {
            type: Number,
            required: true,
        },
    },
    emits: [ "update:selected" ],
    data() {
        return {};
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.nav-tabs {
    border-bottom: 1px solid $primary;

    .nav-item {
        flex-grow: 1;

        .nav-link {
            text-align: center;
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;

            &.active {
                background-color: $highlight-white;

                .dark & {
                    color: $dark-font-color;
                    background-color: $dark-header-bg;
                }

                border-color: transparent transparent $primary transparent;
                border-width: 1px 1px 6px 1px;
            }

            &:hover {
                .dark & {
                    background-color: $dark-header-bg;
                }
                border-color: $primary;
                border-width: 1px 1px 6px 1px;
            }
        }
    }
}
</style>
