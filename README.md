# Slack Notifications MCP Server

MCP server that allows Claude to check Xcode Cloud build status and interact with Slack channels.

## Features

- **check_build_status** - Get latest Xcode Cloud build notifications
- **get_channel_messages** - Read recent messages from any channel
- **search_messages** - Search for specific build info (requires `search:read` scope)
- **send_message** - Post messages to Slack
- **list_channels** - List available channels

## Setup

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click "Create New App" → "From scratch"
3. Name it (e.g., "Claude MCP") and select your workspace

### 2. Configure Bot Token Scopes

Go to **OAuth & Permissions** → **Scopes** → **Bot Token Scopes** and add:

- `channels:history` - Read messages in public channels
- `channels:read` - List channels
- `groups:history` - Read messages in private channels (if needed)
- `groups:read` - List private channels (if needed)
- `chat:write` - Send messages
- `search:read` - Search messages (optional)

### 3. Install App to Workspace

1. Go to **Install App** in sidebar
2. Click "Install to Workspace"
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`)

### 4. Get Channel ID

1. Open Slack in browser
2. Go to your build notifications channel
3. The URL will be like: `https://app.slack.com/client/TXXXXX/CXXXXXXX`
4. The `C...` part is your channel ID

### 5. Invite Bot to Channel

In Slack, go to the channel and type:
```
/invite @Claude MCP
```
(or whatever you named your app)

### 6. Configure Claude Code

Add to `~/.mcp.json` (create if it doesn't exist):

```json
{
  "mcpServers": {
    "slack-notifications": {
      "command": "node",
      "args": ["/Users/post/.claude/mcp-servers/slack-notifications/index.js"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-bot-token-here",
        "SLACK_BUILD_CHANNEL_ID": "C01234567890"
      }
    }
  }
}
```

### 7. Restart Claude Code

```bash
# Exit and restart Claude Code for MCP changes to take effect
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `SLACK_BOT_TOKEN` | Yes | Bot User OAuth Token from OAuth & Permissions (starts with `xoxb-`) |
| `SLACK_BUILD_CHANNEL_ID` | Yes | Channel ID for build notifications (starts with `C`) |

Both variables must be set — the server will fail to start if either is missing.

## Usage

Once configured, Claude can use these tools:

```
# Check latest builds
mcp__slack-notifications__check_build_status()

# Get channel messages
mcp__slack-notifications__get_channel_messages(channel_id: "C...", limit: 10)

# Search for failed builds
mcp__slack-notifications__search_messages(query: "build failed")

# Send a message
mcp__slack-notifications__send_message(text: "Build complete!")
```

## Xcode Cloud Setup

To send build notifications to Slack:

1. Go to **App Store Connect** → **Xcode Cloud**
2. Select your workflow → **Post-Actions**
3. Add **Slack** notification
4. Configure to post to your build channel

## Troubleshooting

### "missing_scope" error
Add the required scope in your Slack App settings under OAuth & Permissions.

### "channel_not_found" error
Make sure the bot is invited to the channel (`/invite @BotName`).

### No messages returned
Check that SLACK_BUILD_CHANNEL_ID is correct and the bot has access.
