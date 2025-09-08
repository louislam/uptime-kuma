<template>
    <div class="time-range-selector">
        <div class="dropdown" @click.stop>
            <button
                class="btn btn-outline-secondary dropdown-toggle btn-sm"
                type="button"
                data-bs-toggle="dropdown"
                aria-expanded="false"
            >
                {{ displayText }}
            </button>
            <ul class="dropdown-menu time-range-dropdown">
                <!-- Custom Range Section (Top) -->
                <li class="custom-range-section">
                    <h6 class="dropdown-header">{{ $t("Custom Range") }}</h6>
                    

                    <!-- Date Inputs -->
                    <div class="date-inputs">
                        <div class="input-group">
                            <label class="input-label">{{ $t("From") }}:</label>
                            <input
                                v-model="customFrom"
                                type="datetime-local"
                                class="form-control form-control-sm datetime-input"
                                placeholder="dd/mm/yyyy --:--"
                                @change="validateAndUpdateCustomRange"
                                @click.stop
                            />
                        </div>
                        <div class="input-group">
                            <label class="input-label">{{ $t("To") }}:</label>
                            <input
                                v-model="customTo"
                                type="datetime-local"
                                class="form-control form-control-sm datetime-input"
                                placeholder="dd/mm/yyyy --:--"
                                @change="validateAndUpdateCustomRange"
                                @click.stop
                            />
                        </div>
                    </div>

                    <!-- Duration Display and Reset -->
                    <div v-if="customFrom && customTo" class="custom-range-footer">
                        <div class="duration-display">
                            {{ $t("Duration") }}: {{ customDuration }}
                        </div>
                        <button 
                            type="button" 
                            class="btn btn-sm btn-outline-secondary reset-btn"
                            @click="resetCustomRange"
                            title="Clear custom range"
                        >
                            ✕
                        </button>
                    </div>
                </li>

                <li><hr class="dropdown-divider" /></li>

                <!-- Quick Ranges Section (Bottom) -->
                <li class="quick-ranges-section">
                    <h6 class="dropdown-header">{{ $t("Quick Ranges") }}</h6>
                    <div class="quick-ranges-grid">
                        <button
                            type="button"
                            class="dropdown-item"
                            :class="{ active: selectedRange === '5min' }"
                            @click="selectRange('5min')"
                        >
                            {{ $t("Last 5 minutes") }}
                        </button>
                        <button
                            type="button"
                            class="dropdown-item"
                            :class="{ active: selectedRange === '1h' }"
                            @click="selectRange('1h')"
                        >
                            {{ $t("Last 1 hour") }}
                        </button>
                        <button
                            type="button"
                            class="dropdown-item"
                            :class="{ active: selectedRange === '24h' }"
                            @click="selectRange('24h')"
                        >
                            {{ $t("Last 24 hours") }}
                        </button>
                        <button
                            type="button"
                            class="dropdown-item"
                            :class="{ active: selectedRange === '7d' }"
                            @click="selectRange('7d')"
                        >
                            {{ $t("Last 7 days") }}
                        </button>
                        <button
                            type="button"
                            class="dropdown-item"
                            :class="{ active: selectedRange === '30d' }"
                            @click="selectRange('30d')"
                        >
                            {{ $t("Last 30 days") }}
                        </button>
                        <button
                            type="button"
                            class="dropdown-item"
                            :class="{ active: selectedRange === '6m' }"
                            @click="selectRange('6m')"
                        >
                            {{ $t("Last 6 months") }}
                        </button>
                    </div>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
import dayjs from "dayjs";

