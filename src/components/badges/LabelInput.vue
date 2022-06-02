<template>
    <div class="row ms-2">
        <label class="col-3 text-end col-form-label">{{ label }}</label>
        <div class="col-9">
            <div class="input-group">
                <input v-model.lazy="model" class="form-control" :placeholder="placeholder" />
                <button v-if="model !== ''" class="btn btn-outline-danger" @click="model = ''">x</button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        modelValue: {
            type: String,
            default: ""
        },
        placeholder: {
            type: String,
            default: ""
        },
        label: {
            type: String,
            default: ""
        },
    },
    emits: [ "update:modelValue" ],
    computed: {
        model: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit("update:modelValue", value);
            }
        }
    },

};
</script>
