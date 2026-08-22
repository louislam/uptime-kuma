<template>
    <div class="mb-3">
        <label for="amoot-api-token" class="form-label">
            {{ $t("API Token") }}
        </label>

        <HiddenInput
            id="amoot-api-token"
            v-model="$parent.notification.amootApiToken"
            :required="true"
            autocomplete="new-password"
        ></HiddenInput>
    </div>

    <div class="mb-3">
        <label for="amoot-mobiles" class="form-label">
            {{ $t("Recipient Numbers") }}
        </label>

        <input
            id="amoot-mobiles"
            v-model="$parent.notification.amootMobiles"
            type="text"
            placeholder="9123456789,09987654321"
            class="form-control"
            required
        />

        <div class="form-text">
            {{ $t("Amoot SMS recipient numbers help") }}
        </div>
    </div>

    <div class="mb-3 form-check">
        <input
            id="amoot-use-pattern"
            v-model="$parent.notification.amootUsePattern"
            type="checkbox"
            class="form-check-input"
        />

        <label class="form-check-label" for="amoot-use-pattern">
            {{ $t("Use Pattern") }}
        </label>
    </div>

    <div v-if="$parent.notification.amootUsePattern" class="mb-3">
        <label for="amoot-pattern-code-id" class="form-label">
            {{ $t("Pattern Code ID") }}
        </label>

        <input
            id="amoot-pattern-code-id"
            v-model="$parent.notification.amootPatternCodeId"
            type="number"
            placeholder="1234"
            class="form-control"
            min="1"
            required
        />

        <div class="form-text">
            <i18n-t keypath="Amoot SMS pattern help">
                <a href="https://portal.amootsms.com/dev/PatternCode" target="_blank" rel="noopener noreferrer">
                    {{ $t("Create an Amoot SMS pattern") }}
                </a>
            </i18n-t>
        </div>
    </div>

    <div v-if="$parent.notification.amootUsePattern" class="mb-3 form-check">
        <input
            id="amoot-use-own-line"
            v-model="$parent.notification.amootUseOwnLine"
            type="checkbox"
            class="form-check-input"
        />

        <label class="form-check-label" for="amoot-use-own-line">
            {{ $t("Use Own Line for Pattern") }}
        </label>
    </div>

    <div v-if="!$parent.notification.amootUsePattern || $parent.notification.amootUseOwnLine" class="mb-3">
        <label for="amoot-line-number" class="form-label">
            {{ $t("Line Number") }}
        </label>

        <input
            id="amoot-line-number"
            v-model="$parent.notification.amootLineNumber"
            type="text"
            class="form-control"
            required
        />
    </div>
</template>

<script>
import HiddenInput from "../HiddenInput.vue";

export default {
    components: {
        HiddenInput,
    },

    mounted() {
        if (!this.$parent.notification.amootLineNumber) {
            this.$parent.notification.amootLineNumber = "public";
        }
    },
};
</script>
