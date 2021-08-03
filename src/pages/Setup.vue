<template>
    <div class="form-container">
        <div class="form">
            <form @submit.prevent="submit">
                <div>
                    <object width="64" height="64" data="/icon.svg" />
                    <div style="font-size: 28px; font-weight: bold; margin-top: 5px;">
                        Uptime Kuma
                    </div>
                </div>

                <p class="mt-3">
                    Create your admin account
                </p>

                <div class="form-floating">
                    <input id="floatingInput" v-model="username" type="text" class="form-control" placeholder="Username" required>
                    <label for="floatingInput">Username</label>
                </div>

                <div class="form-floating mt-3">
                    <input id="floatingPassword" v-model="password" type="password" class="form-control" placeholder="Password" required>
                    <label for="floatingPassword">Password</label>
                </div>

                <div class="form-floating mt-3">
                    <input id="repeat" v-model="repeatPassword" type="password" class="form-control" placeholder="Repeat Password" required>
                    <label for="repeat">Repeat Password</label>
                </div>

                <button class="w-100 btn btn-primary mt-3" type="submit" :disabled="processing">
                    Create
                </button>
            </form>
        </div>
    </div>
</template>

<script>
import { useToast } from "vue-toastification"
const toast = useToast()

export default {
    data() {
        return {
            processing: false,
            username: "",
            password: "",
            repeatPassword: "",
        }
    },
    mounted() {
        this.$root.getSocket().emit("needSetup", (needSetup) => {
            if (! needSetup) {
                this.$router.push("/")
            }
        });
    },
    methods: {
        submit() {
            this.processing = true;

            if (this.password !== this.repeatPassword) {
                toast.error("Repeat password do not match.")
                this.processing = false;
                return;
            }

            this.$root.getSocket().emit("setup", this.username, this.password, (res) => {
                this.processing = false;
                this.$root.toastRes(res)

                if (res.ok) {
                    this.$router.push("/")
                }
            })
        },
    },
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
