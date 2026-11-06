import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { getTimeZones } from "@vvo/tzdb";
import { localeDirection, currentLocale } from "./i18n";
import { POSITION } from "vue-toastification";
import { baseURL } from "./auth-client";

interface TimezoneOption {
    name: string;
    value: string;
    time: number;
}

interface ToastPluginOptions {
    position: string;
    containerClassName: string;
    showCloseButtonOnHover: boolean;
    filterBeforeCreate: (toast: { timeout?: number }, toasts: unknown[]) => unknown;
}

/**
 * Extend dayjs with the plugins the frontend uses
 * @returns The shared dayjs instance
 */
export function initDayjs(): Dayjs {
    dayjs.extend(utc);
    dayjs.extend(timezone);
    dayjs.extend(relativeTime);
    return dayjs;
}

/**
 * Returns the offset from UTC in hours for the current locale.
 * @param timeZone Timezone to get offset for
 * @returns The offset from UTC in hours.
 */
function getTimezoneOffset(timeZone: string): number {
    const now = new Date();
    const tzString = now.toLocaleString("en-US", {
        timeZone,
    });
    const localString = now.toLocaleString("en-US");
    const diff = (Date.parse(localString) - Date.parse(tzString)) / 3600000;
    const offset = diff + now.getTimezoneOffset() / 60;
    return -offset;
}

/**
 * Returns a list of timezones sorted by their offset from UTC.
 * @returns A list of the given timezones sorted by their offset from UTC.
 */
export function timezoneList(): TimezoneOption[] {
    const result: TimezoneOption[] = [];
    const timeZones = getTimeZones();

    for (const timezone of timeZones) {
        try {
            const display = dayjs().tz(timezone.name).format("Z");

            result.push({
                name: `(UTC${display}) ${timezone.name}`,
                value: timezone.name,
                time: getTimezoneOffset(timezone.name),
            });
        } catch {
            // Skipping not supported timezone.name by dayjs
        }
    }

    result.sort((a, b) => {
        if (a.time > b.time) {
            return 1;
        }

        if (b.time > a.time) {
            return -1;
        }

        return 0;
    });

    return result;
}

/**
 * Set the locale of the HTML page
 * @returns No return value.
 */
export function setPageLocale(): void {
    const html = document.documentElement;
    html.setAttribute("lang", currentLocale());
    html.setAttribute("dir", localeDirection());
}

/**
 * Get the base URL
 * Mainly used for dev, because the backend and the frontend are in different ports.
 * @returns Base URL
 */
export function getResBaseURL(): string {
    return baseURL;
}

/**
 * Get the tag color options
 * Shared between components
 * @param self Component
 * @returns Colour options
 */
export function colorOptions(self: any): { name: string; color: string }[] {
    return [
        { name: self.$t("Gray"), color: "#4B5563" },
        { name: self.$t("Red"), color: "#DC2626" },
        { name: self.$t("Orange"), color: "#D97706" },
        { name: self.$t("Green"), color: "#059669" },
        { name: self.$t("Blue"), color: "#2563EB" },
        { name: self.$t("Indigo"), color: "#4F46E5" },
        { name: self.$t("Purple"), color: "#7C3AED" },
        { name: self.$t("Pink"), color: "#DB2777" },
    ];
}

/**
 * Loads the toast timeout settings from storage.
 * @returns The toast plugin options object.
 */
export function loadToastSettings(): ToastPluginOptions {
    return {
        position: POSITION.BOTTOM_RIGHT,
        containerClassName: "toast-container mb-5",
        showCloseButtonOnHover: true,

        filterBeforeCreate: (toast, toasts) => {
            if (toast.timeout === 0) {
                return false;
            } else {
                return toast;
            }
        },
    };
}

/**
 * Get timeout for success toasts
 * @returns Timeout in ms. If false timeout disabled.
 */
export function getToastSuccessTimeout(): number | false {
    let successTimeout: number | false = 20000;
    const storedTimeout = (localStorage as any).toastSuccessTimeout;

    if (storedTimeout !== undefined) {
        const parsedTimeout = parseInt(storedTimeout);
        if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
            successTimeout = parsedTimeout;
        }
    }

    if (successTimeout === -1) {
        successTimeout = false;
    }

    return successTimeout;
}

