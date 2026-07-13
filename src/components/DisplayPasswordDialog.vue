<template>
    <div ref="modalRef" class="modal fade" tabindex="-1">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        {{ $t("Password") }}
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" :aria-label="$t('Close')" />
                </div>
                <div class="modal-body">
                    <form @submit.prevent="close">
                        <CopyableInput
                            :model-value="password"
                            type="password"
                            readonly="true"
                            data-testid="password-input"
                        />
                    </form>
                </div>
                <div class="modal-footer">
                    <button
                        type="button"
                        class="btn btn-primary"
                        data-bs-dismiss="modal"
                        data-testid="password-close-button"
                        @click="close"
                    >
                        {{ $t("Close") }}
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, defineExpose } from "vue";
import { Modal } from "bootstrap";

import CopyableInput from "./CopyableInput.vue";

// UI
const modalRef = ref<HTMLElement | null>(null);
const modal = ref<Modal | null>(null);

// Data
defineProps<{
    password: string;
}>();

const emit = defineEmits<{
    (e: "close"): void;
}>();

defineExpose({
    show: () => {
        modal.value?.show();
    },
});

onMounted(() => {
    modal.value = new Modal(modalRef.value!);
});

const close = () => {
    emit("close");
    modal.value?.hide();
};
</script>
