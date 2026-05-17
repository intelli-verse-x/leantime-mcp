#!/usr/bin/env node
// MCP server for Leantime.
//
// Talks MCP over stdio (for local agent integration) AND optionally over
// a streamable HTTP transport on $PORT (for k8s / shared deploys behind
// an ingress). When LEANTIME_MCP_STDIO=1 the HTTP transport is skipped.
//
// Exposed tools (capability surface):
//   list_projects   ─ read     list Leantime projects
//   list_tickets    ─ read     list tickets (optionally filtered by project)
//   get_ticket      ─ read     fetch a single ticket by id
//   create_ticket   ─ write    create a new ticket
//   update_ticket   ─ write    patch fields on an existing ticket
//   list_users      ─ read     list known users (for assignment)
//   discover        ─ read     enumerate methods this Leantime install accepts
//
// Auth is a single Leantime Bearer token at boot. The MCP server itself does
// not authenticate clients — keep it inside the cluster behind the ALB / a
// VPN. For per-agent identity, mint per-bot Leantime users and run a separate
// instance per identity (one per Deployment replica or per role).

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { LeantimeClient, LeantimeError } from "./leantime.js";

const baseUrl = process.env.LEANTIME_BASE_URL ?? "https://leantime.intelli-verse-x.ai";
const bearer = process.env.LEANTIME_BEARER_TOKEN;
if (!bearer) {
  console.error("FATAL: LEANTIME_BEARER_TOKEN is required");
  process.exit(2);
}

const lt = new LeantimeClient({ baseUrl, bearerToken: bearer });

