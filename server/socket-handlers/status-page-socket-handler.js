const { R } = require("redbean-node");
const { checkLogin, setSettings } = require("../util-server");
const dayjs = require("dayjs");
const { debug } = require("../../src/util");
const ImageDataURI = require("../image-data-uri");
const Database = require("../database");
const apicache = require("../modules/apicache");

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
    // imgDataUrl Only Accept PNG!
    socket.on("saveStatusPage", async (config, imgDataUrl, publicGroupList, callback) => {

        try {
            checkLogin(socket);

            apicache.clear();

            const header = "data:image/png;base64,";

            // Check logo format
            // If is image data url, convert to png file
            // Else assume it is a url, nothing to do
            if (imgDataUrl.startsWith("data:")) {
                if (! imgDataUrl.startsWith(header)) {
                    throw new Error("Only allowed PNG logo.");
                }

                // Convert to file
                await ImageDataURI.outputFile(imgDataUrl, Database.uploadDir + "logo.png");
                config.logo = "/upload/logo.png?t=" + Date.now();

            } else {
                config.icon = imgDataUrl;
            }

            // Save Config
            await setSettings("statusPage", config);

            // Save Public Group List
            const groupIDList = [];
            let groupOrder = 1;

            for (let group of publicGroupList) {
                let groupBean;
                if (group.id) {
                    groupBean = await R.findOne("group", " id = ? AND public = 1 ", [
                        group.id
                    ]);
                } else {
                    groupBean = R.dispense("group");
                }

                groupBean.name = group.name;
                groupBean.public = true;
                groupBean.weight = groupOrder++;

                await R.store(groupBean);

                await R.exec("DELETE FROM monitor_group WHERE group_id = ? ", [
                    groupBean.id
                ]);

                let monitorOrder = 1;
                console.log(group.monitorList);

                for (let monitor of group.monitorList) {
                    let relationBean = R.dispense("monitor_group");
                    relationBean.weight = monitorOrder++;
                    relationBean.group_id = groupBean.id;
                    relationBean.monitor_id = monitor.id;
                    await R.store(relationBean);
                }

                groupIDList.push(groupBean.id);
                group.id = groupBean.id;
            }

            // Delete groups that not in the list
            debug("Delete groups that not in the list");
            const slots = groupIDList.map(() => "?").join(",");
            await R.exec(`DELETE FROM \`group\` WHERE id NOT IN (${slots})`, groupIDList);

            callback({
                ok: true,
                publicGroupList,
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
