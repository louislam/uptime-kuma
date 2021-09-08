class LimitArray {
    limit = 100;
    array = [];

    add(item) {
        this.array.push(item);
        if (this.array.length > this.limit) {
            this.array.shift();
        }
    }
}

module.exports = LimitArray;
