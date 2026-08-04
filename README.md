# mcp-linear

Linear MCP — wraps the Linear GraphQL API (OAuth)

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `linear_list_issues` | Browse issues in your Linear workspace with optional filters by state, priority, or assignee. Returns issue ID, title, state, priority, assignee, and URL. |
| `linear_get_issue` | Get full details of a Linear issue by ID (e.g., "ABC-123"). Returns title, description, state, priority, assignee, labels, comments, and URL. |
| `linear_create_issue` | Create a new issue in Linear with title and optional description. Returns issue ID, key, title, and URL. |
| `linear_list_teams` | List all teams in your Linear workspace. Returns team ID, name, key, and description. |
| `linear_search` | Search Linear issues by keyword or text. Returns matching issues with ID, title, state, priority, and URL. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "linear": {
      "url": "https://gateway.pipeworx.io/linear/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Linear data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
