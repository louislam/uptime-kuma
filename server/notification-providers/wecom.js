const NotificationProvider = require("./notification-provider");
const axios = require("axios");
const { DOWN, UP } = require("../../src/util");

class WeCom extends NotificationProvider {
    name = "WeCom";

    async send(notification, msg, monitorJSON = null, heartbeatJSON = null) {
        let okMsg = "测试成功";
        let WeComUrl = "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=" + notification.weComBotKey;
        try {
            if (heartbeatJSON == null) {
				let currentTime = new Date().toLocaleString('zh-CN', { hour12: false }); // 获取当前时间，并格式化为字符串
                let testdata1 = {
    "msgtype": "markdown",
    "markdown": {
        "content": "监测到" + "某个业务系统" + "故障\n>故障时间为：" + currentTime + "\n>业务状态：" + "寄了！",
    }
};
                await axios.post(WeComUrl, testdata1);
                return okMsg;
            }

            if (heartbeatJSON["status"] == DOWN) {
				let currentTime = new Date().toLocaleString('zh-CN', { hour12: false }); // 获取当前时间，并格式化为字符串
                let downdata1 = {
    "msgtype": "markdown",
    "markdown": {
        "content": "监测发现" + monitorJSON["name"] + "故障\n>故障时间为：" + currentTime + "\n>业务状态：" + heartbeatJSON["msg"],
    }
};
                await axios.post(WeComUrl, downdata1);
                return okMsg;
            }

            if (heartbeatJSON["status"] == UP) {
                let updata = {
    "msgtype": "markdown",
    "markdown": {
        "content": "监测发现" + monitorJSON["name"] + "故障恢复了\n>恢复时间为:" + heartbeatJSON["time"] + "\n>业务状态：" + heartbeatJSON["msg"],
    }
};
                await axios.post(WeComUrl, updata);
                return okMsg;
            }
        } catch (error) {
            this.throwGeneralAxiosError(error);
        }
    }
}

module.exports = WeCom;