/**
 * Get timeout for error toasts
 * @returns Timeout in ms. If false timeout disabled.
 */
export function getToastErrorTimeout(): number | false {
    let errorTimeout: number | false = -1;
    const storedTimeout = (localStorage as any).toastErrorTimeout;

    if (storedTimeout !== undefined) {
        const parsedTimeout = parseInt(storedTimeout);
        if (parsedTimeout != null && !Number.isNaN(parsedTimeout)) {
            errorTimeout = parsedTimeout;
        }
    }

    if (errorTimeout === -1) {
        errorTimeout = false;
    }

    return errorTimeout;
}

class TimeDurationFormatter {
    private durationFormatOptions: { style: string };
    private relativeTimeFormatOptions: { numeric: string };
    private durationFormatInstance?: { format: (duration: object) => string };
    private relativeTimeFormatInstance?: Intl.RelativeTimeFormat;

    /**
     * Default locale and options for Time Duration Formatter (supports both DurationFormat and RelativeTimeFormat)
     */
    constructor() {
        this.durationFormatOptions = { style: "long" };
        this.relativeTimeFormatOptions = { numeric: "always" };

        const DurationFormat = (Intl as any).DurationFormat;

        if (DurationFormat !== undefined) {
            this.durationFormatInstance = new DurationFormat(currentLocale(), this.durationFormatOptions);
        } else {
            this.relativeTimeFormatInstance = new Intl.RelativeTimeFormat(
                currentLocale(),
                this.relativeTimeFormatOptions
            );
        }
    }

    /**
     * Method to update the instance locale and options
     * @param locale Localization identifier (e.g., "en", "ar-sy") to update the instance with.
     * @returns No return value.
     */
    updateLocale(locale: string): void {
        const DurationFormat = (Intl as any).DurationFormat;

        if (DurationFormat !== undefined) {
            this.durationFormatInstance = new DurationFormat(locale, this.durationFormatOptions);
        } else {
            this.relativeTimeFormatInstance = new Intl.RelativeTimeFormat(locale, this.relativeTimeFormatOptions);
        }
    }

    /**
     * Method to convert seconds into Human readable format
     * @param seconds Receive value in seconds.
     * @returns String converted to Days Mins Seconds Format
     */
    secondsToHumanReadableFormat(seconds: number): string {
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        const minutes = Math.floor(((seconds % 86400) % 3600) / 60);
        const secs = ((seconds % 86400) % 3600) % 60;

        if (this.durationFormatInstance !== undefined) {
            // use Intl.DurationFormat if available
            return this.durationFormatInstance.format({
                days,
                hours,
                minutes,
                seconds: secs,
            });
        }

        const parts: string[] = [];
        /**
         * Build the formatted string from parts
         * 1. Get the relative time formatted parts from the instance.
         * 2. Filter out the relevant parts literal (unit of time) or integer (value).
         * 3. Map out the required values.
         * @param value Receives value in seconds.
         * @param unitOfTime Expected unit of time after conversion.
         * @returns No return value.
         */
        const toFormattedPart = (value: number, unitOfTime: Intl.RelativeTimeFormatUnit) => {
            const partsArray = this.relativeTimeFormatInstance!.formatToParts(value, unitOfTime);
            const filteredParts = partsArray
                .filter((part, index) => part.type === "integer" || (part.type === "literal" && index > 0))
                .map((part) => part.value);

            const formattedString = filteredParts.join("").trim();
            parts.push(formattedString);
        };

        if (days > 0) {
            toFormattedPart(days, "day");
        }
        if (hours > 0) {
            toFormattedPart(hours, "hour");
        }
        if (minutes > 0) {
            toFormattedPart(minutes, "minute");
        }
        if (secs > 0) {
            toFormattedPart(secs, "second");
        }

        if (parts.length > 0) {
            return `${parts.join(" ")}`;
        }
        return this.relativeTimeFormatInstance!.format(0, "second"); // Handle case for 0 seconds
    }
}

export const timeDurationFormatter = new TimeDurationFormatter();
