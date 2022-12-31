<template>
    <transition name="slide-fade" appear>
        <div>
            <h1 class="mb-3">{{ $t("addSubUser") }}</h1>
            <form @submit.prevent="submit">
                <div class="shadow-box">
                    <div class="row">
                        <div class="col-xl-10">
                            <!-- Username -->
                            <div class="mb-3">
                                <label for="name" class="form-label">{{ $t("Username") }}</label>
                                <input
                                    id="name" v-model="username" type="text" class="form-control"
                                    required
                                >
                            </div>          
                            <!-- Password -->
                            <div class="mb-3">
                                <label for="name" class="form-label">{{ $t("Password") }}</label>
                                <input
                                    id="name" v-model="password" type="text" class="form-control"
                                    required
                                >
                            </div>   
                            <!-- Repeat Password -->
                            <div class="mb-3">
                                <label for="name" class="form-label">{{ $t("Repeat Password") }}</label>
                                <input
                                    id="name" v-model="repeatPassword" type="text" class="form-control"
                                    required
                                >
                            </div>                                                            
                            <div class="mt-4 mb-1">
                                <button
                                    id="monitor-submit-btn" class="btn btn-primary" type="submit"
                                    :disabled="processing"
                                >
                                    {{ $t("addSubUser") }}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    </transition>
</template>

<script>

import { useToast } from "vue-toastification";
const toast = useToast();

export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            repeatPassword: "",
        };
    },
    methods: {
        /**
         * Submit form data for processing
         * @returns {void}
         */
        submit() {
            this.processing = true;
            if (this.password !== this.repeatPassword) {
                toast.error(this.$t("PasswordsDoNotMatch"));
                this.processing = false;
                return;
            }
            this.$root.addSubUser(this.username, this.password, (res) => {
                this.processing = true;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.processing = true;
                        this.$router.push("/manage-sub-users");
                }
            });
        },
    },
};

</script>

<style lang="scss" scoped>
.shadow-box {
    padding: 20px;
}

textarea {
    min-height: 150px;
}

.dark-calendar::-webkit-calendar-picker-indicator {
    filter: invert(1);
}

.weekday-picker {
    display: flex;
    gap: 10px;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 40px;

        .form-check-inline {
            margin-right: 0;
        }
    }
}

.day-picker {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;

    & > div {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 40px;

        .form-check-inline {
            margin-right: 0;
        }
    }
}

</style>
