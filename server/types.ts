import { z } from "zod";

/**
 * Config keys a client may write; anything else is dropped.
 */
export const monitorConfigSchema = z.object({
    systemServiceName: z.string().max(255).optional(),
});

export type MonitorConfig = z.infer<typeof monitorConfigSchema>;

/**
 * Monitor object as sent to and from the client; other columns pass through untouched.
 */
export interface MonitorObject {
    id?: number;
    name: string;
    type: string;
    active?: boolean;
    interval?: number;
    parent?: number | null;
    url?: string | null;
    hostname?: string | null;
    config: MonitorConfig;
    [key: string]: unknown;
}
