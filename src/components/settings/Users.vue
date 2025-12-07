<template>
    <div>
        <h2 class="mb-3">{{ $t("Users & Access") }}</h2>

        <div class="shadow-box p-3 mb-4">
            <h5 class="mb-3">{{ $t("Add User") }}</h5>
            <div class="row g-2 align-items-end">
                <div class="col-md-4">
                    <label class="form-label">{{ $t("Username") }}</label>
                    <input v-model="form.username" class="form-control" type="text" />
                </div>
                <div class="col-md-4">
                    <label class="form-label">{{ $t("Password") }}</label>
                    <input v-model="form.password" class="form-control" type="password" />
                </div>
                <div class="col-md-3">
                    <label class="form-label">{{ $t("Role") }}</label>
                    <select v-model="form.role" class="form-select">
                        <option value="admin">Admin</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                    </select>
                </div>
                <div class="col-md-1">
                    <button class="btn btn-primary w-100" :disabled="creating" @click="create">
                        <span v-if="creating" class="spinner-border spinner-border-sm" />
                        <span v-else>{{ $t("Add") }}</span>
                    </button>
                </div>
            </div>
        </div>

        <div class="shadow-box p-3">
            <h5 class="mb-3">{{ $t("All Users") }}</h5>
            <div v-if="loading" class="text-muted">{{ $t("Loading") }}...</div>
            <table v-else class="table align-middle">
                <thead>
                    <tr>
                        <th>{{ $t("Username") }}</th>
                        <th>{{ $t("Role") }}</th>
                        <th>{{ $t("Active") }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="user in users" :key="user.id">
                        <td>{{ user.username }}</td>
                        <td>
                            <select v-model="user.role" class="form-select form-select-sm" @change="update(user)">
                                <option value="admin">Admin</option>
                                <option value="editor">Editor</option>
                                <option value="viewer">Viewer</option>
                            </select>
                        </td>
                        <td>
                            <div class="form-check form-switch">
                                <input
                                    v-model="user.active"
                                    class="form-check-input"
                                    type="checkbox"
                                    @change="update(user)"
                                />
                            </div>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            users: [],
            loading: false,
            creating: false,
            form: {
                username: "",
                password: "",
                role: "viewer",
            },
        };
    },
    mounted() {
        this.fetch();
    },
    methods: {
        fetch() {
            this.loading = true;
            this.$root.getSocket().emit("listUsers", (res) => {
                this.loading = false;
                if (res.ok) {
                    this.users = res.users.map((u) => ({ ...u, active: !!u.active }));
                } else {
                    this.$root.toastRes(res);
                }
            });
        },
        create() {
            if (!this.form.username || !this.form.password) {
                this.$root.toastError("Username and password required");
                return;
            }
            this.creating = true;
            this.$root.getSocket().emit("createUser", { ...this.form }, (res) => {
                this.creating = false;
                this.$root.toastRes(res);
                if (res.ok) {
                    this.form.username = "";
                    this.form.password = "";
                    this.form.role = "viewer";
                    this.fetch();
                }
            });
        },
        update(user) {
            this.$root.getSocket().emit("updateUser", {
                id: user.id,
                role: user.role,
                active: user.active,
            }, (res) => {
                if (!res.ok) {
                    this.$root.toastRes(res);
                    this.fetch();
                }
            });
        },
    },
};
</script>

<style scoped>
.shadow-box {
    border: 1px solid var(--bs-border-color, #e5e7eb);
    border-radius: 8px;
    background: #fff;
}
</style>
