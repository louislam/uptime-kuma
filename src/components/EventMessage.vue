<template>
    <details v-if="displayMessage" class="event-message-disclosure">
        <summary class="event-message-summary" :title="displayMessage">
            <span class="event-message-summary-text">{{ displayMessage }}</span>
        </summary>
        <pre class="event-message-full">{{ displayMessage }}</pre>
    </details>
</template>

<script>
export default {
    props: {
        message: {
            type: [String, Number],
            default: "",
        },
    },

    computed: {
        displayMessage() {
            if (this.message === null || this.message === undefined) {
                return "";
            }
            return String(this.message);
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.event-message-disclosure {
    width: 100%;
    min-width: 0;
}

.event-message-summary {
    cursor: pointer;
    list-style-position: outside;
}

.event-message-summary::marker {
    color: $secondary-text;
}

.event-message-summary-text {
    display: inline-block;
    max-width: calc(100% - 1.25rem);
    overflow: hidden;
    text-overflow: ellipsis;
    vertical-align: bottom;
    white-space: nowrap;
}

.event-message-full {
    max-height: 240px;
    margin: 6px 0 0 1.25rem;
    overflow: auto;
    overflow-wrap: anywhere;
    font: inherit;
    white-space: pre-wrap;
}
</style>
