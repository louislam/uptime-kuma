const { R } = require("redbean-node");
const { checkLogin } = require("../util-server");
const dayjs = require("dayjs");

module.exports.statusPageSocketHandler = (socket) => {

    // Post or edit incident
    socket.on("postIncident", async (incident, callback) => {
        try {
            checkLogin(socket);

            await R.exec("UPDATE incident SET pin = 0 ");

            let incidentBean;

            if (incident.id) {
                incidentBean = await R.findOne("incident", " id = ?", [
                    incident.id
                ]);
            }

            if (incidentBean == null) {
                incidentBean = R.dispense("incident");
            }

            incidentBean.title = incident.title;
            incidentBean.content = incident.content;
            incidentBean.style = incident.style;
            incidentBean.pin = true;
            incidentBean.createdDate = R.isoDateTime(dayjs.utc());
            await R.store(incidentBean);

            callback({
                ok: true,
                incident: incidentBean.toPublicJSON(),
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

    socket.on("unpinIncident", async (callback) => {
        try {
            checkLogin(socket);

            await R.exec("UPDATE incident SET pin = 0 WHERE pin = 1");

            callback({
                ok: true,
            });
        } catch (error) {
            callback({
                ok: false,
                msg: error.message,
            });
        }
    });
};
