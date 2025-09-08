<template>
    <div class="time-range-selector">
        <div class="dropdown">
            <button 
                class="btn btn-outline-secondary btn-sm dropdown-toggle" 
                type="button" 
                data-bs-toggle="dropdown" 
                aria-expanded="false"
            >
                <font-awesome-icon icon="clock" />
                {{ selectedRangeLabel }}
            </button>
            <ul class="dropdown-menu">
                <li><h6 class="dropdown-header">Custom range</h6></li>
                <li>
                    <div class="px-3 py-2" @click.stop>
                        
                        <!-- Quick custom presets -->
                        <div class="mb-2">
                            <div class="btn-group w-100" role="group">
                                <button 
                                    type="button" 
                                    class="btn btn-outline-secondary btn-sm"
                                    @click="setCustomPreset('yesterday')"
                                >
                                    Yesterday
                                </button>
                                <button 
                                    type="button" 
                                    class="btn btn-outline-secondary btn-sm"
                                    @click="setCustomPreset('thisWeek')"
                                >
                                    This Week
                                </button>
                                <button 
                                    type="button" 
                                    class="btn btn-outline-secondary btn-sm"
                                    @click="setCustomPreset('lastWeek')"
                                >
                                    Last Week
                                </button>
                            </div>
                        </div>
                        
                        <!-- Date/time inputs -->
                        <div class="row g-2">
                            <div class="col-12">
                                <label class="form-label form-label-sm mb-1">From:</label>
                                <input 
                                    v-model="customFrom" 
                                    type="datetime-local" 
                                    class="form-control form-control-sm"
                                    :max="customTo"
                                    @change="updateCustomRange"
                                >
                            </div>
                            <div class="col-12">
                                <label class="form-label form-label-sm mb-1">To:</label>
                                <input 
                                    v-model="customTo" 
                                    type="datetime-local" 
                                    class="form-control form-control-sm"
                                    :min="customFrom"
                                    @change="updateCustomRange"
                                >
                            </div>
                        </div>
                        
                        <!-- Range info -->
                        <div v-if="customRangeInfo" class="mt-2">
                            <small class="text-muted">{{ customRangeInfo }}</small>
                        </div>
                    </div>
                </li>
                
                <li><hr class="dropdown-divider"></li>
                <li><h6 class="dropdown-header">Quick ranges</h6></li>
                <li v-for="range in quickRanges" :key="range.value">
                    <a 
                        class="dropdown-item" 
                        href="#" 
                        :class="{ active: selectedRange === range.value }"
                        @click.prevent="selectRange(range.value, range.label)"
                    >
                        {{ range.label }}
                    </a>
                </li>
            </ul>
        </div>
    </div>
</template>

