drop extension if exists "pg_net";

create sequence "public"."activities_rowid_seq";

create sequence "public"."bulk_outreach_jobs_rowid_seq";

create sequence "public"."campaigns_rowid_seq";

create sequence "public"."content_reviews_rowid_seq";

create sequence "public"."conversations_rowid_seq";

create sequence "public"."creator_campaign_assignments_rowid_seq";

create sequence "public"."creators_rowid_seq";

create sequence "public"."notifications_rowid_seq";

create sequence "public"."outreach_emails_rowid_seq";

create sequence "public"."posted_videos_rowid_seq";

create sequence "public"."tasks_rowid_seq";

create sequence "public"."unmatched_inbound_emails_rowid_seq";

create sequence "public"."workspaces_rowid_seq";


  create table "public"."activities" (
    "id" text not null,
    "workspaceId" text,
    "actor" text,
    "action" text,
    "target" text,
    "entityType" text,
    "entityId" text,
    "timestamp" text,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.activities_rowid_seq'::regclass)
      );


alter table "public"."activities" enable row level security;


  create table "public"."app_config" (
    "key" text not null,
    "value" text
      );


alter table "public"."app_config" enable row level security;


  create table "public"."bulk_outreach_jobs" (
    "id" text not null,
    "workspaceId" text,
    "campaignId" text,
    "campaignName" text,
    "sequenceStage" text,
    "status" text,
    "pacingMinSeconds" integer,
    "pacingMaxSeconds" integer,
    "dailyCap" integer,
    "createdAt" text,
    "items" jsonb,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.bulk_outreach_jobs_rowid_seq'::regclass),
    "contentSource" text,
    "cc" text,
    "nextSendAt" text,
    "sendLockUntil" text
      );


alter table "public"."bulk_outreach_jobs" enable row level security;


  create table "public"."campaigns" (
    "id" text not null,
    "workspaceId" text,
    "name" text,
    "brand" text,
    "objective" text,
    "description" text,
    "budget" double precision,
    "spent" double precision,
    "currency" text,
    "status" text,
    "startDate" text,
    "endDate" text,
    "owner" text,
    "creatorIds" jsonb,
    "targetCategories" jsonb,
    "targetAudience" jsonb,
    "products" jsonb,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.campaigns_rowid_seq'::regclass)
      );


alter table "public"."campaigns" enable row level security;


  create table "public"."content_reviews" (
    "id" text not null,
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
    "status" text,
    "dueAt" text,
    "submittedAt" text,
    "checklist" jsonb,
    "feedbackNote" text,
    "feedback" text,
    "aiAnalysis" text,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.content_reviews_rowid_seq'::regclass)
      );


alter table "public"."content_reviews" enable row level security;


  create table "public"."conversations" (
    "id" text not null,
    "workspaceId" text,
    "creatorId" text,
    "creatorName" text,
    "creatorHandle" text,
    "creatorAvatar" text,
    "campaignId" text,
    "campaignName" text,
    "status" text,
    "lastMessageAt" text,
    "messages" jsonb,
    "unread" boolean,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.conversations_rowid_seq'::regclass)
      );


alter table "public"."conversations" enable row level security;


  create table "public"."creator_campaign_assignments" (
    "id" text not null,
    "creatorId" text,
    "campaignId" text,
    "campaignName" text,
    "workspaceId" text,
    "status" text,
    "assignedAt" text,
    "ratePaid" double precision,
    "notes" text,
    "gmvTier" text,
    "qualification" text,
    "originalPrice" double precision,
    "negotiatedPrice" double precision,
    "pricePerVideo" double precision,
    "commissionPercent" double precision,
    "contractedVideoCount" integer,
    "contractUrl" text,
    "castingStage" text,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.creator_campaign_assignments_rowid_seq'::regclass)
      );


