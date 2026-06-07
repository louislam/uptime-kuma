<template>
    <div class="worker-users my-4">
        <div v-if="!$root.hasPermission('users.read')" class="alert alert-warning">
            You do not have access to user management.
        </div>

        <template v-else>
            <form v-if="canWriteUsers" class="worker-users-create mb-4" @submit.prevent="createUser">
                <div class="row g-2 align-items-end">
                    <div class="col-md-3">
                        <label for="new-worker-user" class="form-label">Username</label>
                        <input
                            id="new-worker-user"
                            v-model="newUser.username"
                            class="form-control"
                            type="text"
                            autocomplete="off"
                            required
                        />
                    </div>
                    <div class="col-md-3">
                        <label for="new-worker-password" class="form-label">Password</label>
                        <input
                            id="new-worker-password"
                            v-model="newUser.password"
                            class="form-control"
                            type="password"
                            autocomplete="new-password"
                            required
                        />
                    </div>
                    <div class="col-md-2">
                        <label for="new-worker-role" class="form-label">Role</label>
                        <select id="new-worker-role" v-model="newUser.role" class="form-select">
                            <option v-for="role in roles" :key="role" :value="role">
                                {{ role }}
                            </option>
                        </select>
                    </div>
                    <div class="col-md-2">
                        <div class="form-check mb-2">
                            <input id="new-worker-active" v-model="newUser.active" class="form-check-input" type="checkbox" />
                            <label class="form-check-label" for="new-worker-active">Active</label>
                        </div>
                    </div>
                    <div class="col-md-2">
                        <button class="btn btn-primary w-100" type="submit" :disabled="saving">
                            Add User
                        </button>
                    </div>
                </div>
            </form>

            <div class="table-responsive">
                <table class="table align-middle worker-users-table">
                    <thead>
                        <tr>
                            <th>Username</th>
                            <th>Role</th>
                            <th>Active</th>
                            <th>Password</th>
                            <th class="text-end">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="user in users" :key="user.id">
                            <td>
                                <input
                                    v-model="user.username"
                                    class="form-control form-control-sm"
                                    type="text"
                                    :disabled="!canWriteUsers || saving"
                                />
                            </td>
                            <td>
                                <select
                                    v-model="user.role"
                                    class="form-select form-select-sm"
                                    :disabled="!canWriteUsers || saving"
                                >
                                    <option v-for="role in roles" :key="role" :value="role">
                                        {{ role }}
                                    </option>
                                </select>
                            </td>
                            <td>
                                <div class="form-check">
                                    <input
                                        :id="`worker-user-active-${user.id}`"
                                        v-model="user.active"
                                        class="form-check-input"
                                        type="checkbox"
                                        :disabled="!canWriteUsers || saving"
                                    />
                                    <label class="form-check-label" :for="`worker-user-active-${user.id}`">
                                        Active
                                    </label>
                                </div>
                            </td>
                            <td>
                                <input
                                    v-model="user.newPassword"
                                    class="form-control form-control-sm"
                                    type="password"
                                    autocomplete="new-password"
                                    :disabled="!canWriteUsers || saving"
                                />
                            </td>
                            <td class="text-end worker-users-actions">
                                <button
                                    v-if="canWriteUsers"
                                    class="btn btn-sm btn-primary me-1"
                                    type="button"
                                    :disabled="saving"
                                    @click="updateUser(user)"
                                >
                                    Save
                                </button>
                                <button
                                    v-if="canWriteUsers"
                                    class="btn btn-sm btn-outline-primary me-1"
                                    type="button"
                                    :disabled="saving || !user.newPassword"
                                    @click="setPassword(user)"
                                >
                                    Password
                                </button>
                                <button
                                    v-if="canWriteUsers"
                                    class="btn btn-sm btn-outline-secondary me-1"
                                    type="button"
                                    :disabled="saving"
                                    @click="resetTwoFA(user)"
                                >
                                    Reset 2FA
                                </button>
                                <button
                                    v-if="canDeleteUsers"
                                    class="btn btn-sm btn-outline-danger"
                                    type="button"
                                    :disabled="saving"
                                    @click="deleteUser(user)"
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <section class="worker-role-help mt-4" aria-labelledby="worker-role-help-title">
                <h2 id="worker-role-help-title" class="h5 mb-3">Role permissions</h2>
                <dl class="row g-3 mb-0">
                    <div v-for="role in roleDetails" :key="role.name" class="col-md-6">
                        <dt class="mb-1">{{ role.name }}</dt>
                        <dd class="mb-0">{{ role.description }}</dd>
                    </div>
                </dl>
            </section>
        </template>
    </div>
