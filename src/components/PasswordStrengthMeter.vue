<template>
    <div v-if="password && strength !== null" class="password-strength mt-2">
        <div class="strength-meter mx-auto">
            <div 
                class="strength-meter-fill" 
                :class="strengthClass"
                :style="{ width: strengthWidth }"
            />
        </div>
        <small v-if="strength < 3" class="text-warning d-block mt-1">
            {{ $t("passwordWeakWarning") }}
        </small>
    </div>
</template>

<script>
import zxcvbn from "zxcvbn";

export default {
    props: {
        password: {
            type: String,
            required: true,
        },
        username: {
            type: String,
            default: "",
        },
    },
    computed: {
        strength() {
            if (!this.password) {
                return null;
            }
            
            const userInputs = this.username ? [ this.username ] : [];
            const result = zxcvbn(this.password, userInputs);
            return result.score;
        },
        strengthClass() {
            if (this.strength === null) {
                return "";
            }
            const classes = [ "strength-very-weak", "strength-weak", "strength-fair", "strength-good", "strength-strong" ];
            return classes[this.strength] || "";
        },
        strengthWidth() {
            if (this.strength === null) {
                return "0%";
            }
            return `${(this.strength + 1) * 20}%`;
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

.password-strength {
    margin-top: 0.5rem;
}

.strength-meter {
    height: 8px;
    width: 85%;
    background-color: #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
    margin-left: auto;
    margin-right: auto;
}

.strength-meter-fill {
    height: 100%;
    transition: width 0.3s ease, background-color 0.3s ease;
}

// Color transitions using SCSS variables
.strength-very-weak {
    background-color: $danger;
}

.strength-weak {
    background-color: mix($danger, $warning, 50%);
}

.strength-fair {
    background-color: $warning;
}

.strength-good {
    background-color: mix($warning, $primary, 50%);
}

.strength-strong {
    background-color: $primary;
}
</style>
