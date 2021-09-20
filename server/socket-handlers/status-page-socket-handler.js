const { R } = require("redbean-node");
const { checkLogin, setSettings } = require("../util-server");
const dayjs = require("dayjs");
const { debug } = require("../../src/util");

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

            if (incident.id) {
                incidentBean.lastUpdatedDate = R.isoDateTime(dayjs.utc());
            } else {
                incidentBean.createdDate = R.isoDateTime(dayjs.utc());
            }

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

    // Save Status Page
    socket.on("saveStatusPage", async (config, imgDataUrl, publicGroupList, callback) => {

        try {
            checkLogin(socket);

            await R.transaction(async (trx) => {
                // Save Config
                //TODO
                await setSettings("statusPage", config);

                // Save Icon

                // Save Public Group List
                const groupIDList = [];
                let groupOrder = 1;

                for (let group of publicGroupList) {
                    let groupBean;
                    if (group.id) {
                        groupBean = await trx.findOne("group", " id = ? AND public = 1 ", [
                            group.id
                        ]);
                    } else {
                        groupBean = R.dispense("group");
                    }

                    groupBean.name = group.name;
                    groupBean.public = true;
                    groupBean.weight = groupOrder++;

                    await trx.store(groupBean);

                    await trx.exec("DELETE FROM monitor_group WHERE group_id = ? ", [
                        groupBean.id
                    ]);

                    let monitorOrder = 1;
                    for (let monitor of group.monitorList) {
                        let relationBean = R.dispense("monitor_group");
                        relationBean.weight = monitorOrder++;
                        relationBean.group_id = groupBean.id;
                        relationBean.monitor_id = monitor.id;
                        await trx.store(relationBean);
                    }

                    groupIDList.push(groupBean.id);
                    group.id = groupBean.id;
                }

                // Delete groups that not in the list
                debug("Delete groups that not in the list");
                const slots = groupIDList.map(() => "?").join(",");
                await trx.exec(`DELETE FROM \`group\` WHERE id NOT IN (${slots})`, groupIDList);

                callback({
                    ok: true,
                    publicGroupList,
                });
            });
        } catch (error) {
            console.log(error);

            callback({
                ok: false,
                msg: error.message,
            });
        }
    });

};