<script>
export default {
    name: "TimeRangeSelector",
    emits: ["range-changed"],
    data() {
        return {
            selectedRange: "24h",
            selectedRangeLabel: "Last 24 hours",
            customFrom: "",
            customTo: "",
            quickRanges: [
                { value: "5m", label: "Last 5 minutes" },
                { value: "1h", label: "Last 1 hour" },
                { value: "24h", label: "Last 24 hours" },
                { value: "7d", label: "Last 7 days" },
                { value: "30d", label: "Last 30 days" }
            ]
        };
    },
    computed: {
        customRangeInfo() {
            if (!this.customFrom || !this.customTo) return null;
            
            const from = new Date(this.customFrom);
            const to = new Date(this.customTo);
            const diffMs = to - from;
            
            if (diffMs <= 0) return "Invalid range";
            
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
            
            if (diffDays > 0) {
                return `Duration: ${diffDays}d ${diffHours}h ${diffMinutes}m`;
            } else if (diffHours > 0) {
                return `Duration: ${diffHours}h ${diffMinutes}m`;
            } else {
                return `Duration: ${diffMinutes}m`;
            }
        }
    },
    mounted() {
        this.initializeCustomDates();
        this.emitRangeChange();
    },
    methods: {
        selectRange(value, label) {
            this.selectedRange = value;
            this.selectedRangeLabel = label;
            this.emitRangeChange();
        },
        
        updateCustomRange() {
            if (this.customFrom && this.customTo) {
                const from = new Date(this.customFrom);
                const to = new Date(this.customTo);
                
                if (from >= to) {
                    // Auto-adjust if from is after to
                    this.customTo = this.formatDateTimeLocal(new Date(from.getTime() + 60 * 60 * 1000)); // Add 1 hour
                }
                
                this.selectedRange = "custom";
                this.selectedRangeLabel = this.formatCustomRangeLabel(from, to);
                this.emitRangeChange();
            }
        },

        setCustomPreset(preset) {
            const now = new Date();
            let from, to;
            
            switch (preset) {
                case 'yesterday':
                    from = new Date(now);
                    from.setDate(now.getDate() - 1);
                    from.setHours(0, 0, 0, 0);
                    to = new Date(from);
                    to.setHours(23, 59, 59, 999);
                    break;
                    
                case 'thisWeek':
                    from = new Date(now);
                    from.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
                    from.setHours(0, 0, 0, 0);
                    to = new Date(now);
                    break;
                    
                case 'lastWeek':
                    from = new Date(now);
                    from.setDate(now.getDate() - now.getDay() - 7); // Start of last week
                    from.setHours(0, 0, 0, 0);
                    to = new Date(from);
                    to.setDate(from.getDate() + 6); // End of last week
                    to.setHours(23, 59, 59, 999);
                    break;
            }
            
            this.customFrom = this.formatDateTimeLocal(from);
            this.customTo = this.formatDateTimeLocal(to);
            this.updateCustomRange();
        },
        
        initializeCustomDates() {
            const now = new Date();
            const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
            
            this.customTo = this.formatDateTimeLocal(now);
            this.customFrom = this.formatDateTimeLocal(yesterday);
        },
        
        formatDateTimeLocal(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        },

        formatCustomRangeLabel(from, to) {
            const formatDate = (date, includeYear = false) => {
                const day = String(date.getDate()).padStart(2, '0');
                const month = date.toLocaleDateString('en-US', { month: 'short' });
                const year = includeYear ? ` ${date.getFullYear()}` : '';
                const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
                
                // If same day, show only time for 'to' date
                if (from.toDateString() === to.toDateString()) {
                    if (date === from) {
                        return `${day} ${month}${year}, ${time}`;
                    } else {
                        return time;
                    }
                }
                
                return `${day} ${month}${year}, ${time}`;
            };
            
            // Check if years are different
            const differentYears = from.getFullYear() !== to.getFullYear();
            
            return `${formatDate(from, differentYears)} - ${formatDate(to, differentYears)}`;
        },
        
        emitRangeChange() {
            let from, to;
            const now = new Date();
            
            if (this.selectedRange === "custom") {
                from = new Date(this.customFrom);
                to = new Date(this.customTo);
            } else {
                to = now;
                from = this.calculateFromTime(this.selectedRange, now);
            }
            
            this.$emit("range-changed", {
                from: from,
                to: to,
                range: this.selectedRange,
                label: this.selectedRangeLabel
            });
        },
        
        calculateFromTime(range, now) {
            const multipliers = {
                m: 60 * 1000,           // minutes
                h: 60 * 60 * 1000,      // hours  
                d: 24 * 60 * 60 * 1000  // days
            };
            
            const match = range.match(/^(\d+)([mhd])$/);
            if (!match) return new Date(now.getTime() - 24 * 60 * 60 * 1000); // default 24h
            
            const [, amount, unit] = match;
            const milliseconds = parseInt(amount) * multipliers[unit];
            
            return new Date(now.getTime() - milliseconds);
        }
    }
};
</script>

<style scoped>
.time-range-selector {
    display: inline-block;
}

.dropdown-item.active {
    background-color: var(--bs-primary);
    color: white;
}

.dropdown-menu {
    min-width: 400px;
    padding: 0.75rem;
}

.form-control-sm {
    font-size: 0.75rem;
}

.form-label-sm {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--bs-gray-700);
}

.btn-group .btn-sm {
    font-size: 0.7rem;
    padding: 0.25rem 0.5rem;
}

.dropdown-item {
    font-size: 0.875rem;
}
</style>
