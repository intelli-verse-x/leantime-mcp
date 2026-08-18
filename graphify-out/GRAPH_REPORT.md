# Graph Report - src  (2026-08-18)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 84 nodes · 95 edges · 9 communities (8 shown, 1 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b249cfe0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 12 edges
2. `LeantimeClient` - 11 edges
3. `dispatchTool()` - 8 edges
4. `leantime-mcp` - 7 edges
5. `scripts` - 5 edges
6. `LeantimeError` - 3 edges
7. `Code memory (Graphify) — use this before grepping` - 3 edges
8. `bin` - 2 edges
9. `@modelcontextprotocol/sdk` - 2 edges
10. `zod` - 2 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (9 total, 1 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.13
Nodes (12): CANDIDATE_METHODS, JsonRpcError, LeantimeConfig, LeantimeError, LeantimeProject, LeantimeTicket, LeantimeUser, Args (+4 more)

### Community 1 - "Community 1"
Cohesion: 0.13
Nodes (14): src/**/*, compilerOptions, declaration, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.18
Nodes (10): bin, leantime-mcp, description, engines, node, license, main, name (+2 more)

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (8): Configuration, leantime-mcp, Minting a Bearer token (Leantime ≥ 11), Running in Kubernetes, Running locally, Tools exposed, Why not just wait for the paid plugin?, Why this exists

### Community 5 - "Community 5"
Cohesion: 0.29
Nodes (7): devDependencies, tsx, @types/node, typescript, tsx, @types/node, typescript

### Community 6 - "Community 6"
Cohesion: 0.40
Nodes (4): Agent instructions, Code memory (Graphify) — use this before grepping, Ops, Without MCP (primary for this tier)

### Community 7 - "Community 7"
Cohesion: 0.40
Nodes (5): @modelcontextprotocol/sdk, dependencies, @modelcontextprotocol/sdk, zod, zod

### Community 8 - "Community 8"
Cohesion: 0.40
Nodes (5): scripts, build, dev, start, test

## Knowledge Gaps
- **48 isolated node(s):** `name`, `version`, `description`, `type`, `license` (+43 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `Community 5` to `Community 2`?**
  _High betweenness centrality (0.041) - this node is a cross-community bridge._
- **Why does `LeantimeClient` connect `Community 3` to `Community 0`?**
  _High betweenness centrality (0.038) - this node is a cross-community bridge._
- **Why does `scripts` connect `Community 8` to `Community 2`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Are the 7 inferred relationships involving `dispatchTool()` (e.g. with `.discover()` and `.projectsGetAll()`) actually correct?**
  _`dispatchTool()` has 7 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `description` to the rest of the system?**
  _48 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._