import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  varchar,
  boolean,
  uuid,
  pgEnum,
} from "drizzle-orm/pg-core";

export const approvalStatusEnum = pgEnum("approval_status", [
  "pending",
  "approved",
  "rejected",
  "expired",
]);

export const approvalTypeEnum = pgEnum("approval_type", [
  "execution_authority",
  "knowledge_approval",
  "data_validation",
  "tone_calibration",
]);

export const incidents = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  rootlyId: varchar("rootly_id", { length: 255 }).unique(),
  title: text("title").notNull(),
  summary: text("summary"),
  severity: varchar("severity", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("active"),
  commander: varchar("commander", { length: 255 }),
  slackChannelId: varchar("slack_channel_id", { length: 255 }),
  services: jsonb("services").$type<string[]>().default([]),
  startedAt: timestamp("started_at"),
  mitigatedAt: timestamp("mitigated_at"),
  resolvedAt: timestamp("resolved_at"),
  impactedUserCount: integer("impacted_user_count"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const faqs = pgTable("faqs", {
  id: uuid("id").primaryKey().defaultRandom(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  tags: jsonb("tags").$type<string[]>().default([]),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  createdBy: varchar("created_by", { length: 50 }).notNull().default("ai"),
  confluencePageId: varchar("confluence_page_id", { length: 255 }),
  relatedServices: jsonb("related_services").$type<string[]>().default([]),
  useCount: integer("use_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const approvals = pgTable("approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: varchar("workflow_id", { length: 255 }),
  type: approvalTypeEnum("type").notNull(),
  summary: text("summary").notNull(),
  detailUrl: text("detail_url"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  status: approvalStatusEnum("status").notNull().default("pending"),
  decidedBy: varchar("decided_by", { length: 255 }),
  decidedAt: timestamp("decided_at"),
  slackMessageTs: varchar("slack_message_ts", { length: 255 }),
  slackChannelId: varchar("slack_channel_id", { length: 255 }),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const communications = pgTable("communications", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").references(() => incidents.id),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  recipientCount: integer("recipient_count").default(0),
  recipientSegment: varchar("recipient_segment", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  sentAt: timestamp("sent_at"),
  sentBy: varchar("sent_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const postmortems = pgTable("postmortems", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id").references(() => incidents.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("draft"),
  confluencePageId: varchar("confluence_page_id", { length: 255 }),
  publishedAt: timestamp("published_at"),
  publishedBy: varchar("published_by", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const impactedUsers = pgTable("impacted_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  incidentId: uuid("incident_id")
    .references(() => incidents.id)
    .notNull(),
  externalUserId: varchar("external_user_id", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  tier: varchar("tier", { length: 50 }),
  impactType: varchar("impact_type", { length: 255 }),
  impactDetails: text("impact_details"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const serviceRepos = pgTable("service_repos", {
  id: uuid("id").primaryKey().defaultRandom(),
  serviceName: varchar("service_name", { length: 255 }).notNull(),
  repoFullName: varchar("repo_full_name", { length: 255 }).notNull(),
  pathsFilter: text("paths_filter"),
  autoDiscovered: boolean("auto_discovered").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const alertChannels = pgTable("alert_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: varchar("channel_id", { length: 255 }).notNull().unique(),
  channelName: varchar("channel_name", { length: 255 }).notNull(),
  alertType: varchar("alert_type", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const issueEmbeddings = pgTable("issue_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  description: text("description").notNull(),
  service: varchar("service", { length: 255 }).notNull(),
  symptoms: jsonb("symptoms").$type<string[]>().default([]),
  embedding: jsonb("embedding").$type<number[]>().notNull(),
  channel: varchar("channel", { length: 255 }),
  threadTs: varchar("thread_ts", { length: 255 }),
  resolvedVia: text("resolved_via"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  action: varchar("action", { length: 255 }).notNull(),
  actor: varchar("actor", { length: 255 }).notNull(),
  actorType: varchar("actor_type", { length: 50 }).notNull().default("ai"),
  resourceType: varchar("resource_type", { length: 255 }),
  resourceId: varchar("resource_id", { length: 255 }),
  details: jsonb("details").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
export type FAQ = typeof faqs.$inferSelect;
export type NewFAQ = typeof faqs.$inferInsert;
export type Approval = typeof approvals.$inferSelect;
export type NewApproval = typeof approvals.$inferInsert;
export type Communication = typeof communications.$inferSelect;
export type NewCommunication = typeof communications.$inferInsert;
export type Postmortem = typeof postmortems.$inferSelect;
export type NewPostmortem = typeof postmortems.$inferInsert;
export type ImpactedUser = typeof impactedUsers.$inferSelect;
export type NewImpactedUser = typeof impactedUsers.$inferInsert;
export type ServiceRepo = typeof serviceRepos.$inferSelect;
export type AlertChannel = typeof alertChannels.$inferSelect;
export type IssueEmbedding = typeof issueEmbeddings.$inferSelect;
export type NewIssueEmbedding = typeof issueEmbeddings.$inferInsert;
export type AuditLogEntry = typeof auditLog.$inferSelect;