alter table "public"."creator_campaign_assignments" enable row level security;


  create table "public"."creators" (
    "id" text not null,
    "workspaceId" text,
    "source" text,
    "handle" text,
    "displayName" text,
    "avatar" text,
    "platform" text,
    "country" text,
    "language" text,
    "bio" text,
    "profileUrl" text,
    "tiktokOneId" text,
    "followers" double precision,
    "avgViews" double precision,
    "engagementRate" double precision,
    "gmv30d" double precision,
    "category" text,
    "niche" jsonb,
    "brandFitScore" double precision,
    "commercialScore" double precision,
    "riskScore" double precision,
    "status" text,
    "owner" text,
    "email" text,
    "phone" text,
    "instagram" text,
    "rateCard" text,
    "lastContactAt" text,
    "createdAt" text,
    "updatedAt" text,
    "notes" jsonb,
    "tags" jsonb,
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
    "demographics" jsonb,
    "scores" jsonb,
    "isMock" boolean,
    "audienceDemographicsFull" jsonb,
    "followerHistory" jsonb,
    "topVideos" jsonb,
    "recentVideosFull" jsonb,
    "brandPartners" jsonb,
    "scoreBreakdown" jsonb,
    "campaignScores" jsonb,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.creators_rowid_seq'::regclass),
    "gmvTier" text,
    "gpm" double precision,
    "beautyCategoryRatio" double precision,
    "hasAffiliateGmv" boolean,
    "metricsSource" text,
    "metricsSyncedAt" text,
    "pps" jsonb,
    "sampleScore" jsonb,
    "salesMetrics" jsonb,
    "collabMetrics" jsonb,
    "videoMetrics" jsonb,
    "liveMetrics" jsonb,
    "tcmCreatorOecuid" text,
    "importedAt" text,
    "tcmNotFoundAt" text
      );


alter table "public"."creators" enable row level security;


  create table "public"."notifications" (
    "id" text not null,
    "workspaceId" text,
    "title" text,
    "description" text,
    "priority" text,
    "category" text,
    "isRead" boolean,
    "createdAt" text,
    "link" text,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.notifications_rowid_seq'::regclass)
      );


alter table "public"."notifications" enable row level security;


  create table "public"."outreach_emails" (
    "id" text not null,
    "workspaceId" text,
    "creatorId" text,
    "creatorName" text,
    "creatorHandle" text,
    "campaignId" text,
    "campaignName" text,
    "subject" text,
    "body" text,
    "status" text,
    "sentAt" text,
    "repliedAt" text,
    "followUpCount" integer,
    "sequenceStage" text,
    "messageId" text,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.outreach_emails_rowid_seq'::regclass)
      );


alter table "public"."outreach_emails" enable row level security;


  create table "public"."posted_videos" (
    "id" text not null,
    "workspaceId" text,
    "reviewId" text,
    "creatorId" text,
    "creatorName" text,
    "creatorHandle" text,
    "campaignId" text,
    "campaignName" text,
    "round" text,
    "pricePerVideo" double precision,
    "paid" boolean,
    "postedAt" text,
    "videoUrl" text,
    "videoId" text,
    "adCode" text,
    "roi" double precision,
    "totalRevenue" double precision,
    "totalOrders" integer,
    "totalAdSpend" double precision,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.posted_videos_rowid_seq'::regclass)
      );


alter table "public"."posted_videos" enable row level security;


  create table "public"."settings" (
    "key" text not null,
    "value" text
      );


alter table "public"."settings" enable row level security;


  create table "public"."tasks" (
    "id" text not null,
    "workspaceId" text,
    "title" text,
    "description" text,
    "priority" text,
    "status" text,
    "dueDate" text,
    "owner" text,
    "assignedTo" text,
    "relatedCreatorId" text,
    "relatedCreatorName" text,
    "relatedCampaignId" text,
    "relatedCampaignName" text,
    "createdAt" text,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.tasks_rowid_seq'::regclass)
      );


alter table "public"."tasks" enable row level security;


  create table "public"."unmatched_inbound_emails" (
    "id" text not null,
    "senderEmail" text,
    "senderName" text,
    "subject" text,
    "content" text,
    "receivedAt" text,
    "candidateCreatorIds" jsonb,
    "resolved" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.unmatched_inbound_emails_rowid_seq'::regclass)
      );


