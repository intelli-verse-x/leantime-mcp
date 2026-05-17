// Thin Leantime JSON-RPC client.
//
// Why this exists: Leantime ships an official MCP plugin behind a paywall.
// Until that's procured, this wrapper talks to Leantime's open JSON-RPC
// surface (`POST /api/jsonrpc`) which is part of the OSS distribution.
//
// Auth: Bearer token minted via `AccessTokenRepository::createToken` (see
// the repo README for the mint script).

export interface LeantimeConfig {
  baseUrl: string;
  bearerToken: string;
  fetchImpl?: typeof fetch;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export class LeantimeError extends Error {
  constructor(public readonly rpc: JsonRpcError, public readonly method: string) {
    super(`leantime ${method}: ${rpc.code} ${rpc.message}`);
    this.name = "LeantimeError";
  }
}

export class LeantimeClient {
  private readonly baseUrl: string;
  private readonly bearer: string;
  private readonly fetchImpl: typeof fetch;
  private nextId = 1;

  constructor(cfg: LeantimeConfig) {
    this.baseUrl = cfg.baseUrl.replace(/\/$/, "");
    this.bearer = cfg.bearerToken;
    this.fetchImpl = cfg.fetchImpl ?? fetch;
  }

  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const id = this.nextId++;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      method: `leantime.rpc.${method}`,
      id,
      params,
    });

    const resp = await this.fetchImpl(`${this.baseUrl}/api/jsonrpc`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.bearer}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body,
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new LeantimeError(
        { code: resp.status, message: `HTTP ${resp.status}`, data: text.slice(0, 400) },
        method,
      );
    }

    const json = (await resp.json()) as { result?: T; error?: JsonRpcError };
    if (json.error) throw new LeantimeError(json.error, method);
    return json.result as T;
  }

  // --- typed convenience methods --------------------------------------------

  projectsGetAll(params: Record<string, unknown> = {}) {
    return this.call<LeantimeProject[]>("projects.getAll", params);
  }

  ticketsGetAll(params: Record<string, unknown> = {}) {
    return this.call<LeantimeTicket[]>("tickets.getAll", params);
  }

  ticketsGet(id: number) {
    return this.call<LeantimeTicket>("tickets.get", { id });
  }

  ticketsAdd(t: {
    headline: string;
    description?: string;
    projectId: number;
    type?: string;
    priority?: number;
    editorId?: number;
    milestoneid?: number;
    storypoints?: number;
    status?: number;
  }) {
    return this.call<{ id: number }>("tickets.addTicket", t);
  }

  ticketsPatch(id: number, fields: Record<string, unknown>) {
    return this.call<{ status: boolean }>("tickets.patch", { id, params: fields });
  }

  usersGetAll(params: Record<string, unknown> = {}) {
    return this.call<LeantimeUser[]>("users.getAll", params);
  }

  // discover what methods exist on this Leantime install
  async discover(): Promise<string[]> {
    const ok: string[] = [];
    for (const m of CANDIDATE_METHODS) {
      try {
        await this.call(m, {});
        ok.push(m);
      } catch {
        // ignore — many will not exist on every install
      }
    }
    return ok;
  }
}

const CANDIDATE_METHODS = [
  "projects.getAll",
  "tickets.getAll",
  "users.getAll",
  "comments.getAll",
  "timesheets.getAll",
] as const;

export interface LeantimeProject {
  id: number;
  name: string;
  description?: string;
  state?: string | number;
  clientId?: number | null;
}

export interface LeantimeTicket {
  id: number;
  projectId: number;
  headline: string;
  description?: string;
  status?: number | string;
  priority?: number | string;
  storypoints?: number | string;
  type?: string;
  editorId?: number;
  milestoneid?: number;
  dateToFinish?: string | null;
}

export interface LeantimeUser {
  id: number;
  username: string;
  firstname?: string;
  lastname?: string;
  role?: string | number;
  status?: string;
}
