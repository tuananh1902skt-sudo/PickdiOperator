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

-- Ngưỡng chấm điểm sourcing riêng của workspace (xem WorkspaceScoringCriteria trong
-- src/types.ts) — cấu hình được trong Settings, không hardcode trong scoring.ts.
alter table workspaces add column if not exists "scoringCriteria" jsonb;

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
  -- "tiktokOneId" text, -- TikTok One retired (Kalodata/TCM now); not dropped from prod yet, confirm before DROP COLUMN
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
  -- TikTok One-only columns below, not dropped from prod yet — confirm before DROP COLUMN:
  -- "medianViewsBenchmark" text,
  -- "sixSecondViewRate" text,
  -- "sixSecondViewRateBenchmark" text,
  -- "engagementRateBenchmark" text,
  -- "industryTag" text,
  -- "videoContentTag" text,
  -- "brandedVideosCount" integer,
  -- "industryCoveredCount" integer,
  "recentVideos" jsonb,
  demographics jsonb,
  "isMock" boolean,
  -- "scores" jsonb, -- TikTok One-only, not dropped from prod yet — confirm before DROP COLUMN
  -- "audienceDemographicsFull" jsonb,
  -- "followerHistory" jsonb,
  -- "topVideos" jsonb,
  -- "recentVideosFull" jsonb,
  -- "brandPartners" jsonb,
  "scoreBreakdown" jsonb,
  "campaignScores" jsonb,
  created_at_ts bigint,
  rowid bigserial
);
create index if not exists creators_handle_idx on creators (lower(handle));
-- create index if not exists creators_tiktok_one_id_idx on creators ("tiktokOneId"); -- column commented above

-- getAllCreators() (src/db.ts) luôn order theo created_at_ts + rowid để phân trang .range() — không
-- có index thì mỗi trang phải sort toàn bảng. status/country/category giờ cũng được lọc bằng .eq()
-- ngay trong SQL (thay vì kéo hết bảng rồi lọc ở JS) nên cần index để tránh sequential scan.
create index if not exists creators_created_at_ts_idx on creators (created_at_ts desc, rowid desc);
create index if not exists creators_status_idx on creators (status);
create index if not exists creators_country_idx on creators (country);
create index if not exists creators_category_idx on creators (category);

-- d'Alba sourcing criteria fields added after initial launch (Kalodata import) — "add column
-- if not exists" so this file stays safe to re-run against a project that already has this table.
alter table creators add column if not exists "gmvTier" text;
alter table creators add column if not exists gpm double precision;
alter table creators add column if not exists "beautyCategoryRatio" double precision;
alter table creators add column if not exists "hasAffiliateGmv" boolean;
alter table creators add column if not exists "metricsSource" text;
alter table creators add column if not exists "metricsSyncedAt" text;
-- Ngày import file/sheet (Kalodata/Cruva/Generic CSV) — tách biệt với metricsSyncedAt (ngày cào
-- qua TCM extension), xem comment Creator.importedAt trong src/types.ts.
alter table creators add column if not exists "importedAt" text;

-- Chi tiết theo đúng tab thật của TikTok Creator Marketplace creator detail (PPS/Sample
-- score/Sales/Collaboration metrics/Video/LIVE) — thêm sau Session 5 UI redesign.
alter table creators add column if not exists pps jsonb;
alter table creators add column if not exists "sampleScore" jsonb;
alter table creators add column if not exists "salesMetrics" jsonb;
alter table creators add column if not exists "collabMetrics" jsonb;
alter table creators add column if not exists "videoMetrics" jsonb;
alter table creators add column if not exists "liveMetrics" jsonb;

-- creator_oecuid từ TCM (affiliate-us.tiktok.com) — dùng để dựng link thẳng tới trang
-- creator detail thật trên TCM, hiển thị cạnh link profile TikTok trong CreatorDetailDrawer.
alter table creators add column if not exists "tcmCreatorOecuid" text;

