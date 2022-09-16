<template>
    <div class="plugin-item pt-4 pb-2">
        <div>
            <h6>{{ plugin.name }}</h6>
            <p class="description">
                {{ plugin.description }}
            </p>
            <span class="version">{{ $t("Version") }}: {{ plugin.version }}</span>
        </div>
        <div class="buttons">
            <button class="btn btn-primary">Install</button>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        plugin: {
            type: Object,
            required: true,
        },
    }
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.plugin-item {
    display: flex;
    justify-content: space-between;
    align-content: center;
    align-items: center;

    .description {
        font-size: 13px;
        margin-bottom: 0;
    }

    .version {
        font-size: 13px;
    }
}
</style>