const server = new Server(
  { name: "leantime-mcp", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const TOOLS = [
  {
    name: "list_projects",
    description: "List Leantime projects (id, name, state).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "list_tickets",
    description:
      "List Leantime tickets. Optional `projectId` filters to one project; default returns all tickets visible to the bot user.",
    inputSchema: {
      type: "object",
      properties: { projectId: { type: "number" } },
      additionalProperties: false,
    },
  },
  {
    name: "get_ticket",
    description: "Fetch a single Leantime ticket by id.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "number" } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "create_ticket",
    description: "Create a new Leantime ticket. Required: `headline`, `projectId`.",
    inputSchema: {
      type: "object",
      properties: {
        headline: { type: "string" },
        description: { type: "string" },
        projectId: { type: "number" },
        type: { type: "string", description: "task|bug|story (Leantime taxonomy)" },
        priority: { type: "number" },
        editorId: { type: "number", description: "assignee user id" },
        milestoneid: { type: "number" },
        storypoints: { type: "number" },
        status: { type: "number" },
      },
      required: ["headline", "projectId"],
      additionalProperties: false,
    },
  },
  {
    name: "update_ticket",
    description: "Patch fields on an existing Leantime ticket.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number" },
        headline: { type: "string" },
        description: { type: "string" },
        status: { type: "number" },
        priority: { type: "number" },
        editorId: { type: "number" },
        milestoneid: { type: "number" },
        storypoints: { type: "number" },
      },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "list_users",
    description: "List Leantime users (id, username, role).",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "discover",
    description:
      "Enumerate which JSON-RPC methods this Leantime install supports. Useful for debugging.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
] as const;

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

const Args = {
  list_projects: z.object({}).strict(),
  list_tickets: z.object({ projectId: z.number().optional() }).strict(),
  get_ticket: z.object({ id: z.number() }).strict(),
  create_ticket: z
    .object({
      headline: z.string().min(1),
      description: z.string().optional(),
      projectId: z.number(),
      type: z.string().optional(),
      priority: z.number().optional(),
      editorId: z.number().optional(),
      milestoneid: z.number().optional(),
      storypoints: z.number().optional(),
      status: z.number().optional(),
    })
    .strict(),
  update_ticket: z
    .object({
      id: z.number(),
      headline: z.string().optional(),
      description: z.string().optional(),
      status: z.number().optional(),
      priority: z.number().optional(),
      editorId: z.number().optional(),
      milestoneid: z.number().optional(),
      storypoints: z.number().optional(),
    })
    .strict(),
  list_users: z.object({}).strict(),
  discover: z.object({}).strict(),
} as const;

// Shared dispatch — called from both the MCP stdio handler and the HTTP
// JSON-RPC handler. Keeps tool semantics identical across transports.
async function dispatchTool(name: string, rawArgs: unknown) {
  const schema = (Args as Record<string, z.ZodTypeAny>)[name];
  if (!schema) {
    return { isError: true, content: [{ type: "text", text: `unknown tool: ${name}` }] };
  }
  try {
    const args = schema.parse(rawArgs ?? {});
    let result: unknown;
    switch (name as keyof typeof Args) {
      case "list_projects":
        result = await lt.projectsGetAll();
        break;
      case "list_tickets": {
        const a = args as z.infer<typeof Args.list_tickets>;
        result = await lt.ticketsGetAll(
          a.projectId ? { searchCriteria: { currentProject: a.projectId } } : {},
        );
        break;
      }
      case "get_ticket": {
        const a = args as z.infer<typeof Args.get_ticket>;
        result = await lt.ticketsGet(a.id);
        break;
      }
      case "create_ticket": {
        const a = args as z.infer<typeof Args.create_ticket>;
        result = await lt.ticketsAdd(a);
        break;
      }
      case "update_ticket": {
        const a = args as z.infer<typeof Args.update_ticket>;
        const { id, ...patch } = a;
        result = await lt.ticketsPatch(id, patch);
        break;
      }
      case "list_users":
        result = await lt.usersGetAll();
        break;
      case "discover":
        result = await lt.discover();
        break;
    }
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  } catch (err) {
    const msg =
      err instanceof LeantimeError
        ? `leantime error: ${err.rpc.code} ${err.rpc.message}${err.rpc.data ? ` data=${JSON.stringify(err.rpc.data).slice(0, 300)}` : ""}`
        : err instanceof Error
          ? err.message
          : String(err);
    return { isError: true, content: [{ type: "text", text: msg }] };
  }
}

server.setRequestHandler(CallToolRequestSchema, async (req) =>
  dispatchTool(req.params.name, req.params.arguments),
);

// --- transports --------------------------------------------------------------

const stdioOnly = process.env.LEANTIME_MCP_STDIO === "1";
const port = Number(process.env.PORT ?? 3030);

if (stdioOnly) {
  await server.connect(new StdioServerTransport());
  console.error("leantime-mcp ready (stdio)");
} else {
  // Stateless HTTP RPC endpoint. We do NOT use the streamable MCP transport
  // for the in-cluster deploy — it requires session state, SSE upgrades, and
  // the SDK's HTTP server isn't a drop-in for non-MCP clients (n8n, agents
  // that just want to call tools over HTTP).
  //
  // Endpoints:
  //   GET  /healthz        ─ liveness
  //   POST /tools/list     ─ returns the same shape as MCP tools/list
  //   POST /tools/call     ─ {name, arguments} → tool result
  //   POST /rpc            ─ JSON-RPC 2.0; method = "tools/list" or "tools/call"
  //
  // For MCP stdio clients use the npm package directly (see README).
  const { createServer } = await import("node:http");

  const handleListTools = () => ({ tools: TOOLS });
  const handleCallTool = (params: { name?: string; arguments?: unknown }) =>
    dispatchTool(params.name ?? "", params.arguments);

  const readBody = (req: import("node:http").IncomingMessage): Promise<string> =>
    new Promise((resolve, reject) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => resolve(body));
      req.on("error", reject);
    });

  const writeJson = (res: import("node:http").ServerResponse, status: number, payload: unknown) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(payload));
  };

  const httpServer = createServer(async (req, res) => {
    try {
      if (req.url === "/healthz") {
        return writeJson(res, 200, { ok: true, server: "leantime-mcp", version: "0.1.0" });
      }
      if (req.url === "/" && req.method === "GET") {
        res.writeHead(200, { "content-type": "text/plain" });
        return res.end(
          "leantime-mcp\n" +
            "  POST /tools/list           list tool capabilities\n" +
            "  POST /tools/call           {name, arguments} → result\n" +
            "  POST /rpc                  JSON-RPC 2.0 (method=tools/list|tools/call)\n" +
            "  GET  /healthz              liveness\n",
        );
      }
      if (req.method === "POST" && req.url === "/tools/list") {
        return writeJson(res, 200, handleListTools());
      }
      if (req.method === "POST" && req.url === "/tools/call") {
        const body = await readBody(req);
        const args = body ? JSON.parse(body) : {};
        const out = await handleCallTool(args);
        return writeJson(res, 200, out);
      }
      if (req.method === "POST" && req.url === "/rpc") {
        const body = await readBody(req);
        let env: any;
        try { env = JSON.parse(body || "{}"); } catch {
          return writeJson(res, 400, { jsonrpc: "2.0", error: { code: -32700, message: "parse error" }, id: null });
        }
        const id = env.id ?? null;
        try {
          if (env.method === "tools/list") return writeJson(res, 200, { jsonrpc: "2.0", id, result: handleListTools() });
          if (env.method === "tools/call") {
            const result = await handleCallTool(env.params ?? {});
            return writeJson(res, 200, { jsonrpc: "2.0", id, result });
          }
          return writeJson(res, 200, { jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${env.method}` } });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return writeJson(res, 200, { jsonrpc: "2.0", id, error: { code: -32000, message: msg } });
        }
      }
      res.writeHead(404).end("not found");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      writeJson(res, 500, { error: msg });
    }
  });

  httpServer.listen(port, "0.0.0.0", () => {
    console.error(`leantime-mcp listening on :${port} (HTTP /rpc + /tools/{list,call})`);
  });
}
