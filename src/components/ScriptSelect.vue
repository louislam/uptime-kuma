<template>
    <VueMultiselect
        ref="select"
        v-model="internalValue"
        :options="entries"
        track-by="name"
        label="name"
        :class="isLoading ? 'loading': ''"
        :close-on-select="false"
        :clear-on-select="true"
        :preserve-search="true"
        :allow-empty="false"
        :loading="isLoading"
        :multiple="false"
        required
        @select="onSelect"
    >
        <template #option="props">
            <span class="entry">{{ (props.option.isDirectory ? "📁 " : "") + props.option.name }}</span>
        </template>
        <template #beforeList>
            <ul ref="breadcrumbs">
                <li class="breadcrumb">
                    <a data-index="0" @click="onBreadcrumbClick">
                        {{ $t("script dir") }}
                    </a>
                </li>
                <li v-for="(dir, index) in subpath" :key="index + 1" class="breadcrumb">
                    <a :data-index="index + 1" @click="onBreadcrumbClick">
                        {{ dir }}
                    </a>
                </li>
            </ul>
        </template>
        <template #placeholder>
            {{ $t("Select script") }}
        </template>
    </VueMultiselect>
</template>

<script>
import VueMultiselect from "vue-multiselect";
import path from "path-browserify";

export default {
    components: { VueMultiselect },
    props: {
        modelValue: {
            type: String,
            required: true
        }
    },
    emits: {
        'update:modelValue': null
    },
    data() {
        return {
            entries: [],
            subpath: [],
            isLoading: false,
        };
    },
    computed: {
        internalValue: {
            get() {
                if (!this.modelValue) {
                    return null;
                }

                return this.entries.find((entry) => path.posix.join(...this.subpath, entry.name) === this.modelValue);
            },
            set(option) {
                if (!option) {
                    this.$emit("update:modelValue", null);
                    return;
                }

                const selected = path.posix.join(...this.subpath, option.name);
                this.$emit("update:modelValue", selected);
            },
        },
    },
    watch: {
        subpath() {
            this.loadEntries();
        },
    },
    mounted() {
        // Ellipsize breadcrumbs if they are too wide
        // Last one should always be shown, if there is more space make sure the root is shown
        // Then start removing from left
        this._observer = new ResizeObserver(() => {
            // Generator for iterating over breadcrumbs in priority order
            // Given a non-negative number n, iterates:
            // n-1, 0, n-2, n-3, ..., 1
            // eslint-disable-next-line jsdoc/require-jsdoc
            function* prioritized(length) {
                if (length < 0) {
                    throw new Error("Illegal argument: length must be larger or equal to zero, but was " + length);
                }

                if (length === 0) {
                    return;
                }

                yield length - 1;
                if (length > 1) {
                    yield 0;
                }
                for (let i = length - 2; i > 0; i--) {
                    yield i;
                }
            }
            // Helper function to get all nodes between an element and the ancestor
            // eslint-disable-next-line jsdoc/require-jsdoc
            function pathToAncestor(el, ancestor) {
                const result = [];
                let current = el;
                while (current && current !== ancestor) {
                    result.push(current);
                    current = current.parentElement;
                }
                return result;
            }
            // Helper function to find the intersection of all passed rectangles
            // eslint-disable-next-line jsdoc/require-jsdoc
            function intersectRect(...rects) {
                const result = {
                    left: Math.max(...rects.map((r) => r.left)),
                    top: Math.max(...rects.map((r) => r.top)),
                    right: Math.min(...rects.map((r) => r.right)),
                    bottom: Math.min(...rects.map((r) => r.bottom)),
                };
                result.x = result.left;
                result.y = result.top;
                result.width = result.right - result.left;
                result.height = result.bottom - result.top;
                return result;
            }

            const ul = this.$refs.breadcrumbs;
            if (!ul) {
                console.warn("Could not find breadcrumbs tracker element. Ellipsizing disabled.");
                return;
            }

            const crumbs = Array.from(ul.querySelectorAll(".breadcrumb"));

            // Initially, show all breadcrumbs
            crumbs.forEach((crumb) => crumb.classList.remove("ellipsized"));

            // if (ul.scrollWidth <= hostRect.width)
            //     return; // Everything fits, so opt out early

            // Breadcrumbs tracker is clipped by a scrolling container, which getBoundingClientRect() doesn't account for
            // So manually clip with all bounding rects between the tracker and the select element
            const hostRect = intersectRect(
                ...pathToAncestor(ul, this.$refs.select.$el).map((el) => el.getBoundingClientRect())
            );

            // Calculate crumb widths
            // Conceptually, every crumb consists of the crumb itself and the gap before it (except the root crumb, which doesn't have a gap)
            const widths = crumbs
                .map((crumb) => crumb.getBoundingClientRect()) // normalize coordinates to breadcrumbs tracker
                .map((rect) => ({
                    left: rect.left - hostRect.left,
                    right: rect.right - hostRect.left,
                }))
                .map((rect, index, rects) => rect.right - (index > 0 ? rects[index - 1].right : rect.left));

            // Accumulated width
            let accumulator = 0;
            // Have we started ellipsizing?
            let ellipsizing = false;
            for (const i of prioritized(crumbs.length)) {
                const crumb = crumbs[i];
                const width = widths[i];

                if (accumulator + width <= hostRect.width && !ellipsizing) {
                    accumulator += width;
                } else {
                    crumb.classList.add("ellipsized");
                    ellipsizing = true;
                }
            }
        });
        this._observer.observe(this.$refs.breadcrumbs);
        window.vue = this;
    },
    beforeUnmount() {
        this._observer.disconnect();
    },
    created() {
        this.loadEntries();
    },
    methods: {
        async loadEntries() {
            const subpath = this.subpath.length > 0 ? path.posix.join(...this.subpath) : "";
            this.isLoading = true;

            const entries = new Promise((resolve, reject) => this.$root.getSocket().emit("getScripts", subpath, res => res.ok ? resolve(res.entries) : reject(res.msg)))
                .then(entries => {
                    const collator = new Intl.Collator();
                    entries.sort((a, b) =>
                        // Sort order:
                        // Directories lexicographically first
                        // Files lexicographically after
                        b.isDirectory !== a.isDirectory
                            ? b.isDirectory - a.isDirectory
                            : collator.compare(a.name, b.name)
                    );
                    // Add "up" navigation entry
                    if (this.subpath.length > 0) {
                        entries.unshift({
                            name: "..",
                            isDirectory: true,
                        });
                    }
                    return entries;
                });

            let animations;            
            if (this.$refs.select) {
                await this.$nextTick(); // Allow DOM to catch up to isLoading = true
                animations = Array.from(this.$refs.select.$el.querySelectorAll(".entry"))
                    .flatMap(el => el.getAnimations())
                    .map(anim => anim.finished);
            } else {
                animations = [];
            }

            try {
                await Promise.all(animations); // Wait for outgoing animations to finish
                this.entries = await entries;
            } catch(err) {
                this.$root.toastError(err.message);
                this.subpath = subpath.split(path.posix.sep).slice(0, -1);
            } finally {
                this.isLoading = false;
            }
        },
        onSelect(entry) {
            if (!entry.isDirectory) {
                // A selection has been made - close the dropdown
                this.$refs.select.deactivate();
                return;
            }
            if (entry.name === "..") {
                this.subpath = this.subpath.slice(0, -1);
            } else {
                this.subpath = [...this.subpath, entry.name];
            }
            this.internalValue = null;
        },
        onBreadcrumbClick(e) {
            const index = e.target.dataset.index;
            this.subpath = this.subpath.slice(0, index);
        },
    },
};
</script>

