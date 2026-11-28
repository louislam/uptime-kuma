/**
 * Helpers for storing dashboard monitor filters in the Vue Router query.
 *
 * URL shape (bookmarkable):
 *   /dashboard?status=0
 *   /dashboard?status=0&status=1&active=true&tags=3&tags=5
 *
 * Status values: 0=down, 1=up, 2=pending, 3=maintenance
 * Active values: true | false
 * Tags: tag ids
 */

export type DashboardFilterState = {
    status: number[] | null;
    active: boolean[] | null;
    tags: number[] | null;
};

const VALID_STATUS = new Set([0, 1, 2, 3]);

/**
 * Normalize a vue-router query value (string | string[] | undefined) into a string array.
 * @param raw Query value
 * @returns Array of string values (empty if absent)
 */
export function queryValueToArray(raw: unknown): string[] {
    if (raw == null || raw === "") {
        return [];
    }
    return [].concat(raw as string | string[]).map(String);
}

/**
 * Parse dashboard filter state from a route query object.
 * @param query Vue Router query (`this.$route.query`)
 * @returns Typed filter state used by MonitorList
 */
export function parseDashboardFilterQuery(query: Record<string, unknown>): DashboardFilterState {
    const status = queryValueToArray(query.status)
        .map((v) => Number(v))
        .filter((n) => VALID_STATUS.has(n));

    const active = queryValueToArray(query.active)
        .map((v) => {
            if (v === "true") {
                return true;
            }
            if (v === "false") {
                return false;
            }
            return null;
        })
        .filter((v): v is boolean => v !== null);

    const tags = queryValueToArray(query.tags)
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n > 0);

    return {
        status: status.length > 0 ? status : null,
        active: active.length > 0 ? active : null,
        tags: tags.length > 0 ? tags : null,
    };
}

/**
 * Merge filter state into an existing route query.
 * Omits empty filter keys so a clean URL has no filter params.
 * Preserves unrelated query keys.
 * @param existingQuery Current `$route.query`
 * @param filter Filter state to write
 * @returns New query object for `router.replace({ query })`
 */
export function buildDashboardFilterQuery(
    existingQuery: Record<string, unknown>,
    filter: DashboardFilterState
): Record<string, unknown> {
    const query: Record<string, unknown> = { ...existingQuery };

    delete query.status;
    delete query.active;
    delete query.tags;

    if (filter.status?.length) {
        query.status = filter.status.map(String);
    }
    if (filter.active?.length) {
        query.active = filter.active.map(String);
    }
    if (filter.tags?.length) {
        query.tags = filter.tags.map(String);
    }

    return query;
}
