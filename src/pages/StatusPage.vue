<template>
    <button v-if="hasToken" @click="edit">
        <font-awesome-icon icon="edit" />
    </button>
</template>

<script>
import { useToast } from "vue-toastification"
const toast = useToast()

export default {
    data() {
        return {
            hasToken: false,
        }
    },
    computed: {

    },
    watch: {

    },
    created() {
        this.hasToken = ("token" in localStorage);
    },
    mounted() {

    },
    methods: {
        edit() {
            console.log("here");
            this.$root.initSocketIO(true);
        }
    },
}
</script>
