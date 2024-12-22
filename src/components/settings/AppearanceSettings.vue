<template>
    <div>
        <div class="my-4">
            <label for="language" class="form-label">
                {{ $t("Language") }}
            </label>
            <select
                id="language"
                :value="language"
                class="form-select"
                @input="$emit('update:language', $event.target.value)"
            >
                <option
                    v-for="(lang, i) in languages"
                    :key="`Lang${i}`"
                    :value="lang.value"
                >
                    {{ lang.label }}
                </option>
            </select>
        </div>
        <div class="my-4">
            <label for="timezone" class="form-label">{{ $t("Theme") }}</label>
            <div>
                <div
                    class="btn-group"
                    role="group"
                    aria-label="Basic checkbox toggle button group"
                >
                    <input
                        id="btncheck1"
                        :checked="userTheme == 'light'"
                        type="radio"
                        class="btn-check"
                        name="theme"
                        autocomplete="off"
                        value="light"
                        @input="$emit('update:userTheme', 'light')"
                    />
                    <label class="btn btn-outline-primary" for="btncheck1">
                        {{ $t("Light") }}
                    </label>

                    <input
                        id="btncheck2"
                        :checked="userTheme == 'dark'"
                        type="radio"
                        class="btn-check"
                        name="theme"
                        autocomplete="off"
                        value="dark"
                        @input="$emit('update:userTheme', 'dark')"
                    />
                    <label class="btn btn-outline-primary" for="btncheck2">
                        {{ $t("Dark") }}
                    </label>

                    <input
                        id="btncheck3"
                        :checked="userTheme == 'auto'"
                        type="radio"
                        class="btn-check"
                        name="theme"
                        autocomplete="off"
                        value="auto"
                        @input="$emit('update:userTheme', 'auto')"
                    />
                    <label class="btn btn-outline-primary" for="btncheck3">
                        {{ $t("Auto") }}
                    </label>
                </div>
            </div>
        </div>
        <div class="my-4">
            <label class="form-label">{{ $t("Theme - Heartbeat Bar") }}</label>
            <div>
                <div
                    class="btn-group"
                    role="group"
                    aria-label="Basic checkbox toggle button group"
                >
                    <input
                        id="btncheck4"
                        :checked="userHeartbeatBar == 'normal'"
                        type="radio"
                        class="btn-check"
                        name="heartbeatBarTheme"
                        autocomplete="off"
                        value="normal"
                        @input="$emit('update:userHeartbeatBar', 'normal')"
                    />
                    <label class="btn btn-outline-primary" for="btncheck4">
                        {{ $t("Normal") }}
                    </label>

                    <input
                        id="btncheck5"
                        :checked="userHeartbeatBar == 'bottom'"
                        type="radio"
                        class="btn-check"
                        name="heartbeatBarTheme"
                        autocomplete="off"
                        value="bottom"
                        @input="$emit('update:userHeartbeatBar', 'bottom')"
                    />
                    <label class="btn btn-outline-primary" for="btncheck5">
                        {{ $t("Bottom") }}
                    </label>

                    <input
                        id="btncheck6"
                        :checked="userHeartbeatBar == 'none'"
                        type="radio"
                        class="btn-check"
                        name="heartbeatBarTheme"
                        autocomplete="off"
                        value="none"
                        @input="$emit('update:userHeartbeatBar', 'none')"
                    />
                    <label class="btn btn-outline-primary" for="btncheck6">
                        {{ $t("None") }}
                    </label>
                </div>
            </div>
        </div>

        <!-- Timeline -->
        <div class="my-4">
            <label class="form-label">{{ $t("styleElapsedTime") }}</label>
            <div>
                <div class="btn-group" role="group">
                    <input
                        id="styleElapsedTimeShowNoLine"
                        :checked="styleElapsedTime == 'no-line'"
                        type="radio"
                        class="btn-check"
                        name="styleElapsedTime"
                        autocomplete="off"
                        value="no-line"
                        @input="$emit('update:styleElapsedTime', 'no-line')"
                    />
                    <label
                        class="btn btn-outline-primary"
                        for="styleElapsedTimeShowNoLine"
                    >
                        {{ $t("styleElapsedTimeShowNoLine") }}
                    </label>

                    <input
                        id="styleElapsedTimeShowWithLine"
                        :checked="styleElapsedTime == 'with-line'"
                        type="radio"
                        class="btn-check"
                        name="styleElapsedTime"
                        autocomplete="off"
                        value="with-line"
                        @input="$emit('update:styleElapsedTime', 'with-line')"
                    />
                    <label
                        class="btn btn-outline-primary"
                        for="styleElapsedTimeShowWithLine"
                    >
                        {{ $t("styleElapsedTimeShowWithLine") }}
                    </label>

                    <input
                        id="styleElapsedTimeNone"
                        :checked="styleElapsedTime == 'none'"
                        type="radio"
                        class="btn-check"
                        name="styleElapsedTime"
                        autocomplete="off"
                        value="none"
                        @input="$emit('update:styleElapsedTime', 'none')"
                    />
                    <label
                        class="btn btn-outline-primary"
                        for="styleElapsedTimeNone"
                    >
                        {{ $t("None") }}
                    </label>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="js">
export default {
    props: {
        languages: {
            type: Array,
            required: true,
        },
        language: {
            type: String,
            required: true,
        },
        userTheme: {
            type: String,
            required: true,
        },
        userHeartbeatBar: {
            type: String,
            required: true,
        },
        styleElapsedTime: {
            type: String,
            required: true,
        },
    },
    emits: [
        "update:language",
        "update:userTheme",
        "update:userHeartbeatBar",
        "update:styleElapsedTime",
    ],
    data() {
        return {};
    },
};
</script>

<style lang="scss" scoped>
.btn-check:active + .btn-outline-primary,
.btn-check:checked + .btn-outline-primary,
.btn-check:hover + .btn-outline-primary {
    color: #fff;

    .dark & {
        color: #000;
    }
}
</style>
