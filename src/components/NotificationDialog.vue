<template>
    <div class="modal fade" tabindex="-1" ref="modal" data-bs-backdrop="static">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="exampleModalLabel">Setup Notification</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form @submit.prevent="submit">

                        <div class="mb-3">
                            <label for="type" class="form-label">Notification Type</label>
                            <select class="form-select"  id="type" v-model="type">
                                <option value="email">Email</option>
                                <option value="webhook">Webhook</option>
                                <option value="telegram">Telegram</option>
                                <option value="discord">Discord</option>
                            </select>
                        </div>

                        <div class="mb-3">
                            <label for="name" class="form-label">Friendly Name</label>
                            <input type="text" class="form-control" id="name" required v-model="name">
                        </div>

                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-primary" @click="yes" data-bs-dismiss="modal">Save</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { Modal } from 'bootstrap'
import { ucfirst } from "../../server/util";

export default {
    props: {

    },
    data() {
        return {
            model: null,
            type: null,
            name: "",
        }
    },
    mounted() {
        this.modal = new Modal(this.$refs.modal)
    },
    methods: {
        show() {
            this.modal.show()
        },
        submit() {

        }
    },
    watch: {
        type(to, from) {
            let oldName;

            if (from) {
                oldName =  `My ${ucfirst(from)} Notification`;
            } else {
                oldName = "";
            }

            if (! this.name || this.name === oldName) {
                this.name = `My ${ucfirst(to)} Alert (1)`
            }
        }
    }
}
</script>

<style scoped>

</style>
