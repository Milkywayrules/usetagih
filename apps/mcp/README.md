# @usetagih/mcp

MCP server is **v1.1 POST-MVP** — not built at MVP.

## Planned implementation

The v1.1 MCP server will use `@modelcontextprotocol/sdk` and `@usetagih/sdk`, calling **public REST only** (AD-2, SOLUTION-DESIGN §14). It must have **zero imports** from `packages/core` or `packages/render`.

## Tool surface

At most **5 tools**, each mapping 1:1 to a public REST endpoint.
