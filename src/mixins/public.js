export default {
    data() {
        return {
            publicGroupList: [],
        }
    },
    computed: {
        publicMonitorList() {
            let result = {};

            for (let group of this.publicGroupList) {
                for (let monitor of group.monitorList) {
                    result[monitor.id] = monitor;
                }
            }

            return result;
        }
    }
}
