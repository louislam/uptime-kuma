import { z } from "zod";

/**
 * Config keys a client may write; anything else is dropped.
 */
export const monitorConfigSchema = z.object({
    systemServiceName: z.string().max(255).optional(),
    globalpingConfirm: z.boolean().optional(),
    globalpingConfirmLocation: z.string().max(255).optional(),
    globalpingConfirmProbes: z.number().int().min(1).max(5).optional(),
    globalpingConfirmMinInterval: z.number().int().min(0).max(86400).optional(),
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
