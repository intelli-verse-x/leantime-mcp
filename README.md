# leantime-mcp

MCP server that bridges [Leantime](https://leantime.io) to Claude / Cursor /
Gas Town agents over either **stdio** or **streamable HTTP**.

## Why this exists

Leantime ships an [official MCP plugin](https://store.leantime.io/products/mcp-server-plugin)
behind a paywall. This server is an OSS alternative built on top of the
Leantime JSON-RPC API (`POST /api/jsonrpc`) which is part of every Leantime
install.

## Tools exposed

| Tool | What it does |
|---|---|
| `list_projects` | List Leantime projects (id, name, state). |
| `list_tickets` | List tickets, optionally filtered by `projectId`. |
| `get_ticket` | Fetch a single ticket by id. |
| `create_ticket` | Create a new ticket (`headline`, `projectId` required). |
| `update_ticket` | Patch fields on an existing ticket. |
| `list_users` | List users (for `editorId` assignment). |
| `discover` | Enumerate which JSON-RPC methods the install supports. |

More tools (milestones, comments, timesheets) will be added once we settle
on the right method names against the live Leantime install. Use `discover`
to see what your install accepts and PR new bindings.

## Configuration

| env | required | default |
|---|---|---|
| `LEANTIME_BASE_URL` | yes | `https://leantime.intelli-verse-x.ai` |
| `LEANTIME_BEARER_TOKEN` | yes | — |
| `PORT` | no | `3030` |
| `LEANTIME_MCP_STDIO` | no | unset (HTTP); set `=1` for stdio-only |

### Minting a Bearer token (Leantime ≥ 11)

Leantime uses Laravel Sanctum-style tokens stored in `zp_access_tokens`,
but with a custom repository (`Leantime\Domain\Auth\Repositories\AccessTokenRepository`).
Mint via PHP in the leantime pod:

```php
<?php
chdir("/var/www/html");
require "/var/www/html/vendor/autoload.php";
$app = require "/var/www/html/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$repo = $app->make(Leantime\Domain\Auth\Repositories\AccessTokenRepository::class);
$out  = $repo->createToken(/*userId*/ 15, "mcp-server", ["*"]);
echo "BEARER " . $out["token"] . PHP_EOL;
```

Send the plaintext as `Authorization: Bearer <token>` on every request.

## Running locally

```bash
LEANTIME_BASE_URL=https://leantime.intelli-verse-x.ai \
LEANTIME_BEARER_TOKEN=<token> \
LEANTIME_MCP_STDIO=1 \
npx -y @intelli-verse-x/leantime-mcp
```

Then in your `~/.mcp.json` (or per-workspace):

```json
{
  "mcpServers": {
    "leantime": {
      "command": "npx",
      "args": ["-y", "@intelli-verse-x/leantime-mcp"],
      "env": {
        "LEANTIME_BASE_URL": "https://leantime.intelli-verse-x.ai",
        "LEANTIME_BEARER_TOKEN": "your-token-here",
        "LEANTIME_MCP_STDIO": "1"
      }
    }
  }
}
```

## Running in Kubernetes

A streamable HTTP transport is exposed on `POST /mcp`. Health probe on `GET
/healthz`. See `intelli-verse-kube-infra/leantime-mcp/` for the live
manifests (Deployment + Service + ALB Ingress). Endpoint after deploy:

```
https://leantime-mcp.intelli-verse-x.ai/mcp
```

Authenticate by trusting the cluster boundary (NetworkPolicy + Ingress
filtering by source IP) or by putting an auth-proxy in front. The MCP
server itself doesn't authenticate clients.

## Why not just wait for the paid plugin?

You should still buy the paid plugin if you need:

- per-user OAuth (Advanced Auth Bundle) — every agent acts as a specific
  human, not a shared service account.
- whatever new methods Leantime adds to the plugin that aren't in the
  public JSON-RPC.

This OSS server unblocks day-1 agent work and is good enough for read +
basic write. Use both side-by-side when you have the license.
