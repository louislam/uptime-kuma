<template>
    <div
        class="tag-wrapper rounded d-inline-flex"
        :class="{ 'px-3': size == 'normal',
                  'py-1': size == 'normal',
                  'm-2': size == 'normal',
                  'px-2': size == 'sm',
                  'py-0': size == 'sm',
                  'm-1': size == 'sm',
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
export default {
    props: {
        item: {
            type: Object,
            required: true,
        },
        remove: {
            type: Function,
            default: null,
        },
        size: {
            type: String,
            default: "normal",
        }
    },
    computed: {
        displayText() {
            if (this.item.value === "") {
                return this.item.name;
            } else {
                return `${this.item.name}: ${this.item.value}`;
            }
        }
    }
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

.btn-remove {
    font-size: 0.9em;
    line-height: 24px;
    opacity: 0.3;
}

.btn-remove:hover {
    opacity: 1;
}
</style>