alter table "public"."unmatched_inbound_emails" enable row level security;


  create table "public"."workspaces" (
    "id" text not null,
    "name" text,
    "code" text,
    "brandName" text,
    "category" text,
    "logoUrl" text,
    "color" text,
    "description" text,
    "isAgency" boolean,
    "memberCount" integer,
    "creatorCount" integer,
    "activeCampaignCount" integer,
    "isMock" boolean,
    "created_at_ts" bigint,
    "rowid" bigint not null default nextval('public.workspaces_rowid_seq'::regclass),
    "scoringCriteria" jsonb
      );


alter table "public"."workspaces" enable row level security;

alter sequence "public"."activities_rowid_seq" owned by "public"."activities"."rowid";

alter sequence "public"."bulk_outreach_jobs_rowid_seq" owned by "public"."bulk_outreach_jobs"."rowid";

alter sequence "public"."campaigns_rowid_seq" owned by "public"."campaigns"."rowid";

alter sequence "public"."content_reviews_rowid_seq" owned by "public"."content_reviews"."rowid";

alter sequence "public"."conversations_rowid_seq" owned by "public"."conversations"."rowid";

alter sequence "public"."creator_campaign_assignments_rowid_seq" owned by "public"."creator_campaign_assignments"."rowid";

alter sequence "public"."creators_rowid_seq" owned by "public"."creators"."rowid";

alter sequence "public"."notifications_rowid_seq" owned by "public"."notifications"."rowid";

alter sequence "public"."outreach_emails_rowid_seq" owned by "public"."outreach_emails"."rowid";

alter sequence "public"."posted_videos_rowid_seq" owned by "public"."posted_videos"."rowid";

alter sequence "public"."tasks_rowid_seq" owned by "public"."tasks"."rowid";

alter sequence "public"."unmatched_inbound_emails_rowid_seq" owned by "public"."unmatched_inbound_emails"."rowid";

alter sequence "public"."workspaces_rowid_seq" owned by "public"."workspaces"."rowid";

CREATE UNIQUE INDEX activities_pkey ON public.activities USING btree (id);

CREATE UNIQUE INDEX app_config_pkey ON public.app_config USING btree (key);

CREATE UNIQUE INDEX bulk_outreach_jobs_pkey ON public.bulk_outreach_jobs USING btree (id);

CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id);

CREATE INDEX cca_campaign_idx ON public.creator_campaign_assignments USING btree ("campaignId");

CREATE INDEX cca_creator_idx ON public.creator_campaign_assignments USING btree ("creatorId");

CREATE UNIQUE INDEX content_reviews_pkey ON public.content_reviews USING btree (id);

CREATE UNIQUE INDEX conversations_pkey ON public.conversations USING btree (id);

CREATE UNIQUE INDEX creator_campaign_assignments_pkey ON public.creator_campaign_assignments USING btree (id);

CREATE INDEX creators_category_idx ON public.creators USING btree (category);

CREATE INDEX creators_country_idx ON public.creators USING btree (country);

CREATE INDEX creators_created_at_ts_idx ON public.creators USING btree (created_at_ts DESC, rowid DESC);

CREATE INDEX creators_handle_idx ON public.creators USING btree (lower(handle));

CREATE UNIQUE INDEX creators_pkey ON public.creators USING btree (id);

CREATE INDEX creators_status_idx ON public.creators USING btree (status);

CREATE INDEX creators_tiktok_one_id_idx ON public.creators USING btree ("tiktokOneId");

CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id);

CREATE UNIQUE INDEX outreach_emails_pkey ON public.outreach_emails USING btree (id);

CREATE INDEX posted_videos_campaign_idx ON public.posted_videos USING btree ("campaignId");

CREATE INDEX posted_videos_creator_idx ON public.posted_videos USING btree ("creatorId");

CREATE UNIQUE INDEX posted_videos_pkey ON public.posted_videos USING btree (id);

CREATE UNIQUE INDEX settings_pkey ON public.settings USING btree (key);

