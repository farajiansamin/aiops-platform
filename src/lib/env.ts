import { z } from "zod/v4";

const envSchema = z.object({
  // LLM Provider (at least one required)
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),

  // Slack
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_USER_TOKEN: z.string().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),

  // Rootly
  ROOTLY_API_TOKEN: z.string().optional(),
  ROOTLY_BASE_URL: z.string().optional().default("https://api.rootly.com"),

  // JIRA / Atlassian
  ATLASSIAN_HOST: z.string().optional(),
  ATLASSIAN_EMAIL: z.string().optional(),
  ATLASSIAN_API_TOKEN: z.string().optional(),

  // Confluence (shares Atlassian creds)
  CONFLUENCE_HOST: z.string().optional(),

  // GitHub
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_ORG: z.string().optional(),

  // Database
  POSTGRES_URL: z.string().optional(),

  // NextAuth
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().optional(),

  // App
  NEXT_PUBLIC_APP_URL: z.string().optional().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.warn("Environment validation warnings:", parsed.error.format());
    return process.env as unknown as Env;
  }
  return parsed.data;
}

export const env = getEnv();
