import express from "express";
import type { Request, Response } from "express";
import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { requireApiKey } from "../auth";
import * as checkVersion from "../check-version";
import { log } from "../../src/util";
// Load the API routes first, the tools are built from the operations they register
import apiRouter from "./api-router";

/**
 * A documented route that answers with data, bridged to one MCP tool
 */
interface ApiOperation {
    operationId: string;
    summary?: string;
    description?: string;
    resolve: (request: unknown) => Promise<Record<string, unknown>>;
}

/**
 * Wrap a payload as the single JSON text block of a tool result
 * @param payload Data returned by the tool
 * @returns MCP tool result
 */
function jsonResult(payload: Record<string, unknown>) {
    return {
        content: [
            {
                type: "text" as const,
                text: JSON.stringify(payload, null, 2),
            },
        ],
    };
}

/**
 * Build a fresh MCP server, the handler calls it once per request so no state is shared
 * @returns MCP server with one tool per parameterless GET route
 */
function createServer() {
    const mcpServer = new McpServer({
        name: "uptime-kuma",
        version: checkVersion.version,
    });

    const operations: ApiOperation[] = apiRouter.apiOperations;

    for (const { method, path, operation } of operations) {
        // A route with a path parameter needs an input schema, so it is not bridged yet
        if (method !== "get" || path.includes(":")) {
            continue;
        }

        mcpServer.registerTool(
            operation.operationId,
            {
                description: operation.description || operation.summary,
            },
            async () => jsonResult(await operation.resolve({ params: {}, query: {} }))
        );
    }

    return mcpServer;
}

const handler = createMcpHandler(createServer);
const nodeHandler = toNodeHandler(handler, {
    onerror: (error) => log.error("mcp", "MCP handler failed: " + error.message),
});

const router = express.Router();

router.all("/mcp", requireApiKey, async (request: Request, response: Response) => {
    try {
        // express.json() already parsed the body, hand it over to avoid re-reading the stream
        await nodeHandler(request, response, request.body);
    } catch (e) {
        log.error("mcp", "Failed to handle the MCP request: " + (e as Error).message);
        if (!response.headersSent) {
            response.status(500).json({
                ok: false,
                msg: "Failed to handle the MCP request",
            });
        }
    }
});

export default router;