CREATE UNIQUE INDEX tasks_pkey ON public.tasks USING btree (id);

CREATE UNIQUE INDEX unmatched_inbound_emails_pkey ON public.unmatched_inbound_emails USING btree (id);

CREATE UNIQUE INDEX workspaces_pkey ON public.workspaces USING btree (id);

alter table "public"."activities" add constraint "activities_pkey" PRIMARY KEY using index "activities_pkey";

alter table "public"."app_config" add constraint "app_config_pkey" PRIMARY KEY using index "app_config_pkey";

alter table "public"."bulk_outreach_jobs" add constraint "bulk_outreach_jobs_pkey" PRIMARY KEY using index "bulk_outreach_jobs_pkey";

alter table "public"."campaigns" add constraint "campaigns_pkey" PRIMARY KEY using index "campaigns_pkey";

alter table "public"."content_reviews" add constraint "content_reviews_pkey" PRIMARY KEY using index "content_reviews_pkey";

alter table "public"."conversations" add constraint "conversations_pkey" PRIMARY KEY using index "conversations_pkey";

alter table "public"."creator_campaign_assignments" add constraint "creator_campaign_assignments_pkey" PRIMARY KEY using index "creator_campaign_assignments_pkey";

alter table "public"."creators" add constraint "creators_pkey" PRIMARY KEY using index "creators_pkey";

alter table "public"."notifications" add constraint "notifications_pkey" PRIMARY KEY using index "notifications_pkey";

alter table "public"."outreach_emails" add constraint "outreach_emails_pkey" PRIMARY KEY using index "outreach_emails_pkey";

alter table "public"."posted_videos" add constraint "posted_videos_pkey" PRIMARY KEY using index "posted_videos_pkey";

alter table "public"."settings" add constraint "settings_pkey" PRIMARY KEY using index "settings_pkey";

alter table "public"."tasks" add constraint "tasks_pkey" PRIMARY KEY using index "tasks_pkey";

alter table "public"."unmatched_inbound_emails" add constraint "unmatched_inbound_emails_pkey" PRIMARY KEY using index "unmatched_inbound_emails_pkey";

alter table "public"."workspaces" add constraint "workspaces_pkey" PRIMARY KEY using index "workspaces_pkey";

grant delete on table "public"."activities" to "anon";

grant insert on table "public"."activities" to "anon";

grant references on table "public"."activities" to "anon";

grant select on table "public"."activities" to "anon";

grant trigger on table "public"."activities" to "anon";

grant truncate on table "public"."activities" to "anon";

grant update on table "public"."activities" to "anon";

grant delete on table "public"."activities" to "authenticated";

grant insert on table "public"."activities" to "authenticated";

grant references on table "public"."activities" to "authenticated";

grant select on table "public"."activities" to "authenticated";

grant trigger on table "public"."activities" to "authenticated";

grant truncate on table "public"."activities" to "authenticated";

grant update on table "public"."activities" to "authenticated";

grant delete on table "public"."activities" to "service_role";

grant insert on table "public"."activities" to "service_role";

grant references on table "public"."activities" to "service_role";

grant select on table "public"."activities" to "service_role";

grant trigger on table "public"."activities" to "service_role";

grant truncate on table "public"."activities" to "service_role";

grant update on table "public"."activities" to "service_role";

grant delete on table "public"."app_config" to "anon";

grant insert on table "public"."app_config" to "anon";

grant references on table "public"."app_config" to "anon";

grant select on table "public"."app_config" to "anon";

grant trigger on table "public"."app_config" to "anon";

grant truncate on table "public"."app_config" to "anon";

grant update on table "public"."app_config" to "anon";

grant delete on table "public"."app_config" to "authenticated";

grant insert on table "public"."app_config" to "authenticated";

grant references on table "public"."app_config" to "authenticated";

grant select on table "public"."app_config" to "authenticated";

grant trigger on table "public"."app_config" to "authenticated";

grant truncate on table "public"."app_config" to "authenticated";

