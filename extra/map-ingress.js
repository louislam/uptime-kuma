const { debug } = require("../src/util");
const fs = require("fs");
const axios = require("axios");
const https = require("https");
const args = require("args-parser")(process.argv);
let kubernetes = process.env.KUBERNETES_MASTER || args.kubernetes || "https://kubernetes.default";
let ingressAnnotation = "uptime-kuma.ingress.kubernetes.io/monitor";
let importAllIngresses = process.env.IMPORT_ALL_INGRESSES || args.importAllIngresses || false;
let ingressNamespaces = process.env.INGRESS_NAMESPACES || args.ingressNamespaces || "";
let defaultInterval = process.env.MONITOR_INTERVAL || args.monitorInterval || "60";
let kubernetesTokenFile = process.env.KUBERNETES_TOKEN_FILE || args.kubernetesTokenFile || "/run/secrets/kubernetes.io/serviceaccount/token";
let kubernetesToken = process.env.KUBERNETES_TOKEN || args.kubernetesToken || null;
let ownerId = process.env.OWNER_ID || args.ownerId || 1;

debug("Importing Database");
const Database = require("../server/database");
const { R } = require("redbean-node");

const findIngresses = async () => {
    debug("Connecting to " + kubernetes + " to collect ingresses");
    if (!kubernetesToken) {
        kubernetesToken = fs.readFileSync(kubernetesTokenFile).toString().replace("\n", "");
    }

    const promises = [];

    const config = {
        httpsAgent: new https.Agent({
            rejectUnauthorized: false,
        }),
        headers: {
            Authorization: "Bearer " + kubernetesToken,
            Accept: "application/json",
        },
    };
    let namespaces = ingressNamespaces.split(",").filter(ns => ns !== "");
    if (namespaces.length === 0) {
        promises.push(axios.get(kubernetes + "/apis/networking.k8s.io/v1/ingresses", config).then(res => res.data));
    } else {
        namespaces.forEach(ns => {
            promises.push(axios.get(kubernetes + "/apis/networking.k8s.io/v1/namespaces/" + ns + "/ingresses", config).then(res => res.data));
        });
    }

    return Promise.all(promises).then(ingressLists => {
        return ingressLists.reduce((ingresses, ingressList) => {
            return ingresses.concat(ingressList.items.filter(i => {
                return importAllIngresses || !!i.metadata.annotations[ingressAnnotation];
            }));
        }, []);
    });
};
const addMissingIngressesToDatabase = async (ingresses, monitorList, ingressTag) => {

    let domains = ingresses.reduce((domains, ingress) => {
        const namespace = ingress.metadata.namespace;

        // Check TLS hosts and routes
        if (ingress.spec.tls) {
            ingress.spec.tls.forEach(tls => {
                tls.hosts.forEach(host => {
                    if (!host) {
                        return;
                    }

                    const domain = host.toLowerCase();
                    if (host && !domains.find(d => d.domain === domain)) {
                        domains.push({ domain,
                            namespace });
                    }
                });
            });
        }

        if (ingress.spec.rules) {
            ingress.spec.rules.forEach(rule => {
                if (!rule.host) {
                    return;
                }

                const domain = rule.host.toLowerCase();
                if ( !domains.find(d => d.domain === domain)) {
                    domains.push({ domain,
                        namespace });
                }
            });
        }

        return domains;
    }, []);
    domains = domains.filter(d => !d.domain.startsWith("*"));
    debug("Found " + domains.length + " domains");

    // Add missing domains
    const missingDomains = domains.filter(domain => !monitorList.find(monitor => monitor.url.toLowerCase() === "https://" + domain.domain));
    debug("Found " + missingDomains.length + " missing monitors");
    for (let domain of missingDomains) {
        const monitor = await addMonitor(domain.domain);
        await addMonitorToGroup(monitor, "All Ingresses");
        await addMonitorToGroup(monitor, domain.namespace);
        await addMonitorTag(monitor, ingressTag);
    }

    //Remove missing monitors
    const missingMonitors = monitorList.filter(monitor => !domains.find(d => monitor.url.toLowerCase() === "https://" + d.domain));
    debug("Found " + missingMonitors.length + " outdated ingresses to be removed");
    for (let monitor of missingMonitors) {
        await R.trash(monitor);
    }
};

const addMonitorTag = async (monitor, tag) => {
    let monitorTag = await R.findOne("monitor_tag", "tag_id = ? and monitor_id = ?", [tag.id, monitor.id]);
    if (monitorTag) {
        return monitorTag;
    }

    monitorTag = await R.dispense("monitor_tag");
    monitorTag.tag_id = tag.id;
    monitorTag.monitor_id = monitor.id;
    monitorTag.value = "kubernetes";
    await R.store(monitorTag);

    return monitorTag;
};

const getIngressTag = async () => {
    let tag = await R.findOne("tag", "name = ?", ["Ingress"]);
    if (!tag) {
        tag = await R.dispense("tag");
        tag.name = "Ingress";
        tag.color = "#0048ff";
        await R.store(tag);
    }

    return tag;
};

const addMonitorToGroup = async (monitor, groupName) => {
    let group = await R.findOne("group", "name = ?", [groupName]);
    if (!group) {
        group = await R.dispense("group");
        group.name = groupName;
        group.public = 1;
        await R.store(group);
    }

    let monitorGroup = await R.findOne("monitor_group", "group_id = ? and monitor_id = ?", [group.id, monitor.id]);
    if (monitorGroup) {
        return monitorGroup;
    }

    let list = await group.getMonitorList();
    monitorGroup = await R.dispense("monitor_group");
    monitorGroup.group_id = group.id;
    monitorGroup.monitor_id = monitor.id;
    monitorGroup.weight = list.length + 1;
    await R.store(monitorGroup);

    return monitorGroup;
};

const addMonitor = async (domain) => {
    let bean = R.dispense("monitor");

    const monitor = {
        "type": "http",
        "name": domain,
        "url": "https://" + domain,
        "method": "GET",
        "interval": defaultInterval,
        "retryInterval": defaultInterval,
        "maxretries": 0,
        "ignoreTls": false,
        "upsideDown": false,
        "maxredirects": 10,
        "accepted_statuscodes_json": "[\"200-299\"]",
        "dns_resolve_type": "A",
        "dns_resolve_server": "1.1.1.1",
        "user_id": ownerId,
    };

    bean.import(monitor);
    await R.store(bean);
    return bean;
};

const findIngressList = async (ingressTag) => {
    const monitorIds = await R.getCol("SELECT monitor_id FROM monitor_tag WHERE tag_id = ?", [ingressTag.id]);
    let ids = monitorIds.join(",");
    let monitorList = await R.find("monitor", "id in (" + ids + ")");
    return monitorList;
};

const main = async () => {
    Database.init(args);
    await Database.connect();

    const ingresses = await findIngresses();
    debug("found " + ingresses.length + " ingresses!");

    let ingressTag = await getIngressTag();
    let monitorList = await findIngressList(ingressTag);
    await addMissingIngressesToDatabase(ingresses, monitorList, ingressTag);
};
main().then(() => {
    debug("Finished");
    process.exit(0);
});
