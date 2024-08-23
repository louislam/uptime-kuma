/**
 * Copy from node_modules/dayjs/plugin/timezone.js
 * Try to fix https://github.com/louislam/uptime-kuma/issues/2318
 * Source: https://github.com/iamkun/dayjs/tree/dev/src/plugin/utc
 * License: MIT
 */
import { MIN, MS } from "../../constant";
let typeToPos = {
    year: 0,
    month: 1,
    day: 2,
    hour: 3,
    minute: 4,
    second: 5
}; // Cache time-zone lookups from Intl.DateTimeFormat,
// as it is a *very* slow method.

let dtfCache = {};

let getDateTimeFormat = function getDateTimeFormat(timezone, options) {
    if (options === void 0) {
        options = {};
    }

    let timeZoneName = options.timeZoneName || "short";
    let key = timezone + "|" + timeZoneName;
    let dtf = dtfCache[key];

    if (!dtf) {
        dtf = new Intl.DateTimeFormat("en-US", {
            hour12: false,
            timeZone: timezone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZoneName: timeZoneName
        });
        dtfCache[key] = dtf;
    }

    return dtf;
};

export default (function (o, c, d) {
    let defaultTimezone;

    let makeFormatParts = function makeFormatParts(timestamp, timezone, options) {
        if (options === void 0) {
            options = {};
        }

        let date = new Date(timestamp);
        let dtf = getDateTimeFormat(timezone, options);
        return dtf.formatToParts(date);
    };

    let tzOffset = function tzOffset(timestamp, timezone) {
        let formatResult = makeFormatParts(timestamp, timezone);
        let filled = [];

        for (let i = 0; i < formatResult.length; i += 1) {
            let _formatResult$i = formatResult[i];
            let type = _formatResult$i.type;
            let value = _formatResult$i.value;
            let pos = typeToPos[type];

            if (pos >= 0) {
                filled[pos] = parseInt(value, 10);
            }
        }

        let hour = filled[3]; // Workaround for the same behavior in different node version
        // https://github.com/nodejs/node/issues/33027

        /* istanbul ignore next */

        let fixedHour = hour === 24 ? 0 : hour;
        let utcString = filled[0] + "-" + filled[1] + "-" + filled[2] + " " + fixedHour + ":" + filled[4] + ":" + filled[5] + ":000";
        let utcTs = d.utc(utcString).valueOf();
        let asTS = +timestamp;
        let over = asTS % 1000;
        asTS -= over;
        return (utcTs - asTS) / (60 * 1000);
    }; // find the right offset a given local time. The o input is our guess, which determines which
    // offset we'll pick in ambiguous cases (e.g. there are two 3 AMs b/c Fallback DST)
    // https://github.com/moment/luxon/blob/master/src/datetime.js#L76

    let fixOffset = function fixOffset(localTS, o0, tz) {
    // Our UTC time is just a guess because our offset is just a guess
        let utcGuess = localTS - o0 * 60 * 1000; // Test whether the zone matches the offset for this ts

        let o2 = tzOffset(utcGuess, tz); // If so, offset didn't change and we're done

        if (o0 === o2) {
            return [ utcGuess, o0 ];
        } // If not, change the ts by the difference in the offset

        utcGuess -= (o2 - o0) * 60 * 1000; // If that gives us the local time we want, we're done

        let o3 = tzOffset(utcGuess, tz);

        if (o2 === o3) {
            return [ utcGuess, o2 ];
        } // If it's different, we're in a hole time.
        // The offset has changed, but the we don't adjust the time

        return [ localTS - Math.min(o2, o3) * 60 * 1000, Math.max(o2, o3) ];
    };

    let proto = c.prototype;

    proto.tz = function (timezone, keepLocalTime) {
        if (timezone === void 0) {
            timezone = defaultTimezone;
        }

        let oldOffset = this.utcOffset();
        let date = this.toDate();
        let target = date.toLocaleString("en-US", {
            timeZone: timezone
        }).replace("\u202f", " ");
        let diff = Math.round((date - new Date(target)) / 1000 / 60);
        let ins = d(target).$set(MS, this.$ms).utcOffset(-Math.round(date.getTimezoneOffset() / 15) * 15 - diff, true);

        if (keepLocalTime) {
            let newOffset = ins.utcOffset();
            ins = ins.add(oldOffset - newOffset, MIN);
        }

        ins.$x.$timezone = timezone;
        return ins;
    };

    proto.offsetName = function (type) {
    // type: short(default) / long
        let zone = this.$x.$timezone || d.tz.guess();
        let result = makeFormatParts(this.valueOf(), zone, {
            timeZoneName: type
        }).find(function (m) {
            return m.type.toLowerCase() === "timezonename";
        });
        return result && result.value;
    };

    let oldStartOf = proto.startOf;

    proto.startOf = function (units, startOf) {
        if (!this.$x || !this.$x.$timezone) {
            return oldStartOf.call(this, units, startOf);
        }

        let withoutTz = d(this.format("YYYY-MM-DD HH:mm:ss:SSS"));
        let startOfWithoutTz = oldStartOf.call(withoutTz, units, startOf);
        return startOfWithoutTz.tz(this.$x.$timezone, true);
    };

    d.tz = function (input, arg1, arg2) {
        let parseFormat = arg2 && arg1;
        let timezone = arg2 || arg1 || defaultTimezone;
        let previousOffset = tzOffset(+d(), timezone);

        if (typeof input !== "string") {
            // timestamp number || js Date || Day.js
            return d(input).tz(timezone);
        }

        let localTs = d.utc(input, parseFormat).valueOf();

        let _fixOffset = fixOffset(localTs, previousOffset, timezone);
        let targetTs = _fixOffset[0];
        let targetOffset = _fixOffset[1];

        let ins = d(targetTs).utcOffset(targetOffset);
        ins.$x.$timezone = timezone;
        return ins;
    };

    d.tz.guess = function () {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    };

    d.tz.setDefault = function (timezone) {
        defaultTimezone = timezone;
    };
});
