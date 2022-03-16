const { BeanModel } = require("redbean-node/dist/bean-model");
const { R } = require("redbean-node");

class StatusPage extends BeanModel {

    static async sendStatusPageList(io, socket) {
        let result = {};

        let list = await R.findAll("status_page", " ORDER BY title ");

        for (let item of list) {
            result[item.id] = await item.toJSON();
        }

        io.to(socket.userID).emit("statusPageList", result);
        return list;
    }

    async toJSON() {
        return {
            id: this.id,
            slug: this.slug,
            title: this.title,
            description: this.description,
            icon: this.icon,
            theme: this.theme,
            published: !!this.published,
            showTags: !!this.show_tags,
        };
    }

    async toPublicJSON() {
        return {
            slug: this.slug,
            title: this.title,
            description: this.description,
            icon: this.icon,
            theme: this.theme,
            published: !!this.published,
            showTags: !!this.show_tags,
        };
    }

}

module.exports = StatusPage;
