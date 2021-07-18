<template>
    <div class="form-container">
        <div class="form">
            <form @submit.prevent="submit">

                <h1 class="h3 mb-3 fw-normal"></h1>

                <div class="form-floating">
                    <input type="text" class="form-control" id="floatingInput" placeholder="Username" v-model="username">
                    <label for="floatingInput">Username</label>
                </div>

                <div class="form-floating mt-3">
                    <input type="password" class="form-control" id="floatingPassword" placeholder="Password" v-model="password">
                    <label for="floatingPassword">Password</label>
                </div>

                <div class="form-check mb-3 mt-3 d-flex justify-content-center">
                    <div class="form-check">
                        <input type="checkbox" value="remember-me" class="form-check-input" id="remember" v-model="$root.remember">

                        <label class="form-check-label" for="remember">
                            Remember me
                        </label>
                    </div>
                </div>
                <button class="w-100 btn btn-primary" type="submit" :disabled="processing">Login</button>

                <div class="alert alert-danger mt-3" role="alert" v-if="res && !res.ok">
                    {{ res.msg }}
                </div>
            </form>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",

            res: null,
        }
    },
    methods: {
        submit() {
            this.processing = true;
            this.$root.login(this.username, this.password, (res) => {
                this.processing = false;
                this.res = res;
            })
        }
    }
}
</script>

<style scoped>

.form-container {
    display: flex;
    align-items: center;
    padding-top: 40px;
    padding-bottom: 40px;
}

.form {

    width: 100%;
    max-width: 330px;
    padding: 15px;
    margin: auto;
    text-align: center;
}
</style>
