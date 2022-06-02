<template>
    <div class="row ms-2">
        <label class="col-3 text-end col-form-label">{{ label }}</label>
        <div class="col-9">
            <div class="input-group">
                <input v-model.lazy="model" class="form-control" :placeholder="placeholder" />
                <button
                    type="button"
                    class="btn btn-outline-secondary dropdown-toggle border-primary"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                >
                    <span class="visually-hidden">Toggle Dropdown</span>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                    <li v-for="color in colors" :key="propName + color" :value="color" :label="color">
                        <a class="dropdown-item" href="#" @click="model = color">{{ color }}</a>
                    </li>
                </ul>
                <input
                    v-model="model"
                    type="color"
                    class="form-control form-control-color fix-width-label"
                    title="Choose your color"
                />
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
    data() {
        return {
            colors: [
                "brightgreen",
                "green",
                "yellow",
                "yellowgreen",
                "orange",
                "red",
                "blue",
                "grey",
                "lightgrey",
                "white",
                "black",
            ],
        };
    },
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
