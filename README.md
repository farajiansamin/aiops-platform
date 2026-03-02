# AIOps Platform

AI-powered infrastructure operations platform built with Next.js, Vercel AI SDK, and a hybrid MCP-ready architecture. Integrates with Slack, Rootly, JIRA, Confluence, and GitHub.

## Architecture

- **Agent Layer**: Vercel AI SDK with provider-agnostic LLM support (OpenAI, Anthropic, Google)
- **Tool Providers**: Extensible provider pattern for Slack, Rootly, JIRA, Confluence, GitHub
- **MCP-Ready**: Built-in adapter layer for future extraction to standalone MCP servers
- **Human-in-the-Loop**: Verification-first design where AI synthesizes data, humans make decisions
- **Web UI**: Dashboard for incidents, FAQ management, communications, post-mortems

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database
- At least one LLM API key (OpenAI, Anthropic, or Google)

### Setup

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local
# Edit .env.local with your API keys and configuration

# Push database schema
npm run db:push

# Start development server
npm run dev
```

### Environment Variables

See `.env.example` for all available configuration. At minimum, you need:

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` or `GOOGLE_GENERATIVE_AI_API_KEY` | Yes (one) | LLM provider API key |
| `POSTGRES_URL` | Yes | PostgreSQL connection URL |
| `SLACK_BOT_TOKEN` | For Slack | Slack Bot OAuth token |
| `SLACK_SIGNING_SECRET` | For Slack | Slack app signing secret |
| `ROOTLY_API_TOKEN` | For Rootly | Rootly API bearer token |
| `ATLASSIAN_HOST` | For JIRA/Confluence | Atlassian instance hostname |
| `ATLASSIAN_EMAIL` | For JIRA/Confluence | Atlassian account email |
| `ATLASSIAN_API_TOKEN` | For JIRA/Confluence | Atlassian API token |
| `GITHUB_TOKEN` | For GitHub | GitHub personal access token |

## Webhook Configuration

### Slack App

1. Create a Slack app at https://api.slack.com/apps
2. Enable Event Subscriptions with URL: `https://your-domain/api/webhooks/slack/events`
3. Subscribe to `message.channels` events
4. Enable Interactivity with URL: `https://your-domain/api/webhooks/slack/interactivity`
5. Required bot scopes: `chat:write`, `channels:history`, `channels:read`, `reactions:read`, `users:read`
6. Required user scope: `search:read` (needed for `search.messages`)
7. Set both `SLACK_BOT_TOKEN` (`xoxb-...`) and `SLACK_USER_TOKEN` (`xoxp-...`) in environment variables

### Rootly

1. In Rootly settings, configure a webhook pointing to: `https://your-domain/api/webhooks/rootly`
2. Subscribe to incident lifecycle events

## Deploy on Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repo to Vercel for automatic deployments.

Set all environment variables in the Vercel dashboard under Project Settings > Environment Variables. Provision Vercel Postgres (or Neon) from the Vercel Marketplace.

## Project Structure

```
src/
  app/                        # Next.js App Router
    (dashboard)/              # Web UI (dashboard, incidents, FAQ, etc.)
    api/                      # API routes (chat, webhooks, approvals)
  lib/
    agent/                    # AI agent core (model, prompts, tool registry)
    providers/                # Tool providers (slack, rootly, jira, confluence, github)
      base.ts                 # ToolProvider interface + registry
      mcp-adapter.ts          # MCP adapter layer
    workflows/                # Business logic (infra-triage, customer-impact, postmortem)
    db/                       # Drizzle ORM schema and queries
  components/                 # React UI components
```

## Adding a New Integration

1. Create `src/lib/providers/your-service/` with `index.ts`, `client.ts`, `tools.ts`, `types.ts`
2. Implement the `ToolProvider` interface in `index.ts`
3. Register it in `src/lib/agent/tools.ts` (conditionally, based on env vars)
4. The agent automatically gains access to the new tools

No changes needed to the agent core, workflows, or UI.

## Key Workflows

### Infrastructure Triage
When a help request arrives in the #infrastructure Slack channel:
1. The agent extracts entities (service, timeframe, symptoms)
2. Silently investigates: Rootly incidents, alert channels, GitHub changes, FAQ
3. Posts an interactive Block Kit response with action buttons
4. Engineers click to expand alert correlation, code changes, or incident details

### Customer Impact Communication
When a high-severity Rootly incident is declared:
1. The agent drafts a customer notification email
2. Creates a human checkpoint for tone review
3. The team reviews and sends from the dashboard

### Post-Mortem Drafting
When a Rootly incident is resolved:
1. The agent gathers incident timeline and context
2. Drafts a PIR document in Markdown
3. Creates a human checkpoint for commander approval
4. Once approved, can be published to Confluence
