/**
 * Copy from node_modules/dayjs/plugin/timezone.js
 * Try to fix https://github.com/louislam/uptime-kuma/issues/2318
 * Source: https://github.com/iamkun/dayjs/tree/dev/src/plugin/utc
 * License: MIT
 */
!function (t, e) {
    // eslint-disable-next-line no-undef
    typeof exports == "object" && typeof module != "undefined" ? module.exports = e() : typeof define == "function" && define.amd ? define(e) : (t = typeof globalThis != "undefined" ? globalThis : t || self).dayjs_plugin_timezone = e();
}(this, (function () {
    "use strict";
    let t = {
        year: 0,
        month: 1,
        day: 2,
        hour: 3,
        minute: 4,
        second: 5
    };
    let e = {};
    return function (n, i, o) {
        let r;
        let a = function (t, n, i) {
            void 0 === i && (i = {});
            let o = new Date(t);
            let r = function (t, n) {
                void 0 === n && (n = {});
                let i = n.timeZoneName || "short";
                let o = t + "|" + i;
                let r = e[o];
                return r || (r = new Intl.DateTimeFormat("en-US", {
                    hour12: !1,
                    timeZone: t,
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    timeZoneName: i
                }), e[o] = r), r;
            }(n, i);
            return r.formatToParts(o);
        };
        let u = function (e, n) {
            let i = a(e, n);
            let r = [];
            let u = 0;
            for (; u < i.length; u += 1) {
                let f = i[u];
                let s = f.type;
                let m = f.value;
                let c = t[s];
                c >= 0 && (r[c] = parseInt(m, 10));
            }
            let d = r[3];
            let l = d === 24 ? 0 : d;
            let v = r[0] + "-" + r[1] + "-" + r[2] + " " + l + ":" + r[4] + ":" + r[5] + ":000";
            let h = +e;
            return (o.utc(v).valueOf() - (h -= h % 1e3)) / 6e4;
        };
        let f = i.prototype;
        f.tz = function (t, e) {
            void 0 === t && (t = r);
            let n = this.utcOffset();
            let i = this.toDate();
            let a = i.toLocaleString("en-US", { timeZone: t }).replace("\u202f", " ");
            let u = Math.round((i - new Date(a)) / 1e3 / 60);
            let f = o(a).$set("millisecond", this.$ms).utcOffset(15 * -Math.round(i.getTimezoneOffset() / 15) - u, !0);
            if (e) {
                let s = f.utcOffset();
                f = f.add(n - s, "minute");
            }
            return f.$x.$timezone = t, f;
        }, f.offsetName = function (t) {
            let e = this.$x.$timezone || o.tz.guess();
            let n = a(this.valueOf(), e, { timeZoneName: t }).find((function (t) {
                return t.type.toLowerCase() === "timezonename";
            }));
            return n && n.value;
        };
        let s = f.startOf;
        f.startOf = function (t, e) {
            if (!this.$x || !this.$x.$timezone) {
                return s.call(this, t, e);
            }
            let n = o(this.format("YYYY-MM-DD HH:mm:ss:SSS"));
            return s.call(n, t, e).tz(this.$x.$timezone, !0);
        }, o.tz = function (t, e, n) {
            let i = n && e;
            let a = n || e || r;
            let f = u(+o(), a);
            if (typeof t != "string") {
                return o(t).tz(a);
            }
            let s = function (t, e, n) {
                let i = t - 60 * e * 1e3;
                let o = u(i, n);
                if (e === o) {
                    return [ i, e ];
                }
                let r = u(i -= 60 * (o - e) * 1e3, n);
                return o === r ? [ i, o ] : [ t - 60 * Math.min(o, r) * 1e3, Math.max(o, r) ];
            }(o.utc(t, i).valueOf(), f, a);
            let m = s[0];
            let c = s[1];
            let d = o(m).utcOffset(c);
            return d.$x.$timezone = a, d;
        }, o.tz.guess = function () {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        }, o.tz.setDefault = function (t) {
            r = t;
        };
    };
}));
