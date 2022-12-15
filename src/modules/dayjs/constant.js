export let SECONDS_A_MINUTE = 60;
export let SECONDS_A_HOUR = SECONDS_A_MINUTE * 60;
export let SECONDS_A_DAY = SECONDS_A_HOUR * 24;
export let SECONDS_A_WEEK = SECONDS_A_DAY * 7;
export let MILLISECONDS_A_SECOND = 1e3;
export let MILLISECONDS_A_MINUTE = SECONDS_A_MINUTE * MILLISECONDS_A_SECOND;
export let MILLISECONDS_A_HOUR = SECONDS_A_HOUR * MILLISECONDS_A_SECOND;
export let MILLISECONDS_A_DAY = SECONDS_A_DAY * MILLISECONDS_A_SECOND;
export let MILLISECONDS_A_WEEK = SECONDS_A_WEEK * MILLISECONDS_A_SECOND; // English locales

export let MS = "millisecond";
export let S = "second";
export let MIN = "minute";
export let H = "hour";
export let D = "day";
export let W = "week";
export let M = "month";
export let Q = "quarter";
export let Y = "year";
export let DATE = "date";
export let FORMAT_DEFAULT = "YYYY-MM-DDTHH:mm:ssZ";
export let INVALID_DATE_STRING = "Invalid Date"; // regex

export let REGEX_PARSE = /^(\d{4})[-/]?(\d{1,2})?[-/]?(\d{0,2})[Tt\s]*(\d{1,2})?:?(\d{1,2})?:?(\d{1,2})?[.:]?(\d+)?$/;
export let REGEX_FORMAT = /\[([^\]]+)]|Y{1,4}|M{1,4}|D{1,2}|d{1,4}|H{1,2}|h{1,2}|a|A|m{1,2}|s{1,2}|Z{1,2}|SSS/g;
