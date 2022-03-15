<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">
                {{ $t("Add New Status Page") }}
            </h1>

            <div class="shadow-box">
                <div class="my-3">
                    <label for="name" class="form-label">{{ $t("Status Page Name") }}</label>
                    <input id="name" v-model="statusPage.basic_auth_user" type="text" class="form-control">
                </div>

                <div class="my-3">
                    <label for="basicauth" class="form-label">{{ $t("Password") }}</label>
                    <input id="basicauth-pass" v-model="statusPage.basic_auth_pass" type="password" autocomplete="new-password" class="form-control" :placeholder="$t('Password')">
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

            }
        };
    }
};
</script>