</template>

<script>
import { requestCloudflareJson } from "../../cloudflare-worker-api";

const ROLE_DETAILS = [
    {
        name: "admin",
        description: "Full access to every Uptime Worker setting, monitor, status page, security control, and user management action.",
    },
    {
        name: "editor",
        description: "Can create, edit, delete, run, and pause monitors, manage settings, notifications, tags, status pages, network profiles, and clear statistics. Cannot manage users or security settings.",
    },
    {
        name: "operator",
        description: "Can view settings and integrations, run or pause monitors, and clear heartbeat history. Cannot create, edit, or delete monitors or settings.",
    },
    {
        name: "viewer",
        description: "Read-only access to dashboards, monitors, heartbeat history, settings, notifications, tags, proxies, Docker hosts, remote browsers, network profiles, and status pages.",
    },
];

export default {
    data() {
        return {
            users: [],
            roleDetails: ROLE_DETAILS,
            roles: ROLE_DETAILS.map((role) => role.name),
            saving: false,
            newUser: {
                username: "",
                password: "",
                role: "viewer",
                active: true,
            },
        };
    },

    computed: {
        canWriteUsers() {
            return this.hasPermission("users.write");
        },

        canDeleteUsers() {
            return this.hasPermission("users.delete");
        },
    },

    mounted() {
        if (this.hasPermission("users.read")) {
            this.loadUsers();
        }
    },

    methods: {
        hasPermission(permission) {
            return this.$root.hasPermission(permission);
        },

        async loadUsers() {
            const body = await requestCloudflareJson("/api/users");
            this.users = (body.users || []).map((user) => ({
                ...user,
                newPassword: "",
            }));
        },

        async createUser() {
            this.saving = true;
            try {
                const body = await requestCloudflareJson("/api/users", {
                    method: "POST",
                    body: JSON.stringify(this.newUser),
                });
                this.$root.toastRes(body);
                this.newUser = {
                    username: "",
                    password: "",
                    role: "viewer",
                    active: true,
                };
                await this.loadUsers();
            } catch (error) {
                this.$root.toastError(error.message);
            } finally {
                this.saving = false;
            }
        },

        async updateUser(user) {
            this.saving = true;
            try {
                const body = await requestCloudflareJson(`/api/users/${user.id}`, {
                    method: "PUT",
                    body: JSON.stringify({
                        username: user.username,
                        role: user.role,
                        active: user.active,
                    }),
                });
                this.$root.toastRes(body);
                await this.loadUsers();
            } catch (error) {
                this.$root.toastError(error.message);
            } finally {
                this.saving = false;
            }
        },

        async setPassword(user) {
            if (!user.newPassword) {
                return;
            }
            this.saving = true;
            try {
                const body = await requestCloudflareJson(`/api/users/${user.id}/password`, {
                    method: "PATCH",
                    body: JSON.stringify({ password: user.newPassword }),
                });
                this.$root.toastRes(body);
                user.newPassword = "";
            } catch (error) {
                this.$root.toastError(error.message);
            } finally {
                this.saving = false;
            }
        },

        async resetTwoFA(user) {
            this.saving = true;
            try {
                const body = await requestCloudflareJson(`/api/users/${user.id}/reset-2fa`, {
                    method: "POST",
                });
                this.$root.toastRes(body);
            } catch (error) {
                this.$root.toastError(error.message);
            } finally {
                this.saving = false;
            }
        },

        async deleteUser(user) {
            this.saving = true;
            try {
                const body = await requestCloudflareJson(`/api/users/${user.id}`, {
                    method: "DELETE",
                });
                this.$root.toastRes(body);
                await this.loadUsers();
            } catch (error) {
                this.$root.toastError(error.message);
            } finally {
                this.saving = false;
            }
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../../assets/vars.scss";

.worker-users-table {
    min-width: 760px;
}

.worker-users-actions {
    white-space: nowrap;
}

.worker-role-help {
    border-top: 1px solid $dark-border-color;
    padding-top: 1rem;
}

.worker-role-help dt {
    font-weight: 700;
}

.worker-role-help dd {
    color: $dark-font-color2;
}

.dark {
    .worker-users-table {
        color: $dark-font-color;
    }
}
</style>
