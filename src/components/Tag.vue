<template>
    <div
        class="tag-wrapper rounded d-inline-flex"
        :class="{
            'px-3': size == 'normal',
            'py-1': size == 'normal',
            'm-2': size == 'normal',
            'px-2': size == 'sm',
            'py-0': size == 'sm',
            'tag-scrollable': scrollable,
            'tag-constrained': constrained,
        }"
        :style="{ backgroundColor: item.color, fontSize: size == 'sm' ? '0.7em' : '1em' }"
    >
        <span class="tag-text">{{ displayText }}</span>
        <span v-if="remove != null" class="ps-1 btn-remove" @click="remove(item)">
            <font-awesome-icon icon="times" />
        </span>
    </div>
</template>

<script>
/**
 * @typedef {import('./TagsManager.vue').Tag} Tag
 */

export default {
    props: {
        /**
         * Object representing tag
         * @type {Tag}
         */
        item: {
            type: Object,
            required: true,
        },
        /** Function to remove tag */
        remove: {
            type: Function,
            default: null,
        },
        /**
         * Size of tag
         * @type {"normal" | "small"}
         */
        size: {
            type: String,
            default: "normal",
        },
        /**
         * Whether the tag text should be horizontally scrollable
         * instead of truncated with ellipsis.
         */
        scrollable: {
            type: Boolean,
            default: false,
        },
        /**
         * Whether the tag should be constrained to its parent's width.
         */
        constrained: {
            type: Boolean,
            default: false,
        },
    },
    computed: {
        displayText() {
            if (this.item.value === "" || this.item.value === undefined || this.item.value === null) {
                return this.item.name;
            } else {
                return `${this.item.name}: ${this.item.value}`;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
.tag-wrapper {
    color: white;
    opacity: 0.85;

    .dark & {
        opacity: 1;
    }
}

.tag-text {
    padding-bottom: 1px !important;
    text-overflow: ellipsis;
    overflow: hidden;
    white-space: nowrap;
}

.tag-constrained {
    max-width: 100%;

    .tag-text {
        max-width: 100%;
    }
}

.tag-scrollable .tag-text {
    overflow: auto;
    text-overflow: clip;
    scrollbar-width: none;
    display: inline-block;
    -ms-overflow-style: none;

    &::-webkit-scrollbar {
        width: 0;
        height: 0;
        display: none;
    }
}

.btn-remove {
    font-size: 0.9em;
    line-height: 24px;
    opacity: 0.3;
}

.btn-remove:hover {
    opacity: 1;
}
</style>