grant update on table "public"."app_config" to "authenticated";

grant delete on table "public"."app_config" to "service_role";

grant insert on table "public"."app_config" to "service_role";

grant references on table "public"."app_config" to "service_role";

grant select on table "public"."app_config" to "service_role";

grant trigger on table "public"."app_config" to "service_role";

grant truncate on table "public"."app_config" to "service_role";

grant update on table "public"."app_config" to "service_role";

grant delete on table "public"."bulk_outreach_jobs" to "anon";

grant insert on table "public"."bulk_outreach_jobs" to "anon";

grant references on table "public"."bulk_outreach_jobs" to "anon";

grant select on table "public"."bulk_outreach_jobs" to "anon";

grant trigger on table "public"."bulk_outreach_jobs" to "anon";

grant truncate on table "public"."bulk_outreach_jobs" to "anon";

grant update on table "public"."bulk_outreach_jobs" to "anon";

grant delete on table "public"."bulk_outreach_jobs" to "authenticated";

grant insert on table "public"."bulk_outreach_jobs" to "authenticated";

grant references on table "public"."bulk_outreach_jobs" to "authenticated";

grant select on table "public"."bulk_outreach_jobs" to "authenticated";

grant trigger on table "public"."bulk_outreach_jobs" to "authenticated";

grant truncate on table "public"."bulk_outreach_jobs" to "authenticated";

grant update on table "public"."bulk_outreach_jobs" to "authenticated";

grant delete on table "public"."bulk_outreach_jobs" to "service_role";

grant insert on table "public"."bulk_outreach_jobs" to "service_role";

grant references on table "public"."bulk_outreach_jobs" to "service_role";

grant select on table "public"."bulk_outreach_jobs" to "service_role";

grant trigger on table "public"."bulk_outreach_jobs" to "service_role";

grant truncate on table "public"."bulk_outreach_jobs" to "service_role";

grant update on table "public"."bulk_outreach_jobs" to "service_role";

grant delete on table "public"."campaigns" to "anon";

grant insert on table "public"."campaigns" to "anon";

grant references on table "public"."campaigns" to "anon";

grant select on table "public"."campaigns" to "anon";

grant trigger on table "public"."campaigns" to "anon";

grant truncate on table "public"."campaigns" to "anon";

grant update on table "public"."campaigns" to "anon";

grant delete on table "public"."campaigns" to "authenticated";

grant insert on table "public"."campaigns" to "authenticated";

grant references on table "public"."campaigns" to "authenticated";

grant select on table "public"."campaigns" to "authenticated";

grant trigger on table "public"."campaigns" to "authenticated";

grant truncate on table "public"."campaigns" to "authenticated";

grant update on table "public"."campaigns" to "authenticated";

grant delete on table "public"."campaigns" to "service_role";

grant insert on table "public"."campaigns" to "service_role";

grant references on table "public"."campaigns" to "service_role";

grant select on table "public"."campaigns" to "service_role";

grant trigger on table "public"."campaigns" to "service_role";

grant truncate on table "public"."campaigns" to "service_role";

grant update on table "public"."campaigns" to "service_role";

grant delete on table "public"."content_reviews" to "anon";

grant insert on table "public"."content_reviews" to "anon";

grant references on table "public"."content_reviews" to "anon";

grant select on table "public"."content_reviews" to "anon";

grant trigger on table "public"."content_reviews" to "anon";

grant truncate on table "public"."content_reviews" to "anon";

grant update on table "public"."content_reviews" to "anon";

grant delete on table "public"."content_reviews" to "authenticated";

grant insert on table "public"."content_reviews" to "authenticated";

grant references on table "public"."content_reviews" to "authenticated";

grant select on table "public"."content_reviews" to "authenticated";

grant trigger on table "public"."content_reviews" to "authenticated";

grant truncate on table "public"."content_reviews" to "authenticated";

grant update on table "public"."content_reviews" to "authenticated";

grant delete on table "public"."content_reviews" to "service_role";

grant insert on table "public"."content_reviews" to "service_role";