export default {
    name: "TimeRangeSelector",
    props: {
        modelValue: {
            type: Object,
            default: () => ({ type: "30d" })
        }
    },
    emits: ["update:modelValue"],
    data() {
        return {
            selectedRange: "30d",
            customFrom: "",
            customTo: "",
            customDuration: ""
        };
    },
    computed: {
        displayText() {
            if (this.selectedRange === "custom") {
                if (this.customFrom && this.customTo) {
                    return this.formatCustomRangeDisplay();
                }
                return this.$t("Custom Range");
            }
            
            const ranges = {
                "5min": this.$t("Last 5 minutes"),
                "1h": this.$t("Last 1 hour"),
                "24h": this.$t("Last 24 hours"),
                "7d": this.$t("Last 7 days"),
                "30d": this.$t("Last 30 days"),
                "6m": this.$t("Last 6 months")
            };
            
            return ranges[this.selectedRange] || this.$t("Last 30 days");
        }
    },
    watch: {
        modelValue: {
            handler(newValue) {
                if (newValue) {
                    this.selectedRange = newValue.type || "30d";
                    if (newValue.type === "custom" && newValue.from && newValue.to) {
                        this.customFrom = dayjs(newValue.from).format("YYYY-MM-DDTHH:mm");
                        this.customTo = dayjs(newValue.to).format("YYYY-MM-DDTHH:mm");
                        this.updateCustomDuration();
                    }
                }
            },
            immediate: true
        }
    },
    mounted() {
        // Initialize with default 6 months
        this.selectRange("6m");
    },
    methods: {
        selectRange(range) {
            this.selectedRange = range;
            
            // Clear custom range inputs when selecting quick range
            this.customFrom = "";
            this.customTo = "";
            this.customDuration = "";
            
            const now = dayjs();
            let from, to;
            
            switch (range) {
                case "5min":
                    from = now.subtract(5, "minute");
                    break;
                case "1h":
                    from = now.subtract(1, "hour");
                    break;
                case "24h":
                    from = now.subtract(24, "hour");
                    break;
                case "7d":
                    from = now.subtract(7, "day");
                    break;
                case "30d":
                    from = now.subtract(30, "day");
                    break;
                case "6m":
                    from = now.subtract(6, "month");
                    break;
                default:
                    from = now.subtract(30, "day");
            }
            
            to = now;
            
            this.emitUpdate({
                type: range,
                from: from.toISOString(),
                to: to.toISOString()
            });
        },
        
        setPreset(preset) {
            this.selectedRange = "custom";
            const now = dayjs();
            
            let from, to;
            
            switch (preset) {
                case "yesterday":
                    from = now.subtract(1, "day").startOf("day");
                    to = now.subtract(1, "day").endOf("day");
                    break;
                case "thisWeek":
                    from = now.startOf("week");
                    to = now.endOf("day");
                    break;
                case "lastWeek":
                    from = now.subtract(1, "week").startOf("week");
                    to = now.subtract(1, "week").endOf("week");
                    break;
            }
            
            this.customFrom = from.format("YYYY-MM-DDTHH:mm");
            this.customTo = to.format("YYYY-MM-DDTHH:mm");
            this.updateCustomDuration();
            this.validateAndUpdateCustomRange();
        },
        
        validateAndUpdateCustomRange() {
            if (!this.customFrom || !this.customTo) {
                return;
            }
            
            let from = dayjs(this.customFrom);
            let to = dayjs(this.customTo);
            
            // Auto-correct if from > to
            if (from.isAfter(to)) {
                this.customTo = this.customFrom;
                to = from;
            }
            
            this.selectedRange = "custom";
            this.updateCustomDuration();
            
            this.emitUpdate({
                type: "custom",
                from: from.toISOString(),
                to: to.toISOString()
            });
        },
        
        updateCustomDuration() {
            if (!this.customFrom || !this.customTo) {
                this.customDuration = "";
                return;
            }
            
            const from = dayjs(this.customFrom);
            const to = dayjs(this.customTo);
            const diff = to.diff(from);
            
            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
            const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            
            let duration = "";
            if (days > 0) duration += `${days}d `;
            if (hours > 0) duration += `${hours}h `;
            if (minutes > 0) duration += `${minutes}m`;
            
            this.customDuration = duration.trim() || "0m";
        },
        
        formatCustomRangeDisplay() {
            if (!this.customFrom || !this.customTo) {
                return this.$t("Custom Range");
            }
            
            const from = dayjs(this.customFrom);
            const to = dayjs(this.customTo);
            const now = dayjs();
            
            // Smart formatting based on year and day
            const sameYear = from.year() === to.year() && from.year() === now.year();
            const sameDay = from.format("YYYY-MM-DD") === to.format("YYYY-MM-DD");
            
            let fromStr, toStr;
            
            if (sameDay) {
                // Same day: "07 Sep, 00:00 - 01:00"
                fromStr = from.format(sameYear ? "DD MMM, HH:mm" : "DD MMM YYYY, HH:mm");
                toStr = to.format("HH:mm");
            } else if (sameYear) {
                // Same year: "07 Sep, 00:00 - 25 Feb, 01:00"
                fromStr = from.format("DD MMM, HH:mm");
                toStr = to.format("DD MMM, HH:mm");
            } else {
                // Different years: "07 Sep 2024, 00:00 - 25 Feb 2025, 01:00"
                fromStr = from.format("DD MMM YYYY, HH:mm");
                toStr = to.format("DD MMM YYYY, HH:mm");
            }
            
            return `${fromStr} - ${toStr}`;
        },
        
        resetCustomRange() {
            this.customFrom = "";
            this.customTo = "";
            this.customDuration = "";
            this.selectedRange = "30d";
            this.selectRange("30d");
        },
        
        emitUpdate(value) {
            this.$emit("update:modelValue", value);
        }
    }
};
</script>

