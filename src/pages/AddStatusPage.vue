<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Add New Status Page") }}
            </h1>

            <div class="shadow-box">
                <div class="mb-3">
                    <label for="name" class="form-label">{{ $t("Name") }}</label>
                    <input id="name" v-model="statusPage.title" type="text" class="form-control">
                </div>

                <div class="mb-4">
                    <label for="slug" class="form-label">{{ $t("Slug") }}</label>
                    <div class="input-group">
                        <span id="basic-addon3" class="input-group-text">/status/</span>
                        <input id="slug" v-model="statusPage.slug" type="text" class="form-control">
                    </div>
                </div>

                <div class="mt-2 mb-1">
                    <button id="monitor-submit-btn" class="btn btn-primary w-100" type="submit" :disabled="processing">{{ $t("Next") }}</button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
export default {
    components: {

    },
    data() {
        return {
            statusPage: {

            },
            processing: false,
        };
    }
};
</script>

<style lang="scss" scoped>
.shadow-box {
    padding: 20px;
}
</style>