grant references on table "public"."content_reviews" to "service_role";

grant select on table "public"."content_reviews" to "service_role";

grant trigger on table "public"."content_reviews" to "service_role";

grant truncate on table "public"."content_reviews" to "service_role";

grant update on table "public"."content_reviews" to "service_role";

grant delete on table "public"."conversations" to "anon";

grant insert on table "public"."conversations" to "anon";

grant references on table "public"."conversations" to "anon";

grant select on table "public"."conversations" to "anon";

grant trigger on table "public"."conversations" to "anon";

grant truncate on table "public"."conversations" to "anon";

grant update on table "public"."conversations" to "anon";

grant delete on table "public"."conversations" to "authenticated";

grant insert on table "public"."conversations" to "authenticated";

grant references on table "public"."conversations" to "authenticated";

grant select on table "public"."conversations" to "authenticated";

grant trigger on table "public"."conversations" to "authenticated";

grant truncate on table "public"."conversations" to "authenticated";

grant update on table "public"."conversations" to "authenticated";

grant delete on table "public"."conversations" to "service_role";

grant insert on table "public"."conversations" to "service_role";

grant references on table "public"."conversations" to "service_role";

grant select on table "public"."conversations" to "service_role";

grant trigger on table "public"."conversations" to "service_role";

grant truncate on table "public"."conversations" to "service_role";

grant update on table "public"."conversations" to "service_role";

grant delete on table "public"."creator_campaign_assignments" to "anon";

grant insert on table "public"."creator_campaign_assignments" to "anon";

grant references on table "public"."creator_campaign_assignments" to "anon";

grant select on table "public"."creator_campaign_assignments" to "anon";

grant trigger on table "public"."creator_campaign_assignments" to "anon";

grant truncate on table "public"."creator_campaign_assignments" to "anon";

grant update on table "public"."creator_campaign_assignments" to "anon";

grant delete on table "public"."creator_campaign_assignments" to "authenticated";

grant insert on table "public"."creator_campaign_assignments" to "authenticated";

grant references on table "public"."creator_campaign_assignments" to "authenticated";

grant select on table "public"."creator_campaign_assignments" to "authenticated";

grant trigger on table "public"."creator_campaign_assignments" to "authenticated";

grant truncate on table "public"."creator_campaign_assignments" to "authenticated";

grant update on table "public"."creator_campaign_assignments" to "authenticated";

grant delete on table "public"."creator_campaign_assignments" to "service_role";

grant insert on table "public"."creator_campaign_assignments" to "service_role";

grant references on table "public"."creator_campaign_assignments" to "service_role";

grant select on table "public"."creator_campaign_assignments" to "service_role";

grant trigger on table "public"."creator_campaign_assignments" to "service_role";

grant truncate on table "public"."creator_campaign_assignments" to "service_role";

grant update on table "public"."creator_campaign_assignments" to "service_role";

grant delete on table "public"."creators" to "anon";

grant insert on table "public"."creators" to "anon";

grant references on table "public"."creators" to "anon";

grant select on table "public"."creators" to "anon";

grant trigger on table "public"."creators" to "anon";

grant truncate on table "public"."creators" to "anon";

grant update on table "public"."creators" to "anon";

grant delete on table "public"."creators" to "authenticated";

grant insert on table "public"."creators" to "authenticated";

grant references on table "public"."creators" to "authenticated";

grant select on table "public"."creators" to "authenticated";

grant trigger on table "public"."creators" to "authenticated";

grant truncate on table "public"."creators" to "authenticated";

grant update on table "public"."creators" to "authenticated";

grant delete on table "public"."creators" to "service_role";

grant insert on table "public"."creators" to "service_role";

grant references on table "public"."creators" to "service_role";

grant select on table "public"."creators" to "service_role";

grant trigger on table "public"."creators" to "service_role";

grant truncate on table "public"."creators" to "service_role";

grant update on table "public"."creators" to "service_role";

grant delete on table "public"."notifications" to "anon";

grant insert on table "public"."notifications" to "anon";