<style lang="scss" scoped>
.time-range-selector {
    .time-range-dropdown {
        width: 280px;
        padding: 0.75rem;
        
        .custom-range-section {
            
            .date-inputs {
                .input-group {
                    margin-bottom: 0.75rem;
                    
                    .input-label {
                        display: block;
                        font-size: 0.8rem;
                        font-weight: 500;
                        margin-bottom: 0.25rem;
                        color: #6c757d;
                    }
                    
                    .datetime-input {
                        width: 100%;
                        font-size: 0.8rem;
                        border-radius: 0.5rem !important;
                        padding: 0.375rem 0.75rem;
                        border: 1px solid #d0d7de;
                        
                        &:focus {
                            border-color: var(--bs-primary);
                            box-shadow: 0 0 0 0.2rem rgba(var(--bs-primary-rgb), 0.25);
                        }
                    }
                }
            }
            
            .custom-range-footer {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 0.25rem;
                
                .duration-display {
                    font-size: 0.75rem;
                    color: #6c757d;
                    font-weight: 500;
                }
                
                .reset-btn {
                    font-size: 0.7rem;
                    padding: 0.1rem 0.3rem;
                    line-height: 1;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
            }
        }
        
        .quick-ranges-section {
            .quick-ranges-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 0.25rem;
            }
            
            .dropdown-item {
                font-size: 0.75rem;
                padding: 0.2rem 0.4rem;
                margin-bottom: 0;
                border-radius: 0.25rem;
                text-align: center;
                transition: none;
                
                &:focus {
                    outline: none;
                    box-shadow: none;
                }
                
                &:active {
                    background-color: transparent;
                    color: inherit;
                }
                
                &.active {
                    background-color: var(--bs-primary);
                    color: white;
                }
                
                &:hover:not(.active) {
                    background-color: var(--bs-light);
                }
            }
        }
        
        .dropdown-header {
            font-size: 0.875rem;
            font-weight: 500;
            margin-bottom: 0.25rem;
            text-align: left;
            padding-left: 0;
            color: #6c757d;
            padding-bottom: 0.2rem;
            position: relative;
            display: inline-block;
            
            &::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 0;
                width: 88%;
                height: 2px;
                background-color: var(--bs-primary);
                line-height: 2px;
            }
        }
        
        .dropdown-divider {
            margin: 0.75rem 0;
        }
    }
}

// Dark theme support
.dark {
    .time-range-selector {
        .time-range-dropdown {
            background-color: var(--bs-dark);
            border-color: var(--bs-secondary);
            
            .custom-range-section {
                .duration-display {
                    background-color: var(--bs-secondary);
                    color: var(--bs-light);
                }
            }
            
            .quick-ranges-section {
                .dropdown-item {
                    color: var(--bs-light);
                    
                    &:hover:not(.active) {
                        background-color: var(--bs-secondary);
                    }
                }
            }
            
            .dropdown-header {
                color: var(--bs-light);
            }
        }
    }
}
</style>
