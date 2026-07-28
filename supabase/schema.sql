-- PickdiOperator Postgres schema for Supabase.
-- Column names are double-quoted to preserve the exact camelCase casing the app's
-- Supabase client (src/db.ts) sends — Postgres would otherwise lowercase them.
-- Run this once in the Supabase SQL editor (or via the Supabase CLI) against a fresh project.

create table if not exists workspaces (
  id text primary key,
  name text,
  code text,
  "brandName" text,
  category text,
  "logoUrl" text,
  color text,
  description text,
  "isAgency" boolean,
  "memberCount" integer,
  "creatorCount" integer,
  "activeCampaignCount" integer,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists creators (
  id text primary key,
  "workspaceId" text,
  source text,
  handle text,
  "displayName" text,
  avatar text,
  platform text,
  country text,
  language text,
  bio text,
  "profileUrl" text,
  "tiktokOneId" text,
  followers double precision,
  "avgViews" double precision,
  "engagementRate" double precision,
  gmv30d double precision,
  category text,
  niche jsonb,
  "brandFitScore" double precision,
  "commercialScore" double precision,
  "riskScore" double precision,
  status text,
  owner text,
  email text,
  phone text,
  instagram text,
  "rateCard" text,
  "lastContactAt" text,
  "createdAt" text,
  "updatedAt" text,
  notes jsonb,
  tags jsonb,
  "followerGrowthRate" text,
  "postingFrequency30d" double precision,
  "maxMinRatio" text,
  "lastVideoDate" text,
  "erFollower" double precision,
  "medianViews" text,
  "medianViewsBenchmark" text,
  "sixSecondViewRate" text,
  "sixSecondViewRateBenchmark" text,
  "engagementRateBenchmark" text,
  "industryTag" text,
  "videoContentTag" text,
  "brandedVideosCount" integer,
  "industryCoveredCount" integer,
  "recentVideos" jsonb,
  demographics jsonb,
  scores jsonb,
  "isMock" boolean,
  "audienceDemographicsFull" jsonb,
  "followerHistory" jsonb,
  "topVideos" jsonb,
  "recentVideosFull" jsonb,
  "brandPartners" jsonb,
  "scoreBreakdown" jsonb,
  "campaignScores" jsonb,
  created_at_ts bigint,
  rowid bigserial
);
create index if not exists creators_handle_idx on creators (lower(handle));
create index if not exists creators_tiktok_one_id_idx on creators ("tiktokOneId");

create table if not exists campaigns (
  id text primary key,
  "workspaceId" text,
  name text,
  brand text,
  objective text,
  description text,
  budget double precision,
  spent double precision,
  currency text,
  status text,
  "startDate" text,
  "endDate" text,
  owner text,
  "creatorIds" jsonb,
  "targetCategories" jsonb,
  "targetAudience" jsonb,
  products jsonb,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists outreach_emails (
  id text primary key,
  "workspaceId" text,
  "creatorId" text,
  "creatorName" text,
  "creatorHandle" text,
  "campaignId" text,
  "campaignName" text,
  subject text,
  body text,
  status text,
  "sentAt" text,
  "repliedAt" text,
  "followUpCount" integer,
  "sequenceStage" text,
  "messageId" text,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

-- Items are stored as one JSON blob per job (not a separate table) — a bulk job's item
-- list is only ever read/written as a whole, never queried relationally.
create table if not exists bulk_outreach_jobs (
  id text primary key,
  "workspaceId" text,
  "campaignId" text,
  "campaignName" text,
  "sequenceStage" text,
  status text,
  "pacingMinSeconds" integer,
  "pacingMaxSeconds" integer,
  "dailyCap" integer,
  "createdAt" text,
  items jsonb,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists conversations (
  id text primary key,
  "workspaceId" text,
  "creatorId" text,
  "creatorName" text,
  "creatorHandle" text,
  "creatorAvatar" text,
  "campaignId" text,
  "campaignName" text,
  status text,
  "lastMessageAt" text,
  messages jsonb,
  unread boolean,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists content_reviews (
  id text primary key,
  "workspaceId" text,
  "creatorId" text,
  "creatorName" text,
  "creatorHandle" text,
  "creatorAvatar" text,
  "campaignId" text,
  "campaignName" text,
  "videoTitle" text,
  "draftUrl" text,
  "thumbnailUrl" text,
  "videoThumbnail" text,
  "durationSeconds" integer,
  status text,
  "dueAt" text,
  "submittedAt" text,
  checklist jsonb,
  "feedbackNote" text,
  feedback text,
  "aiAnalysis" text,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists tasks (
  id text primary key,
  "workspaceId" text,
  title text,
  description text,
  priority text,
  status text,
  "dueDate" text,
  owner text,
  "assignedTo" text,
  "relatedCreatorId" text,
  "relatedCreatorName" text,
  "relatedCampaignId" text,
  "relatedCampaignName" text,
  "createdAt" text,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists notifications (
  id text primary key,
  "workspaceId" text,
  title text,
  description text,
  priority text,
  category text,
  "isRead" boolean,
  "createdAt" text,
  link text,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists activities (
  id text primary key,
  "workspaceId" text,
  actor text,
  action text,
  target text,
  "entityType" text,
  "entityId" text,
  "timestamp" text,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);

create table if not exists settings (
  key text primary key,
  value text
);

-- Generic app-config KV store — replaces the old local JSON config files
-- (email/IMAP config, AI provider config, outreach templates).
create table if not exists app_config (
  key text primary key,
  value text
);

-- 1 creator ↔ nhiều campaign (nhiều brand) — xem CreatorCampaignAssignment ở types.ts.
create table if not exists creator_campaign_assignments (
  id text primary key,
  "creatorId" text,
  "campaignId" text,
  "campaignName" text,
  "workspaceId" text,
  status text,
  "assignedAt" text,
  "ratePaid" double precision,
  notes text,
  created_at_ts bigint,
  rowid bigserial
);
create index if not exists cca_creator_idx on creator_campaign_assignments ("creatorId");
create index if not exists cca_campaign_idx on creator_campaign_assignments ("campaignId");

create table if not exists unmatched_inbound_emails (
  id text primary key,
  "senderEmail" text,
  "senderName" text,
  subject text,
  content text,
  "receivedAt" text,
  "candidateCreatorIds" jsonb,
  resolved boolean,
  created_at_ts bigint,
  rowid bigserial
);

-- Public bucket for re-hosted creator avatars (replaces data/avatars/ local disk storage).
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;