grant references on table "public"."notifications" to "anon";

grant select on table "public"."notifications" to "anon";

grant trigger on table "public"."notifications" to "anon";

grant truncate on table "public"."notifications" to "anon";

grant update on table "public"."notifications" to "anon";

grant delete on table "public"."notifications" to "authenticated";

grant insert on table "public"."notifications" to "authenticated";

grant references on table "public"."notifications" to "authenticated";

grant select on table "public"."notifications" to "authenticated";

grant trigger on table "public"."notifications" to "authenticated";

grant truncate on table "public"."notifications" to "authenticated";

grant update on table "public"."notifications" to "authenticated";

grant delete on table "public"."notifications" to "service_role";

grant insert on table "public"."notifications" to "service_role";

grant references on table "public"."notifications" to "service_role";

grant select on table "public"."notifications" to "service_role";

grant trigger on table "public"."notifications" to "service_role";

grant truncate on table "public"."notifications" to "service_role";

grant update on table "public"."notifications" to "service_role";

grant delete on table "public"."outreach_emails" to "anon";

grant insert on table "public"."outreach_emails" to "anon";

grant references on table "public"."outreach_emails" to "anon";

grant select on table "public"."outreach_emails" to "anon";

grant trigger on table "public"."outreach_emails" to "anon";

grant truncate on table "public"."outreach_emails" to "anon";

grant update on table "public"."outreach_emails" to "anon";

grant delete on table "public"."outreach_emails" to "authenticated";

grant insert on table "public"."outreach_emails" to "authenticated";

grant references on table "public"."outreach_emails" to "authenticated";

grant select on table "public"."outreach_emails" to "authenticated";

grant trigger on table "public"."outreach_emails" to "authenticated";

grant truncate on table "public"."outreach_emails" to "authenticated";

grant update on table "public"."outreach_emails" to "authenticated";

grant delete on table "public"."outreach_emails" to "service_role";

grant insert on table "public"."outreach_emails" to "service_role";

grant references on table "public"."outreach_emails" to "service_role";

grant select on table "public"."outreach_emails" to "service_role";

grant trigger on table "public"."outreach_emails" to "service_role";

grant truncate on table "public"."outreach_emails" to "service_role";

grant update on table "public"."outreach_emails" to "service_role";

grant delete on table "public"."posted_videos" to "anon";

grant insert on table "public"."posted_videos" to "anon";

grant references on table "public"."posted_videos" to "anon";

grant select on table "public"."posted_videos" to "anon";

grant trigger on table "public"."posted_videos" to "anon";

grant truncate on table "public"."posted_videos" to "anon";

grant update on table "public"."posted_videos" to "anon";

grant delete on table "public"."posted_videos" to "authenticated";

grant insert on table "public"."posted_videos" to "authenticated";

grant references on table "public"."posted_videos" to "authenticated";

grant select on table "public"."posted_videos" to "authenticated";

grant trigger on table "public"."posted_videos" to "authenticated";

grant truncate on table "public"."posted_videos" to "authenticated";

grant update on table "public"."posted_videos" to "authenticated";

grant delete on table "public"."posted_videos" to "service_role";

grant insert on table "public"."posted_videos" to "service_role";

grant references on table "public"."posted_videos" to "service_role";

grant select on table "public"."posted_videos" to "service_role";

grant trigger on table "public"."posted_videos" to "service_role";

grant truncate on table "public"."posted_videos" to "service_role";

grant update on table "public"."posted_videos" to "service_role";

grant delete on table "public"."settings" to "anon";

grant insert on table "public"."settings" to "anon";

grant references on table "public"."settings" to "anon";

grant select on table "public"."settings" to "anon";

grant trigger on table "public"."settings" to "anon";

grant truncate on table "public"."settings" to "anon";

grant update on table "public"."settings" to "anon";

grant delete on table "public"."settings" to "authenticated";

grant insert on table "public"."settings" to "authenticated";

grant references on table "public"."settings" to "authenticated";

grant select on table "public"."settings" to "authenticated";

