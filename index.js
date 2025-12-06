#!/usr/bin/env node

/**
 * Slack Notifications MCP Server
 *
 * Allows Claude to check Xcode Cloud build status via Slack channel messages.
 *
 * Required environment variables:
 * - SLACK_BOT_TOKEN: Slack Bot User OAuth Token (xoxb-...)
 * - SLACK_BUILD_CHANNEL_ID: Channel ID for build notifications (C...)
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { WebClient } from "@slack/web-api";

// Initialize Slack client
const slackToken = process.env.SLACK_BOT_TOKEN;
const buildChannelId = process.env.SLACK_BUILD_CHANNEL_ID;

if (!slackToken) {
  console.error("SLACK_BOT_TOKEN environment variable is required");
  process.exit(1);
}

const slack = new WebClient(slackToken);

// Create MCP server
const server = new Server(
  {
    name: "slack-notifications",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "check_build_status",
        description: "Get the latest Xcode Cloud build status from Slack notifications. Returns recent build messages including status, workflow name, duration, and timestamp.",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Number of recent build messages to retrieve (default: 5, max: 20)",
              default: 5,
            },
            workflow: {
              type: "string",
              description: "Filter by workflow name (e.g., 'Cuti-E-Admin', 'Nutri-E'). Case-insensitive partial match.",
            },
          },
          required: [],
        },
      },
      {
        name: "get_channel_messages",
        description: "Read recent messages from a specific Slack channel",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Slack channel ID (e.g., C01234567). If not provided, uses the build channel.",
            },
            limit: {
              type: "number",
              description: "Number of messages to retrieve (default: 10, max: 100)",
              default: 10,
            },
          },
          required: [],
        },
      },
      {
        name: "search_messages",
        description: "Search for messages in Slack containing specific text",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query (e.g., 'build failed', 'Cuti-E-Admin')",
            },
            limit: {
              type: "number",
              description: "Maximum number of results (default: 10)",
              default: 10,
            },
          },
          required: ["query"],
        },
      },
      {
        name: "send_message",
        description: "Send a message to a Slack channel",
        inputSchema: {
          type: "object",
          properties: {
            channel_id: {
              type: "string",
              description: "Slack channel ID. If not provided, uses the build channel.",
            },
            text: {
              type: "string",
              description: "Message text to send",
            },
          },
          required: ["text"],
        },
      },
      {
        name: "list_channels",
        description: "List available Slack channels the bot has access to",
        inputSchema: {
          type: "object",
          properties: {
            limit: {
              type: "number",
              description: "Maximum number of channels to list (default: 50)",
              default: 50,
            },
          },
          required: [],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "check_build_status": {
        if (!buildChannelId) {
          return {
            content: [
              {
                type: "text",
                text: "Error: SLACK_BUILD_CHANNEL_ID not configured. Please set it in your MCP config.",
              },
            ],
          };
        }

        const workflowFilter = args?.workflow?.toLowerCase();
        // Fetch more messages if filtering, to ensure we get enough matches
        const fetchLimit = workflowFilter ? Math.min((args?.limit || 5) * 4, 100) : Math.min(args?.limit || 5, 20);
        const result = await slack.conversations.history({
          channel: buildChannelId,
          limit: fetchLimit,
        });

        if (!result.messages || result.messages.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No build messages found in the channel.",
              },
            ],
          };
        }

        // Helper function to extract duration from text
        const extractDuration = (text, attachments) => {
          // Common patterns for duration in Xcode Cloud messages
          const patterns = [
            /duration[:\s]+(\d+)\s*(?:min(?:ute)?s?)?(?:\s*(\d+)\s*(?:sec(?:ond)?s?)?)?/i,
            /took\s+(\d+)\s*(?:min(?:ute)?s?)?(?:\s*(\d+)\s*(?:sec(?:ond)?s?)?)?/i,
            /completed\s+in\s+(\d+)\s*(?:min(?:ute)?s?)?(?:\s*(\d+)\s*(?:sec(?:ond)?s?)?)?/i,
            /(\d+)\s*(?:min(?:ute)?s?)\s*(?:(\d+)\s*(?:sec(?:ond)?s?)?)?/i,
            /(\d+):(\d+)\s*(?:min)?/i, // MM:SS format
          ];

          const allText = text + ' ' + (attachments?.map(a => `${a.title || ''} ${a.text || ''}`).join(' ') || '');

          for (const pattern of patterns) {
            const match = allText.match(pattern);
            if (match) {
              const mins = parseInt(match[1]) || 0;
              const secs = parseInt(match[2]) || 0;
              const totalSeconds = mins * 60 + secs;
              return {
                minutes: mins,
                seconds: secs,
                totalSeconds,
                formatted: mins > 0 ? `${mins}m ${secs}s` : `${secs}s`,
              };
            }
          }
          return null;
        };

        // Helper function to extract workflow name
        const extractWorkflow = (text, attachments) => {
          // Look for workflow name in text or attachments
          const allText = text + ' ' + (attachments?.map(a => `${a.title || ''} ${a.text || ''}`).join(' ') || '');

          // Common patterns: "Workflow: Name", title of attachment often contains workflow
          const patterns = [
            /workflow[:\s]+([^\n\r,]+)/i,
            /^([A-Z][a-zA-Z0-9-]+(?:\s+[A-Z][a-zA-Z0-9-]+)*)\s+(?:build|workflow)/i,
          ];

          for (const pattern of patterns) {
            const match = allText.match(pattern);
            if (match) {
              return match[1].trim();
            }
          }

          // Check attachment titles - often contains workflow name
          if (attachments && attachments.length > 0) {
            const title = attachments[0].title;
            if (title && title.length > 0 && title.length < 50) {
              return title;
            }
          }

          return null;
        };

        // Parse build messages - Xcode Cloud messages have specific format
        let buildMessages = result.messages.map((msg) => {
          const timestamp = new Date(parseFloat(msg.ts) * 1000).toISOString();

          // Try to extract build status from message
          let status = "unknown";
          const text = msg.text || "";

          if (text.toLowerCase().includes("succeeded") || text.toLowerCase().includes("success")) {
            status = "succeeded";
          } else if (text.toLowerCase().includes("failed") || text.toLowerCase().includes("failure")) {
            status = "failed";
          } else if (text.toLowerCase().includes("started") || text.toLowerCase().includes("running")) {
            status = "running";
          } else if (text.toLowerCase().includes("cancelled") || text.toLowerCase().includes("canceled")) {
            status = "cancelled";
          }

          const workflow = extractWorkflow(text, msg.attachments);
          const duration = extractDuration(text, msg.attachments);

          return {
            timestamp,
            status,
            workflow,
            duration,
            text: text.substring(0, 500), // Truncate long messages
            attachments: msg.attachments?.map(a => ({
              title: a.title,
              text: a.text?.substring(0, 200),
              color: a.color,
            })),
          };
        });

        // Apply workflow filter if specified
        if (workflowFilter) {
          buildMessages = buildMessages.filter((msg) => {
            const workflow = msg.workflow?.toLowerCase() || '';
            const text = msg.text?.toLowerCase() || '';
            const attachmentText = msg.attachments?.map(a => `${a.title || ''} ${a.text || ''}`).join(' ').toLowerCase() || '';
            return workflow.includes(workflowFilter) || text.includes(workflowFilter) || attachmentText.includes(workflowFilter);
          });
        }

        // Apply limit after filtering
        const limit = Math.min(args?.limit || 5, 20);
        buildMessages = buildMessages.slice(0, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                builds: buildMessages,
                filter: workflowFilter ? { workflow: args.workflow } : null,
                count: buildMessages.length,
              }, null, 2),
            },
          ],
        };
      }

      case "get_channel_messages": {
        const channelId = args?.channel_id || buildChannelId;
        if (!channelId) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No channel_id provided and SLACK_BUILD_CHANNEL_ID not configured.",
              },
            ],
          };
        }

        const limit = Math.min(args?.limit || 10, 100);
        const result = await slack.conversations.history({
          channel: channelId,
          limit: limit,
        });

        const messages = (result.messages || []).map((msg) => ({
          timestamp: new Date(parseFloat(msg.ts) * 1000).toISOString(),
          user: msg.user,
          text: msg.text?.substring(0, 500),
          bot_id: msg.bot_id,
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ messages }, null, 2),
            },
          ],
        };
      }

      case "search_messages": {
        const query = args?.query;
        if (!query) {
          return {
            content: [
              {
                type: "text",
                text: "Error: query parameter is required",
              },
            ],
          };
        }

        const limit = Math.min(args?.limit || 10, 100);

        try {
          const result = await slack.search.messages({
            query: query,
            count: limit,
            sort: "timestamp",
            sort_dir: "desc",
          });

          const matches = (result.messages?.matches || []).map((match) => ({
            timestamp: new Date(parseFloat(match.ts) * 1000).toISOString(),
            channel: match.channel?.name,
            text: match.text?.substring(0, 500),
            user: match.user,
          }));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ results: matches, total: result.messages?.total || 0 }, null, 2),
              },
            ],
          };
        } catch (error) {
          // Search requires additional OAuth scopes
          if (error.data?.error === "missing_scope") {
            return {
              content: [
                {
                  type: "text",
                  text: "Error: Bot token missing 'search:read' scope. Add it in your Slack App settings.",
                },
              ],
            };
          }
          throw error;
        }
      }

      case "send_message": {
        const channelId = args?.channel_id || buildChannelId;
        const text = args?.text;

        if (!channelId) {
          return {
            content: [
              {
                type: "text",
                text: "Error: No channel_id provided and SLACK_BUILD_CHANNEL_ID not configured.",
              },
            ],
          };
        }

        if (!text) {
          return {
            content: [
              {
                type: "text",
                text: "Error: text parameter is required",
              },
            ],
          };
        }

        const result = await slack.chat.postMessage({
          channel: channelId,
          text: text,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: result.ok,
                timestamp: result.ts,
                channel: result.channel,
              }, null, 2),
            },
          ],
        };
      }

      case "list_channels": {
        const limit = Math.min(args?.limit || 50, 200);

        const result = await slack.conversations.list({
          types: "public_channel,private_channel",
          limit: limit,
        });

        const channels = (result.channels || []).map((ch) => ({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
          is_member: ch.is_member,
          topic: ch.topic?.value?.substring(0, 100),
        }));

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ channels }, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Slack API error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Slack Notifications MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
