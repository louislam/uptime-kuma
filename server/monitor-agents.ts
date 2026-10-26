import http from "node:http";
import https from "node:https";
import { R } from "redbean-node";
// @ts-ignore - tough-cookie does not ship type definitions
import { CookieJar } from "tough-cookie";
import { HttpsCookieAgent } from "http-cookie-agent/http";
import { Proxy } from "./proxy";

export interface MonitorAgentOptions {
    httpAgentOptions: http.AgentOptions;
    httpsAgentOptions: http.AgentOptions;
}

export interface MonitorAgents {
    httpAgent: http.Agent;
    httpsAgent: https.Agent;
    /** True when the agents come from a proxy instead of a direct connection */
    proxied: boolean;
    /** Listener installed on the https agent for the current beat */
    keylogHandler?: (line: Buffer, tlsSocket: KeylogSocket) => void;
}

/** Minimal TLS socket shape used by the keylog listener */
export interface KeylogSocket {
    once(event: "secureConnect", listener: () => void): unknown;
}

/** Monitor instance to its keep-alive agents. A WeakMap avoids redbean's magic property setters */
const agentCache = new WeakMap<object, MonitorAgents>();

/**
 * Get the keep-alive agents of a monitor, creating them on first use.
 * Creating a new agent and socket for every check exhausts local ports and
 * buffers with thousands of monitors, so each monitor keeps its own pair.
 * @param monitor Monitor instance
 * @param options Agent options built by the monitor beat
 * @returns Cached agents for this monitor instance
 */
export async function getMonitorAgents(
    monitor: { proxy_id?: number | null },
    options: MonitorAgentOptions
): Promise<MonitorAgents> {
    const cached = agentCache.get(monitor);
    if (cached) {
        return cached;
    }

    // An edit restarts the monitor with a new instance, so the cache never goes stale
    const agents = await createMonitorAgents(monitor, options);
    agentCache.set(monitor, agents);
    return agents;
}

/**
 * Drop the cached agents of a monitor
 * @param monitor Monitor instance
 * @returns void
 */
export function clearMonitorAgents(monitor: object): void {
    agentCache.delete(monitor);
}

/**
 * Create the agents for one monitor beat
 * @param monitor Monitor instance
 * @param options Agent options built by the monitor beat
 * @returns New agents, using the proxy when one is configured and active
 */
async function createMonitorAgents(
    monitor: { proxy_id?: number | null },
    { httpAgentOptions, httpsAgentOptions }: MonitorAgentOptions
): Promise<MonitorAgents> {
    let httpAgent: http.Agent | null = null;
    let httpsAgent: https.Agent | null = null;
    let proxied = false;

    if (monitor.proxy_id) {
        const proxy = await R.load("proxy", monitor.proxy_id);

        if (proxy && proxy.active) {
            ({ httpAgent, httpsAgent } = Proxy.createAgents(proxy, {
                httpsAgentOptions,
                httpAgentOptions,
            }));
            proxied = true;
        }
    }

    if (!httpAgent) {
        httpAgent = new http.Agent({ ...httpAgentOptions, keepAlive: true });
    }

    if (!httpsAgent) {
        httpsAgent = new HttpsCookieAgent({
            ...httpsAgentOptions,
            keepAlive: true,
            cookies: { jar: new CookieJar() },
        });
    }

    return { httpAgent, httpsAgent, proxied };
}

/**
 * Install the keylog listener for one beat. Agents are reused between beats, and
 * plain http monitors never emit "keylog", so the previous listener is removed
 * instead of piling one up per beat.
 * @param agents Cached agents of the monitor
 * @param httpsAgent HTTPS agent of this beat
 * @param onSecureConnect Called with the TLS socket once the handshake finishes
 * @returns The installed handler
 */
export function attachKeylogListener(
    agents: MonitorAgents,
    httpsAgent: http.Agent,
    onSecureConnect: (tlsSocket: KeylogSocket) => void
): (line: Buffer, tlsSocket: KeylogSocket) => void {
    if (agents.keylogHandler) {
        httpsAgent.removeListener("keylog", agents.keylogHandler);
    }

    agents.keylogHandler = (line, tlsSocket) => {
        tlsSocket.once("secureConnect", () => onSecureConnect(tlsSocket));
    };
    httpsAgent.once("keylog", agents.keylogHandler);

    return agents.keylogHandler;
}