grant trigger on table "public"."settings" to "authenticated";

grant truncate on table "public"."settings" to "authenticated";

grant update on table "public"."settings" to "authenticated";

grant delete on table "public"."settings" to "service_role";

grant insert on table "public"."settings" to "service_role";

grant references on table "public"."settings" to "service_role";

grant select on table "public"."settings" to "service_role";

grant trigger on table "public"."settings" to "service_role";

grant truncate on table "public"."settings" to "service_role";

grant update on table "public"."settings" to "service_role";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant references on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant trigger on table "public"."tasks" to "anon";

grant truncate on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";

grant delete on table "public"."tasks" to "authenticated";

grant insert on table "public"."tasks" to "authenticated";

grant references on table "public"."tasks" to "authenticated";

grant select on table "public"."tasks" to "authenticated";

grant trigger on table "public"."tasks" to "authenticated";

grant truncate on table "public"."tasks" to "authenticated";

grant update on table "public"."tasks" to "authenticated";

grant delete on table "public"."tasks" to "service_role";

grant insert on table "public"."tasks" to "service_role";

grant references on table "public"."tasks" to "service_role";

grant select on table "public"."tasks" to "service_role";

grant trigger on table "public"."tasks" to "service_role";

grant truncate on table "public"."tasks" to "service_role";

grant update on table "public"."tasks" to "service_role";

grant delete on table "public"."unmatched_inbound_emails" to "anon";

grant insert on table "public"."unmatched_inbound_emails" to "anon";

grant references on table "public"."unmatched_inbound_emails" to "anon";

grant select on table "public"."unmatched_inbound_emails" to "anon";

grant trigger on table "public"."unmatched_inbound_emails" to "anon";

grant truncate on table "public"."unmatched_inbound_emails" to "anon";

grant update on table "public"."unmatched_inbound_emails" to "anon";

grant delete on table "public"."unmatched_inbound_emails" to "authenticated";

grant insert on table "public"."unmatched_inbound_emails" to "authenticated";

grant references on table "public"."unmatched_inbound_emails" to "authenticated";

grant select on table "public"."unmatched_inbound_emails" to "authenticated";

grant trigger on table "public"."unmatched_inbound_emails" to "authenticated";

grant truncate on table "public"."unmatched_inbound_emails" to "authenticated";

grant update on table "public"."unmatched_inbound_emails" to "authenticated";

grant delete on table "public"."unmatched_inbound_emails" to "service_role";

grant insert on table "public"."unmatched_inbound_emails" to "service_role";

grant references on table "public"."unmatched_inbound_emails" to "service_role";

grant select on table "public"."unmatched_inbound_emails" to "service_role";

grant trigger on table "public"."unmatched_inbound_emails" to "service_role";

grant truncate on table "public"."unmatched_inbound_emails" to "service_role";

grant update on table "public"."unmatched_inbound_emails" to "service_role";

grant delete on table "public"."workspaces" to "anon";

grant insert on table "public"."workspaces" to "anon";

grant references on table "public"."workspaces" to "anon";

grant select on table "public"."workspaces" to "anon";

grant trigger on table "public"."workspaces" to "anon";

grant truncate on table "public"."workspaces" to "anon";

grant update on table "public"."workspaces" to "anon";

grant delete on table "public"."workspaces" to "authenticated";

grant insert on table "public"."workspaces" to "authenticated";

grant references on table "public"."workspaces" to "authenticated";

grant select on table "public"."workspaces" to "authenticated";

grant trigger on table "public"."workspaces" to "authenticated";

grant truncate on table "public"."workspaces" to "authenticated";

grant update on table "public"."workspaces" to "authenticated";

grant delete on table "public"."workspaces" to "service_role";

grant insert on table "public"."workspaces" to "service_role";

grant references on table "public"."workspaces" to "service_role";

grant select on table "public"."workspaces" to "service_role";

grant trigger on table "public"."workspaces" to "service_role";

grant truncate on table "public"."workspaces" to "service_role";

grant update on table "public"."workspaces" to "service_role";