<style lang="scss" scoped>
@import "../assets/vars.scss";

ul {
    display: flex;
    width: max-content;
    flex-direction: row;
    list-style: none;
    padding: 0;
    gap: 1rem;
    font-size: 75%;
    margin: 0.5rem;
    padding-left: 12px;
    padding-right: 12px;
    color: $secondary-text;
}

.breadcrumb[data-index="0"] {
    font-style: italic;
}

.breadcrumb + .breadcrumb::before {
    content: "/";
    position: absolute;
    left: -0.5rem;
    transform: translateX(-50%);
    display: inline-block;
}

.breadcrumb {
    display: flex;
    position: relative;
    align-items: center;
    white-space: nowrap;

    a {
        cursor: pointer;
        margin-bottom: 0;
        color: inherit;
    }
}

// Hide all ellipsized breadcrumbs except the first one
.ellipsized:not(:nth-child(1 of .ellipsized)) {
    display: none;
}
// On the first one, just hide the actual contents, and add "..." instead
.ellipsized:nth-child(1 of .ellipsized) {
    & > * {
        display: none;
    }

    &::after {
        content: "...";
    }
}

.entry {
    animation-duration: 0.2s;
    animation-fill-mode: forwards;
}

.multiselect:not(.loading) .entry {
    background: none;
    animation-name: fadein;
}

.loading .entry {
    animation-name: fadeout;
}

@keyframes fadein {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes fadeout {
    from { opacity: 1; }
    to { opacity: 0; }
}
</style>
