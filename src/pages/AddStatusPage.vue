<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Add New Status Page") }}
            </h1>

            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="mb-3">
                        <label for="name" class="form-label">{{ $t("Name") }}</label>
                        <input id="name" v-model="title" type="text" class="form-control" required>
                    </div>

                    <div class="mb-4">
                        <label for="slug" class="form-label">{{ $t("Slug") }}</label>
                        <div class="input-group">
                            <span id="basic-addon3" class="input-group-text">/status/</span>
                            <input id="slug" v-model="slug" type="text" class="form-control" required>
                        </div>
                        <div class="form-text">
                            <ul>
                                <li>{{ $t("Accept characters:") }} <mark>a-z</mark> <mark>0-9</mark> <mark>-</mark></li>
                                <i18n-t tag="li" keypath="startOrEndWithOnly">
                                    <mark>a-z</mark> <mark>0-9</mark>
                                </i18n-t>
                                <li>{{ $t("No consecutive dashes") }} <mark>--</mark></li>
                            </ul>
                        </div>
                    </div>

                    <div class="mt-2 mb-1">
                        <button id="monitor-submit-btn" class="btn btn-primary w-100" type="submit" :disabled="processing">{{ $t("Next") }}</button>
                    </div>
                </div>
            </form>
        </div>
    </transition>
</template>

<script>
export default {
    components: {

    },
    data() {
        return {
            title: "",
            slug: "",
            processing: false,
        };
    },
    methods: {
        async submit() {
            this.processing = true;

            this.$root.getSocket().emit("addStatusPage", this.title, this.slug, (res) => {
                this.processing = false;

                if (res.ok) {
                    location.href = "/status/" + this.slug + "?edit";
                } else {

                    if (res.msg.includes("UNIQUE constraint")) {
                        this.$root.toastError(this.$t("The slug is already taken. Please choose another slug."));
                    } else {
                        this.$root.toastRes(res);
                    }

                }
            });
        }
    }
};
</script>

<style lang="scss" scoped>
.shadow-box {
    padding: 20px;
}
</style>
