<template>
    <div class="container-fluid">
        <div class="row">
            <div class="col-12 col-md-12 col-xl-12">
                <h1 class="mb-3">
                    {{ $t("Tenants") }}
                </h1>

                <div class="shadow-box big-padding mb-4">
                    <form class="row g-3" @submit.prevent="createTenant">
                        <div class="col-md-5">
                            <label for="tenant-name" class="form-label">{{ $t("Tenant Name") }}</label>
                            <input id="tenant-name" v-model="newTenant.name" type="text" class="form-control" :disabled="loading">
                        </div>
                        <div class="col-md-5">
                            <label for="tenant-slug" class="form-label">{{ $t("Slug") }} ({{ $t("Optional") }})</label>
                            <input id="tenant-slug" v-model="newTenant.slug" type="text" class="form-control" :disabled="loading" placeholder="auto-from-name">
                        </div>
                        <div class="col-md-2 d-flex align-items-end">
                            <button class="btn btn-primary w-100" :disabled="loading || !newTenant.name">
                                <font-awesome-icon icon="plus" /> {{ $t("Create Tenant") }}
                            </button>
                        </div>
                    </form>
                    <div v-if="error" class="text-danger mt-2">{{ error }}</div>
                </div>

                <div class="shadow-box table-shadow-box" style="overflow-x: auto;">
                    <table class="table table-borderless table-hover">
                        <thead>
                            <tr>
                                <th style="min-width: 240px;">{{ $t("Name") }}</th>
                                <th style="min-width: 220px;">{{ $t("Slug") }}</th>
                                <th style="width: 200px;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="t in tenants" :key="t.id">
                                <td>{{ t.name }}</td>
                                <td>{{ t.slug }}</td>
                                <td>
                                    <div class="d-flex gap-2">
                                        <button class="btn btn-sm btn-outline-primary" :disabled="loading" @click="openEdit(t)">
                                            <font-awesome-icon icon="edit" /> {{ $t("Edit") }}
                                        </button>
                                        <button class="btn btn-sm btn-outline-danger" :disabled="loading" @click="deleteTenant(t)">
                                            <font-awesome-icon icon="trash" /> {{ $t("Delete") }}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="tenants.length === 0">
                                <td colspan="3">{{ $t("No tenants found") }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Edit Tenant Modal -->
                <div ref="editModal" class="modal fade" tabindex="-1" data-bs-backdrop="static">
                    <div class="modal-dialog modal-lg">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title">{{ $t("Edit Tenant") }}</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" />
                            </div>
                            <div class="modal-body">
                                <div class="row g-3 mb-3">
                                    <div class="col-md-6">
                                        <label class="form-label">{{ $t("Tenant Name") }}</label>
                                        <input v-model="editTenant.name" type="text" class="form-control" />
                                    </div>
                                    <div class="col-md-6">
                                        <label class="form-label">{{ $t("Slug") }}</label>
                                        <input v-model="editTenant.slug" type="text" class="form-control" />
                                    </div>
                                </div>
                                <hr />
                                <h5 class="mb-2">{{ $t("Users") }}</h5>
                                <div v-if="tenantUsers.length === 0" class="text-muted mb-2">{{ $t("No users in tenant") }}</div>
                                <ul class="list-group mb-3">
                                    <li v-for="u in tenantUsers" :key="u.id" class="list-group-item d-flex justify-content-between align-items-center">
                                        <span>{{ u.username }} <span class="badge bg-secondary ms-2">{{ u.role }}</span></span>
                                        <button class="btn btn-sm btn-outline-danger" @click="removeTenantUser(u)">{{ $t("Remove") }}</button>
                                    </li>
                                </ul>
                                <div class="row g-3">
                                    <div class="col-md-6">
                                        <h6 class="mb-2">{{ $t("Add Existing User") }}</h6>
                                        <input v-model="addExisting.username" type="text" class="form-control mb-2" :placeholder="$t('Username')" />
                                        <select v-model="addExisting.role" class="form-select mb-2">
                                            <option value="member">{{ $t("Member") }}</option>
                                            <option value="owner">{{ $t("Owner") }}</option>
                                        </select>
                                        <button class="btn btn-outline-primary w-100" :disabled="loading || !addExisting.username" @click="addExistingUser">{{ $t("Add") }}</button>
                                    </div>
                                    <div class="col-md-6">
                                        <h6 class="mb-2">{{ $t("Create Tenant User") }}</h6>
                                        <input v-model="createUser.username" type="text" class="form-control mb-2" :placeholder="$t('Username')" />
                                        <input v-model="createUser.password" type="password" class="form-control mb-2" :placeholder="$t('Password')" />
                                        <input v-model="createUser.repeat" type="password" class="form-control mb-2" :placeholder="$t('Repeat Password')" />
                                        <select v-model="createUser.role" class="form-select mb-2">
                                            <option value="member">{{ $t("Member") }}</option>
                                            <option value="owner">{{ $t("Owner") }}</option>
                                        </select>
                                        <button class="btn btn-primary w-100" :disabled="loading || !createUser.username || !createUser.password || !createUser.repeat" @click="createTenantUser">{{ $t("Create") }}</button>
                                    </div>
                                </div>
                                <div v-if="error" class="text-danger mt-2">{{ error }}</div>
                            </div>
                            <div class="modal-footer">
                                <button class="btn btn-secondary" data-bs-dismiss="modal">{{ $t("Close") }}</button>
                                <button class="btn btn-primary" :disabled="loading" @click="saveTenant">{{ $t("Save") }}</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import axios from "axios";
import { Modal } from "bootstrap";

export default {
    name: "Tenants",
    data() {
        return {
            tenants: [],
            loading: false,
            error: "",
            newTenant: {
                name: "",
                slug: "",
            },
            // Edit Modal State
            editModal: null,
            currentTenantId: null,
            editTenant: {
                name: "",
                slug: "",
            },
            tenantUsers: [],
            addExisting: {
                username: "",
                role: "member",
            },
            createUser: {
                username: "",
                password: "",
                repeat: "",
                role: "member",
            },
        };
    },
    mounted() {
        this.load();
        this.$nextTick(() => {
            try {
                this.editModal = new Modal(this.$refs.editModal);
            } catch (e) {
                // ignore
            }
        });
    },
    methods: {
        authHeaders() {
            try {
                const token = this.$root?.storage()?.token;
                if (token && token !== "autoLogin") {
                    return { Authorization: `Bearer ${token}` };
                }
            } catch (_) { /* ignore */ }
            return {};
        },
        async load() {
            this.loading = true;
            this.error = "";
            try {
                const res = await axios.get("/api/v1/tenants", { headers: this.authHeaders() });
                this.tenants = res.data || [];
            } catch (e) {
                if (e?.response?.status === 403 || e?.response?.status === 401) {
                    // Not allowed to access tenants, redirect to dashboard
                    try {
                        this.$router.push("/dashboard");
                    } catch (_) {
                        /* ignore */
                    }
                }
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            } finally {
                this.loading = false;
            }
        },
        async createTenant() {
            if (!this.newTenant.name) {
                return;
            }
            this.loading = true;
            this.error = "";
            try {
                const payload = { name: this.newTenant.name };
                if (this.newTenant.slug) {
                    payload.slug = this.newTenant.slug;
                }
                const res = await axios.post("/api/v1/tenants", payload, { headers: this.authHeaders() });
                this.tenants.push(res.data);
                this.newTenant.name = "";
                this.newTenant.slug = "";
            } catch (e) {
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            } finally {
                this.loading = false;
            }
        },
        openEdit(t) {
            this.error = "";
            this.currentTenantId = t.id;
            this.editTenant.name = t.name;
            this.editTenant.slug = t.slug;
            this.addExisting.username = "";
            this.addExisting.role = "member";
            this.createUser.username = "";
            this.createUser.password = "";
            this.createUser.repeat = "";
            this.createUser.role = "member";
            this.tenantUsers = [];
            this.loadTenantUsers();
            this.editModal?.show();
        },
        async loadTenantUsers() {
            if (!this.currentTenantId) {
                return;
            }
            try {
                const res = await axios.get(`/api/v1/tenants/${this.currentTenantId}/users`, {
                    headers: this.authHeaders(),
                });
                // Hide global admin from tenant user list just in case server-side filter is bypassed
                const list = Array.isArray(res.data) ? res.data : [];
                this.tenantUsers = list.filter(u => Number(u.id) !== 1 && String(u.username).toLowerCase() !== "admin");
            } catch (e) {
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            }
        },
        async saveTenant() {
            if (!this.currentTenantId) {
                return;
            }
            this.loading = true;
            this.error = "";
            try {
                const res = await axios.put(`/api/v1/tenants/${this.currentTenantId}`, this.editTenant, {
                    headers: this.authHeaders(),
                });
                const idx = this.tenants.findIndex(x => x.id === this.currentTenantId);
                if (idx !== -1) {
                    this.tenants[idx] = res.data;
                }
                this.editModal?.hide();
            } catch (e) {
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            } finally {
                this.loading = false;
            }
        },
        async addExistingUser() {
            if (!this.currentTenantId || !this.addExisting.username) {
                return;
            }
            this.loading = true;
            this.error = "";
            try {
                const res = await axios.post(
                    `/api/v1/tenants/${this.currentTenantId}/users`,
                    {
                        username: this.addExisting.username,
                        role: this.addExisting.role,
                    },
                    { headers: this.authHeaders() }
                );
                const idx = this.tenantUsers.findIndex(u => u.id === res.data.id);
                if (idx === -1) {
                    this.tenantUsers.push(res.data);
                } else {
                    this.tenantUsers[idx] = res.data;
                }
                this.addExisting.username = "";
                this.addExisting.role = "member";
            } catch (e) {
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            } finally {
                this.loading = false;
            }
        },
        async createTenantUser() {
            if (!this.currentTenantId) {
                return;
            }
            if (!this.createUser.username || !this.createUser.password || this.createUser.password !== this.createUser.repeat) {
                this.error = this.$t("passwordNotMatchMsg");
                return;
            }
            this.loading = true;
            this.error = "";
            try {
                const res = await axios.post(
                    `/api/v1/tenants/${this.currentTenantId}/users/create`,
                    {
                        username: this.createUser.username,
                        password: this.createUser.password,
                        role: this.createUser.role,
                    },
                    { headers: this.authHeaders() }
                );
                this.tenantUsers.push(res.data);
                this.createUser.username = "";
                this.createUser.password = "";
                this.createUser.repeat = "";
                this.createUser.role = "member";
            } catch (e) {
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            } finally {
                this.loading = false;
            }
        },
        async removeTenantUser(u) {
            if (!this.currentTenantId || !u) {
                return;
            }
            if (!confirm(this.$t("removeUserFromTenantMsg", [ u.username ]))) {
                return;
            }
            this.loading = true;
            this.error = "";
            try {
                await axios.delete(`/api/v1/tenants/${this.currentTenantId}/users/${u.id}`, { headers: this.authHeaders() });
                this.tenantUsers = this.tenantUsers.filter(x => x.id !== u.id);
            } catch (e) {
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            } finally {
                this.loading = false;
            }
        },
        async deleteTenant(t) {
            if (!confirm(this.$t("deleteTenantMsg") + "\n" + t.name)) {
                return;
            }
            this.loading = true;
            this.error = "";
            try {
                await axios.delete(`/api/v1/tenants/${t.id}`, { headers: this.authHeaders() });
                this.tenants = this.tenants.filter(x => x.id !== t.id);
            } catch (e) {
                this.error = e?.response?.data?.error || e.message || this.$t("loadingError");
            } finally {
                this.loading = false;
            }
        },
    },
};
</script>

<style scoped>
.shadow-box {
    background: var(--bs-body-bg);
    border-radius: 8px;
}
.big-padding {
    padding: 20px;
}
.table-shadow-box {
    padding: 10px 15px;
}
</style>
