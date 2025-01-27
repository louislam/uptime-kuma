<template>
    <span>
        <template v-for="(part, index) in parts" :key="index">
            <a
                v-if="part.type === 'link'"
                :href="part.content"
                target="_blank"
                rel="noopener noreferrer"
            >{{ part.content }}</a>
            <span v-else>{{ part.content }}</span>
        </template>
    </span>
</template>

<script>
export default {
    name: "SafeLinks",
    props: {
        text: {
            type: String,
            required: true
        }
    },

    computed: {
        parts() {
            if (!this.text) {
                return [];
            }

            const urlPattern = /(\b(?:https?|ftp|file|smb|ssh|telnet|ldap|git):\/\/[-A-Z0-9+&@#/%?=~_|!:,.;]*[-A-Z0-9+&@#/%=~_|])/gi;
            const parts = [];
            let lastIndex = 0;

            this.text.replace(urlPattern, (match, url, offset) => {
                // Add text before the link
                if (offset > lastIndex) {
                    parts.push({
                        type: "text",
                        content: this.text.slice(lastIndex, offset)
                    });
                }

                // Add the link
                parts.push({
                    type: "link",
                    content: url
                });

                lastIndex = offset + match.length;
            });

            // Add remaining text after last link
            if (lastIndex < this.text.length) {
                parts.push({
                    type: "text",
                    content: this.text.slice(lastIndex)
                });
            }

            return parts;
        }
    }
};
</script>