-- Đánh dấu lần gần nhất extension search "Find Creators" theo handle KHÔNG khớp được creator
-- này trên TCM — dùng cho nhãn cảnh báo "Không tìm thấy trên TCM" trong CreatorListView.
-- Xem POST /api/creators/tcm-not-found (server.ts) và extension/background.js (no_match).
alter table creators add column if not exists "tcmNotFoundAt" text;

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
  "contentSource" text,
  cc text,
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
  "gmvTier" text,
  qualification text,
  "originalPrice" double precision,
  "negotiatedPrice" double precision,
  "pricePerVideo" double precision,
  "commissionPercent" double precision,
  "contractedVideoCount" integer,
  "contractUrl" text,
  "castingStage" text,
  created_at_ts bigint,
  rowid bigserial
);
create index if not exists cca_creator_idx on creator_campaign_assignments ("creatorId");
create index if not exists cca_campaign_idx on creator_campaign_assignments ("campaignId");

-- Sourcing List fields added after initial launch — "add column if not exists" so this
-- file stays safe to re-run against a project that already has this table.
alter table creator_campaign_assignments add column if not exists "gmvTier" text;
alter table creator_campaign_assignments add column if not exists qualification text;
alter table creator_campaign_assignments add column if not exists "originalPrice" double precision;
alter table creator_campaign_assignments add column if not exists "negotiatedPrice" double precision;
alter table creator_campaign_assignments add column if not exists "pricePerVideo" double precision;
alter table creator_campaign_assignments add column if not exists "commissionPercent" double precision;
alter table creator_campaign_assignments add column if not exists "contractedVideoCount" integer;
alter table creator_campaign_assignments add column if not exists "contractUrl" text;
alter table creator_campaign_assignments add column if not exists "castingStage" text;

-- Bảng "Uploaded" trong file d'Alba Onboarding.xlsx — video đã đăng chính thức + ROI.
create table if not exists posted_videos (
  id text primary key,
  "workspaceId" text,
  "reviewId" text,
  "creatorId" text,
  "creatorName" text,
  "creatorHandle" text,
  "campaignId" text,
  "campaignName" text,
  round text,
  "pricePerVideo" double precision,
  paid boolean,
  "postedAt" text,
  "videoUrl" text,
  "videoId" text,
  "adCode" text,
  roi double precision,
  "totalRevenue" double precision,
  "totalOrders" integer,
  "totalAdSpend" double precision,
  "isMock" boolean,
  created_at_ts bigint,
  rowid bigserial
);
create index if not exists posted_videos_creator_idx on posted_videos ("creatorId");
create index if not exists posted_videos_campaign_idx on posted_videos ("campaignId");

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

-- Migration: bulk_outreach_jobs gained "contentSource" (ai | template, records how a job's
-- drafts were produced so per-item "Viết lại" stays consistent) and "cc" (was previously
-- accepted by the API but never actually persisted). Safe to re-run.
alter table bulk_outreach_jobs add column if not exists "contentSource" text;
alter table bulk_outreach_jobs add column if not exists cc text;

-- Migration: bulk_outreach_jobs gained "nextSendAt" (when the next item is due, so a stuck
-- job can be detected) and "sendLockUntil" (short-lived claim so only one caller advances a
-- job at a time). Backs the resume-on-poll fallback for when QStash isn't configured — on
-- Vercel the in-process setTimeout pacing chain dies with the serverless function, so
-- without this a job silently stalls forever after its first item. Safe to re-run.
alter table bulk_outreach_jobs add column if not exists "nextSendAt" text;
alter table bulk_outreach_jobs add column if not exists "sendLockUntil" text;

-- Migration: unmatched_inbound_emails gained "messageId" — without it, an inbound reply that
-- goes through manual assignment (ambiguous sender email matching multiple creators) loses
-- its Message-ID forever, permanently breaking In-Reply-To/References threading for any
-- reminder sent later in that conversation even though the subject line still looks correct.
-- Safe to re-run.
alter table unmatched_inbound_emails add column if not exists "messageId" text;
