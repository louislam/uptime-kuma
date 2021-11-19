const { checkStatusCode } = require("./util-server");
const { UP } = require("../src/util");
const get = require("lodash.get");

function validateMonitorChecks(res, checks, bean) {
    const responseText = typeof data === "string" ? res.data : JSON.stringify(res.data);

    (checks || []).forEach(check => {
        switch (check.type) {
            case "HTTP_STATUS_CODE_SHOULD_EQUAL":
                if (checkStatusCode(res.status, check.value)) {
                    bean.msg += `, status matches '${check.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(bean.msg + ", but status code does not match " + check.value);
                }
                break;

            case "HTTP_STATUS_CODE_SHOULD_NOT_EQUAL":
                if (!checkStatusCode(res.status, check.value)) {
                    bean.msg += `, status does not match '${check.value}'`;
                    bean.status = UP;
                } else {
                    throw new Error(bean.msg + ", but status code does match " + check.value);
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
                if (get(res.data, check.value.selectorPath) === check.value.selectorValue) {
                    bean.msg += `, response selector equals '${check.value.selectorValue}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${check.value.selectorPath}' does not equal '${check.value.selectorValue}'`);
                }
                break;

            case "RESPONSE_SELECTOR_SHOULD_NOT_EQUAL":
                if (get(res.data, check.value.selectorPath) !== check.value.selectorValue) {
                    bean.msg += `, response selector does not equal '${check.value.selectorValue}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${check.value.selectorPath}' does equal '${check.value.selectorValue}'`);
                }
                break;

            case "RESPONSE_SELECTOR_SHOULD_MATCH_REGEX":
                if (get(res.data, check.value.selectorPath).test(new RegExp(check.value.selectorValue))) {
                    bean.msg += `, response selector matches regex '${check.value.selectorValue}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${check.value.selectorPath}' does not match regex '${check.value.selectorValue}'`);
                }
                break;

            case "RESPONSE_SELECTOR_SHOULD_NOT_MATCH_REGEX":
                if (!get(res.data, check.value.selectorPath).test(new RegExp(check.value.selectorValue))) {
                    bean.msg += `, response selector does not match regex '${check.value.selectorValue}'`;
                    bean.status = UP;
                } else {
                    throw new Error(`${bean.msg}, but response selector '${check.value.selectorPath}' does match regex '${check.value.selectorValue}'`);
                }
                break;

            default:
                throw new Error(`${bean.msg}, encountered unknown monitor_check.type`);
        }
    });
    bean.status = UP;
}

module.exports = validateMonitorChecks;
