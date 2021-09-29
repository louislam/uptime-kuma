const { checkStatusCode } = require("./util-server");
const { UP } = require("../src/util");
const get = require("lodash.get");

function validateMonitorChecks(res, checks, bean) {
    const responseText = typeof data === "string" ? res.data : JSON.stringify(res.data);
    let checkObj;

    (this.checks || []).forEach(check => {
        switch (check.type) {
            case "HTTP_STATUS_CODE_SHOULD_EQUAL":
                if (checkStatusCode(res.status, check.value)) {
                    bean.msg += `, status matches '${check.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(bean.msg + ", but status code dit not match " + check.value);
                }
                break;

            case "RESPONSE_SHOULD_CONTAIN_TEXT":
                if (responseText.includes(check.value)) {
                    bean.msg += `, response contains '${check.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(bean.msg + ", but response does not contain '" + check.value + "'");
                }
                break;

            case "RESPONSE_SHOULD_NOT_CONTAIN_TEXT":
                if (!responseText.includes(check.value)) {
                    bean.msg += `, response does not contain '${check.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(bean.msg + ", but response does contain '" + check.value + "'");
                }
                break;

            case "RESPONSE_SHOULD_MATCH_REGEX":
                if (responseText.test(new RegExp(check.value))) {
                    bean.msg += `, regex '${check.value}' matches`;
                    bean.status = UP;
                } else {
                    throw new Error(bean.msg + ", but response does not match regex: '" + check.value + "'");
                }
                break;

            case "RESPONSE_SHOULD_NOT_MATCH_REGEX":
                if (!responseText.test(new RegExp(check.value))) {
                    bean.msg += `, regex '${check.value}' does not matches`;
                    bean.status = UP;
                } else {
                    throw new Error(bean.msg + ", but response does match regex: '" + check.value + "'");
                }
                break;

            case "RESPONSE_SELECTOR_SHOULD_EQUAL":
                checkObj = JSON.parse(check.value);
                if (get(res, checkObj.selector) === checkObj.value) {
                    bean.msg += `, response selector equals '${checkObj.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${checkObj.selector}' does not equal '${checkObj.value}'`);
                }
                break;

            case "RESPONSE_SELECTOR_SHOULD_NOT_EQUAL":
                checkObj = JSON.parse(check.value);
                if (get(res, checkObj.selector) !== checkObj.value) {
                    bean.msg += `, response selector does not equal '${checkObj.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${checkObj.selector}' does equal '${checkObj.value}'`);
                }
                break;

            case "RESPONSE_SELECTOR_SHOULD_MATCH_REGEX":
                checkObj = JSON.parse(check.value);
                if (get(res, checkObj.selector).test(new RegExp(checkObj.value))) {
                    bean.msg += `, response selector matches regex '${checkObj.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${checkObj.selector}' does not match regex '${checkObj.value}'`);
                }
                break;

            case "RESPONSE_SELECTOR_SHOULD_NOT_MATCH_REGEX":
                checkObj = JSON.parse(check.value);
                if (!get(res, checkObj.selector).test(new RegExp(checkObj.value))) {
                    bean.msg += `, response selector does not match regex '${checkObj.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${checkObj.selector}' does match regex '${checkObj.value}'`);
                }
                break;

            default:
                throw new Error(`${bean.msg}, encountered unknown monitor_check.type`);
        }
    });
}

module.exports = validateMonitorChecks;
