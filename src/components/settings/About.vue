<template>
    <div class="d-flex justify-content-center align-items-center">
        <div class="logo d-flex flex-column justify-content-center align-items-center">
            <object class="my-4" width="200" height="200" data="/icon.svg" />
            <div class="fs-4 fw-bold">Uptime Kuma</div>
            <div>{{ $t("Version") }}: {{ $root.info.version }}</div>
            <div class="my-1 update-link"><a href="https://github.com/louislam/uptime-kuma/releases" target="_blank" rel="noopener">{{ $t("Check Update On GitHub") }}</a></div>
        </div>
    </div>
</template>

<script>
export default {

};
</script>

<style lang="scss" scoped>
.logo {
    margin: 4em 1em;
}
.update-link {
    font-size: 0.9em;
}
</style>
