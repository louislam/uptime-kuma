<template>
    <div ref="modalRef" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        {{ $t("New User") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                </div>
                <div class="modal-body">
                    <form @submit.prevent="confirm">
                        <div>
                            <label for="username" class="form-label">{{ $t("Username") }}</label>
                            <input
                                id="username"
                                v-model="username"
                                type="text"
                                class="form-control"
                                data-testid="username-input"
                            />
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                        {{ $t("Cancel") }}
                    </button>
                    <button
                        type="button"
                        class="btn btn-primary"
                        data-bs-dismiss="modal"
                        :disabled="!username"
                        @click="confirm"
                    >
                        {{ $t("Confirm") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { Modal } from "bootstrap";
import { onMounted, ref } from "vue";

// UI
const modalRef = ref<HTMLElement | null>(null);
const modal = ref<Modal | null>(null);

// Data
const username = ref<string>("");

const emit = defineEmits<{
    (e: "add", username: string): void;
}>();

defineExpose({
    show: () => {
        modal.value?.show();
    },
});

onMounted(() => {
    modal.value = new Modal(modalRef.value!);
});

const confirm = () => {
    emit("add", username.value);
    modal.value?.hide();
};
</script>
