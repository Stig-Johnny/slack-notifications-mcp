# Copilot Code Review Instructions - slack-notifications-mcp

## Project Overview

MCP server for Slack integration - checks Xcode Cloud build status and sends notifications to Slack channels. Used by Claude Code for CI/CD monitoring.

## Architecture

- **Pattern:** MCP SDK handler pattern (stdio transport)
- **Runtime:** Node.js (ES modules)
- **Dependencies:** `@modelcontextprotocol/sdk`, `@slack/web-api`
- **Entry point:** `index.js` (single-file server)

## Security Focus

- `SLACK_BOT_TOKEN` must never be hardcoded - always from environment
- `SLACK_BUILD_CHANNEL_ID` must never be hardcoded - always from environment
- Validate channel IDs before API calls
- Never log full message content (may contain sensitive build info)
- Bot token scope should be minimal (channels:read, chat:write, search:read)

## Code Patterns

### MCP Handlers
- Use `ListToolsRequestSchema` for tool registration
- Use `CallToolRequestSchema` for tool execution
- Return `{ content: [{ type: "text", text: ... }] }` format
- Handle errors with `isError: true` in response

### Slack API
- Use `@slack/web-api` WebClient for all API calls
- Handle rate limiting (429 responses) gracefully
- Pagination: use `cursor` for `conversations.list`, `messages` endpoints

## Common Pitfalls

- Slack timestamps are strings with 6 decimal places (e.g., "1234567890.123456")
- Channel IDs start with "C", user IDs with "U", bot IDs with "B"
- `conversations.history` returns newest first by default
- Search API requires different scopes than messaging
