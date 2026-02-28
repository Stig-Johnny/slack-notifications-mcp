# Slack Notifications MCP Server

MCP server that allows Claude to check Xcode Cloud build status and interact with Slack channels.

## Features

- **check_build_status** - Get latest Xcode Cloud build notifications
- **get_channel_messages** - Read recent messages from any channel
- **search_messages** - Search for specific build info (requires `search:read` scope)
- **send_message** - Post messages to Slack
- **list_channels** - List available channels

## Quick Start

1. Create a Slack App at https://api.slack.com/apps
2. Add bot scopes: `channels:history`, `channels:read`, `chat:write`
3. Install the app to your workspace and copy the `xoxb-` token
4. Invite the bot to your channel with `/invite @YourAppName`
5. Get the channel ID from the Slack URL (`C...` part)
6. Add the config below to `~/.mcp.json` and restart Claude Code

```json
{
  "mcpServers": {
    "slack-notifications": {
      "type": "stdio",
      "command": "node",
      "args": ["/Users/yourname/.claude/mcp-servers/slack-notifications/index.js"],
      "env": {
        "SLACK_BOT_TOKEN": "xoxb-your-token-here",
        "SLACK_BUILD_CHANNEL_ID": "C01234567890"
      }
    }
  }
}
```

**Test it works:**
```bash
node ~/.claude/mcp-servers/slack-notifications/index.js
```
No errors = ready to go.

---

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
