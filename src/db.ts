import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Workspace,
  Creator,
  Campaign,
  OutreachEmail,
  Conversation,
  ContentReview,
  Task,
  NotificationItem,
  ActivityItem,
  DashboardKPIs,
  UnmatchedInboundEmail,
  CreatorCampaignAssignment,
  BulkOutreachJob,
  PostedVideo,
} from './types';
import { computeGmvTier } from './lib/gmvTier';

let instance: SupabaseClient | null = null;

export function getDb(): SupabaseClient {
  if (instance) return instance;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }

  instance = createClient(url, key, { auth: { persistSession: false } });
  return instance;
}

export async function isDbConnected(): Promise<boolean> {
  try {
    const db = getDb();
    const { error } = await db.from('workspaces').select('id', { count: 'exact', head: true });
    return !error;
  } catch {
    return false;
  }
}

function check<T>(res: { data: T; error: any }): T {
  if (res.error) throw res.error;
  return res.data;
}

// parseJson tolerates both a JSON string (legacy/manual writes) and a native
// object/array (the normal case for jsonb columns coming back from Supabase).
function parseJson<T>(val: any, fallback: T): T {
  if (val === null || val === undefined || val === '') return fallback;
  if (typeof val !== 'string') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

// Data Mappers

export function rowToWorkspace(row: any): Workspace {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    brandName: row.brandName,
    category: row.category,
    logoUrl: row.logoUrl || undefined,
    color: row.color,
    description: row.description,
    isAgency: row.isAgency != null ? Boolean(row.isAgency) : undefined,
    memberCount: row.memberCount != null ? Number(row.memberCount) : undefined,
    creatorCount: row.creatorCount != null ? Number(row.creatorCount) : undefined,
    activeCampaignCount: row.activeCampaignCount != null ? Number(row.activeCampaignCount) : undefined,
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
    scoringCriteria: row.scoringCriteria || undefined,
  };
}

export function rowToCreator(row: any): Creator {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    source: row.source || undefined,
    handle: row.handle,
    displayName: row.displayName,
    avatar: row.avatar || undefined,
    platform: row.platform || 'TikTok',
    country: row.country || undefined,
    language: row.language || undefined,
    bio: row.bio || '',
    profileUrl: row.profileUrl,
    followers: row.followers != null ? Number(row.followers) : undefined,
    avgViews: row.avgViews != null ? Number(row.avgViews) : undefined,
    engagementRate: row.engagementRate != null ? Number(row.engagementRate) : undefined,
    gmv30d: row.gmv30d != null ? Number(row.gmv30d) : undefined,
    category: row.category || undefined,
    niche: parseJson(row.niche, undefined),
    status: row.status,
    owner: row.owner,
    email: row.email || undefined,
    phone: row.phone || undefined,
    instagram: row.instagram || undefined,
    rateCard: row.rateCard || undefined,
    lastContactAt: row.lastContactAt || undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || undefined,
    notes: parseJson(row.notes, []),
    tags: parseJson(row.tags, []),
    followerGrowthRate: row.followerGrowthRate || undefined,
    postingFrequency30d: row.postingFrequency30d != null ? Number(row.postingFrequency30d) : undefined,
    maxMinRatio: row.maxMinRatio || undefined,
    lastVideoDate: row.lastVideoDate || undefined,
    erFollower: row.erFollower != null ? Number(row.erFollower) : undefined,
    medianViews: row.medianViews || undefined,
    recentVideos: parseJson(row.recentVideos, undefined),
    demographics: parseJson(row.demographics, undefined),
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
    gmvTier: row.gmvTier || undefined,
    gpm: row.gpm != null ? Number(row.gpm) : undefined,
    beautyCategoryRatio: row.beautyCategoryRatio != null ? Number(row.beautyCategoryRatio) : undefined,
    hasAffiliateGmv: row.hasAffiliateGmv != null ? Boolean(row.hasAffiliateGmv) : undefined,
    metricsSource: row.metricsSource || undefined,
    metricsSyncedAt: row.metricsSyncedAt || undefined,
    importedAt: row.importedAt || undefined,
    tcmCreatorOecuid: row.tcmCreatorOecuid || undefined,
    tcmNotFoundAt: row.tcmNotFoundAt || undefined,
    salesMetrics: parseJson(row.salesMetrics, undefined),
    collabMetrics: parseJson(row.collabMetrics, undefined),
    videoMetrics: parseJson(row.videoMetrics, undefined),
    liveMetrics: parseJson(row.liveMetrics, undefined),
  };
}

export function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    name: row.name,
    brand: row.brand,
    objective: row.objective,
    description: row.description || '',
    budget: Number(row.budget) || 0,
    spent: Number(row.spent) || 0,
    currency: row.currency || 'USD',
    status: row.status,
    startDate: row.startDate,
    endDate: row.endDate,
    owner: row.owner,
    creatorIds: parseJson(row.creatorIds, []),
    targetCategories: parseJson(row.targetCategories, []),
    targetAudience: parseJson(row.targetAudience, undefined),
    products: parseJson(row.products, []),
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
  };
}

export function rowToOutreach(row: any): OutreachEmail {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    creatorHandle: row.creatorHandle,
    campaignId: row.campaignId || undefined,
    campaignName: row.campaignName || undefined,
    subject: row.subject,
    body: row.body ?? '',
    status: row.status,
    sentAt: row.sentAt || undefined,
    repliedAt: row.repliedAt || undefined,
    followUpCount: Number(row.followUpCount) || 0,
    sequenceStage: row.sequenceStage || undefined,
    messageId: row.messageId || undefined,
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
  };
}

export function rowToBulkOutreachJob(row: any): BulkOutreachJob {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    campaignId: row.campaignId || undefined,
    campaignName: row.campaignName || undefined,
    sequenceStage: row.sequenceStage,
    contentSource: row.contentSource === 'template' ? 'template' : 'ai',
    cc: row.cc || undefined,
    status: row.status,
    pacingMinSeconds: Number(row.pacingMinSeconds) || 45,
    pacingMaxSeconds: Number(row.pacingMaxSeconds) || 120,
    dailyCap: Number(row.dailyCap) || 80,
    createdAt: row.createdAt,
    items: parseJson(row.items, []),
    nextSendAt: row.nextSendAt || undefined,
    sendLockUntil: row.sendLockUntil || undefined,
  };
}

export function rowToConversation(row: any): Conversation {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    creatorHandle: row.creatorHandle,
    creatorAvatar: row.creatorAvatar || '',
    campaignId: row.campaignId || undefined,
    campaignName: row.campaignName || undefined,
    status: row.status,
    lastMessageAt: row.lastMessageAt,
    messages: parseJson(row.messages, []),
    unread: Boolean(row.unread),
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
    lastMessagePreview: row.lastMessagePreview || undefined,
    lastMessageSenderType: row.lastMessageSenderType || undefined,
  };
}

export function rowToReview(row: any): ContentReview {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    creatorHandle: row.creatorHandle,
    creatorAvatar: row.creatorAvatar || '',
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    videoTitle: row.videoTitle,
    draftUrl: row.draftUrl,
    thumbnailUrl: row.thumbnailUrl || undefined,
    videoThumbnail: row.videoThumbnail || undefined,
    durationSeconds: row.durationSeconds != null ? Number(row.durationSeconds) : undefined,
    status: row.status,
    dueAt: row.dueAt,
    submittedAt: row.submittedAt,
    checklist: parseJson(row.checklist, undefined),
    feedbackNote: row.feedbackNote || undefined,
    feedback: row.feedback || undefined,
    aiAnalysis: row.aiAnalysis || undefined,
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
  };
}

export function rowToTask(row: any): Task {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    title: row.title,
    description: row.description || '',
    priority: row.priority,
    status: row.status,
    dueDate: row.dueDate,
    owner: row.owner,
    assignedTo: row.assignedTo || undefined,
    relatedCreatorId: row.relatedCreatorId || undefined,
    relatedCreatorName: row.relatedCreatorName || undefined,
    relatedCampaignId: row.relatedCampaignId || undefined,
    relatedCampaignName: row.relatedCampaignName || undefined,
    createdAt: row.createdAt,
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
  };
}

export function rowToNotification(row: any): NotificationItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    title: row.title,
    description: row.description,
    priority: row.priority,
    category: row.category,
    isRead: Boolean(row.isRead),
    createdAt: row.createdAt,
    link: row.link || undefined,
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
  };
}

export function rowToActivity(row: any): ActivityItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    actor: row.actor,
    action: row.action,
    target: row.target,
    entityType: row.entityType,
    entityId: row.entityId,
    timestamp: row.timestamp,
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
  };
}

export function rowToAssignment(row: any): CreatorCampaignAssignment {
  return {
    id: row.id,
    creatorId: row.creatorId,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    workspaceId: row.workspaceId || undefined,
    status: row.status,
    assignedAt: row.assignedAt,
    ratePaid: row.ratePaid != null ? Number(row.ratePaid) : undefined,
    notes: row.notes || undefined,
    gmvTier: row.gmvTier || undefined,
    qualification: row.qualification || undefined,
    originalPrice: row.originalPrice != null ? Number(row.originalPrice) : undefined,
    negotiatedPrice: row.negotiatedPrice != null ? Number(row.negotiatedPrice) : undefined,
    pricePerVideo: row.pricePerVideo != null ? Number(row.pricePerVideo) : undefined,
    commissionPercent: row.commissionPercent != null ? Number(row.commissionPercent) : undefined,
    contractedVideoCount: row.contractedVideoCount != null ? Number(row.contractedVideoCount) : undefined,
    contractUrl: row.contractUrl || undefined,
    castingStage: row.castingStage || undefined,
  };
}

export function rowToPostedVideo(row: any): PostedVideo {
  return {
    id: row.id,
    workspaceId: row.workspaceId || undefined,
    reviewId: row.reviewId || undefined,
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    creatorHandle: row.creatorHandle,
    campaignId: row.campaignId,
    campaignName: row.campaignName,
    round: row.round || undefined,
    pricePerVideo: row.pricePerVideo != null ? Number(row.pricePerVideo) : undefined,
    paid: row.paid != null ? Boolean(row.paid) : undefined,
    postedAt: row.postedAt,
    videoUrl: row.videoUrl,
    videoId: row.videoId || undefined,
    adCode: row.adCode || undefined,
    roi: row.roi != null ? Number(row.roi) : undefined,
    totalRevenue: row.totalRevenue != null ? Number(row.totalRevenue) : undefined,
    totalOrders: row.totalOrders != null ? Number(row.totalOrders) : undefined,
    totalAdSpend: row.totalAdSpend != null ? Number(row.totalAdSpend) : undefined,
    isMock: row.isMock != null ? Boolean(row.isMock) : undefined,
  };
}

export function rowToUnmatchedInboundEmail(row: any): UnmatchedInboundEmail {
  return {
    id: row.id,
    senderEmail: row.senderEmail,
    senderName: row.senderName || undefined,
    subject: row.subject,
    content: row.content,
    receivedAt: row.receivedAt,
    candidateCreatorIds: parseJson(row.candidateCreatorIds, []),
    resolved: Boolean(row.resolved),
    messageId: row.messageId || undefined,
  };
}

// Save / Update Operations — Postgres upsert via the table's primary key (default 'id').

export async function saveWorkspace(w: Workspace): Promise<void> {
  const db = getDb();
  check(await db.from('workspaces').upsert({
    id: w.id,
    name: w.name,
    code: w.code,
    brandName: w.brandName,
    category: w.category,
    logoUrl: w.logoUrl ?? null,
    color: w.color,
    description: w.description,
    isAgency: !!w.isAgency,
    memberCount: w.memberCount ?? 0,
    creatorCount: w.creatorCount ?? 0,
    activeCampaignCount: w.activeCampaignCount ?? 0,
    isMock: !!w.isMock,
    scoringCriteria: w.scoringCriteria ?? null,
    created_at_ts: Date.now(),
  }));
}

export async function saveCreator(c: Creator): Promise<void> {
  const db = getDb();
  const gmvTier = computeGmvTier(c.gmv30d) ?? c.gmvTier;
  check(await db.from('creators').upsert({
    id: c.id,
    workspaceId: c.workspaceId ?? null,
    source: c.source ?? null,
    handle: c.handle,
    displayName: c.displayName,
    avatar: c.avatar ?? null,
    platform: c.platform ?? 'TikTok',
    country: c.country ?? null,
    language: c.language ?? null,
    bio: c.bio ?? '',
    profileUrl: c.profileUrl,
    followers: c.followers ?? null,
    avgViews: c.avgViews ?? null,
    engagementRate: c.engagementRate ?? null,
    gmv30d: c.gmv30d ?? null,
    category: c.category ?? null,
    niche: c.niche ?? null,
    status: c.status,
    owner: c.owner,
    email: c.email ?? null,
    phone: c.phone ?? null,
    instagram: c.instagram ?? null,
    rateCard: c.rateCard ?? null,
    lastContactAt: c.lastContactAt ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt ?? null,
    notes: c.notes ?? null,
    tags: c.tags ?? null,
    followerGrowthRate: c.followerGrowthRate ?? null,
    postingFrequency30d: c.postingFrequency30d ?? null,
    maxMinRatio: c.maxMinRatio ? String(c.maxMinRatio) : null,
    lastVideoDate: c.lastVideoDate ?? null,
    erFollower: c.erFollower ?? null,
    medianViews: c.medianViews ? String(c.medianViews) : null,
    recentVideos: c.recentVideos ?? null,
    demographics: c.demographics ?? null,
    isMock: !!c.isMock,
    gmvTier: gmvTier ?? null,
    gpm: c.gpm ?? null,
    beautyCategoryRatio: c.beautyCategoryRatio ?? null,
    hasAffiliateGmv: c.hasAffiliateGmv ?? null,
    metricsSource: c.metricsSource ?? null,
    metricsSyncedAt: c.metricsSyncedAt ?? null,
    importedAt: c.importedAt ?? null,
    tcmCreatorOecuid: c.tcmCreatorOecuid ?? null,
    tcmNotFoundAt: c.tcmNotFoundAt ?? null,
    salesMetrics: c.salesMetrics ?? null,
    collabMetrics: c.collabMetrics ?? null,
    videoMetrics: c.videoMetrics ?? null,
    liveMetrics: c.liveMetrics ?? null,
    created_at_ts: c.createdAt ? new Date(c.createdAt).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveCampaign(c: Campaign): Promise<void> {
  const db = getDb();
  check(await db.from('campaigns').upsert({
    id: c.id,
    workspaceId: c.workspaceId ?? null,
    name: c.name,
    brand: c.brand,
    objective: c.objective,
    description: c.description ?? '',
    budget: c.budget ?? 0,
    spent: c.spent ?? 0,
    currency: c.currency ?? 'USD',
    status: c.status,
    startDate: c.startDate,
    endDate: c.endDate,
    owner: c.owner,
    creatorIds: c.creatorIds ?? null,
    targetCategories: c.targetCategories ?? null,
    targetAudience: c.targetAudience ?? null,
    products: c.products ?? null,
    isMock: !!c.isMock,
    created_at_ts: c.startDate ? new Date(c.startDate).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveOutreach(o: OutreachEmail): Promise<void> {
  const db = getDb();
  check(await db.from('outreach_emails').upsert({
    id: o.id,
    workspaceId: o.workspaceId ?? null,
    creatorId: o.creatorId,
    creatorName: o.creatorName,
    creatorHandle: o.creatorHandle,
    campaignId: o.campaignId ?? null,
    campaignName: o.campaignName ?? null,
    subject: o.subject,
    body: o.body,
    status: o.status,
    sentAt: o.sentAt ?? null,
    repliedAt: o.repliedAt ?? null,
    followUpCount: o.followUpCount ?? 0,
    sequenceStage: o.sequenceStage ?? 'first',
    messageId: o.messageId ?? null,
    isMock: !!o.isMock,
    created_at_ts: o.sentAt ? new Date(o.sentAt).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveBulkOutreachJob(job: BulkOutreachJob): Promise<void> {
  const db = getDb();
  check(await db.from('bulk_outreach_jobs').upsert({
    id: job.id,
    workspaceId: job.workspaceId ?? null,
    campaignId: job.campaignId ?? null,
    campaignName: job.campaignName ?? null,
    sequenceStage: job.sequenceStage,
    contentSource: job.contentSource,
    cc: job.cc ?? null,
    status: job.status,
    pacingMinSeconds: job.pacingMinSeconds,
    pacingMaxSeconds: job.pacingMaxSeconds,
    dailyCap: job.dailyCap,
    createdAt: job.createdAt,
    items: job.items ?? null,
    nextSendAt: job.nextSendAt ?? null,
    sendLockUntil: job.sendLockUntil ?? null,
    created_at_ts: new Date(job.createdAt).getTime() || Date.now(),
  }));
}

export async function getBulkOutreachJobById(id: string): Promise<BulkOutreachJob | null> {
  const db = getDb();
  const { data, error } = await db.from('bulk_outreach_jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToBulkOutreachJob(data) : null;
}

export async function getSendingBulkOutreachJobs(): Promise<BulkOutreachJob[]> {
  const db = getDb();
  const { data, error } = await db.from('bulk_outreach_jobs').select('*').eq('status', 'sending');
  if (error) throw error;
  return (data || []).map(rowToBulkOutreachJob);
}

// Claims the short-lived send lock on a job so only one caller (QStash callback, local
// setTimeout fallback, or the resume-on-poll check) advances it at a time. Optimistic
// concurrency: the update only takes effect if sendLockUntil in the DB still matches what
// the caller last read, so a concurrent claim attempt naturally loses instead of racing.
// Returns the new lock timestamp on success, or null if someone else holds/just claimed it.
export async function tryClaimBulkOutreachSendLock(job: BulkOutreachJob): Promise<string | null> {
  const db = getDb();
  const now = Date.now();
  if (job.sendLockUntil && Date.parse(job.sendLockUntil) > now) return null;
  // 4 minutes: deliverOutreachEmail does a live SMTP send (no connection pooling) plus
  // several sequential DB round trips, and has been observed in production legitimately
  // taking up to ~90s — a 90s lock let it look "expired" to a second caller while the first
  // was still working, which then saw no 'draft' items left and wrongly flipped the job to
  // 'done' while that item was still in flight (see the 'sending' check in
  // sendNextBulkOutreachItem). This stays comfortably above the observed range.
  const newLock = new Date(now + 4 * 60 * 1000).toISOString();
  let query = db.from('bulk_outreach_jobs').update({ sendLockUntil: newLock }).eq('id', job.id).eq('status', 'sending');
  query = job.sendLockUntil ? query.eq('sendLockUntil', job.sendLockUntil) : query.is('sendLockUntil', null);
  const { data, error } = await query.select('id');
  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? newLock : null;
}

export async function saveConversation(c: Conversation): Promise<void> {
  const db = getDb();
  // lastMessagePreview/lastMessageSenderType duy trì 1 bản sao gọn của message cuối — cho phép
  // getConversationsForList() bỏ hẳn cột `messages` (toàn bộ nội dung thread) khi chỉ cần hiển
  // thị preview 1 dòng, xem migration supabase/migrations/20260812072225_conversations_last_message_preview.sql.
  const lastMsg = c.messages && c.messages.length > 0 ? c.messages[c.messages.length - 1] : undefined;
  check(await db.from('conversations').upsert({
    id: c.id,
    workspaceId: c.workspaceId ?? null,
    creatorId: c.creatorId,
    creatorName: c.creatorName,
    creatorHandle: c.creatorHandle,
    creatorAvatar: c.creatorAvatar ?? '',
    campaignId: c.campaignId ?? null,
    campaignName: c.campaignName ?? null,
    status: c.status,
    lastMessageAt: c.lastMessageAt,
    messages: c.messages ?? null,
    lastMessagePreview: lastMsg?.content ?? null,
    lastMessageSenderType: lastMsg?.senderType ?? null,
    unread: !!c.unread,
    isMock: !!c.isMock,
    created_at_ts: c.lastMessageAt ? new Date(c.lastMessageAt).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveReview(r: ContentReview): Promise<void> {
  const db = getDb();
  check(await db.from('content_reviews').upsert({
    id: r.id,
    workspaceId: r.workspaceId ?? null,
    creatorId: r.creatorId,
    creatorName: r.creatorName,
    creatorHandle: r.creatorHandle,
    creatorAvatar: r.creatorAvatar ?? '',
    campaignId: r.campaignId,
    campaignName: r.campaignName,
    videoTitle: r.videoTitle,
    draftUrl: r.draftUrl,
    thumbnailUrl: r.thumbnailUrl ?? null,
    videoThumbnail: r.videoThumbnail ?? null,
    durationSeconds: r.durationSeconds ?? null,
    status: r.status,
    dueAt: r.dueAt,
    submittedAt: r.submittedAt,
    checklist: r.checklist ?? null,
    feedbackNote: r.feedbackNote ?? null,
    feedback: r.feedback ?? null,
    aiAnalysis: r.aiAnalysis ?? null,
    isMock: !!r.isMock,
    created_at_ts: r.submittedAt ? new Date(r.submittedAt).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveTask(t: Task): Promise<void> {
  const db = getDb();
  check(await db.from('tasks').upsert({
    id: t.id,
    workspaceId: t.workspaceId ?? null,
    title: t.title,
    description: t.description ?? '',
    priority: t.priority,
    status: t.status,
    dueDate: t.dueDate,
    owner: t.owner,
    assignedTo: t.assignedTo ?? null,
    relatedCreatorId: t.relatedCreatorId ?? null,
    relatedCreatorName: t.relatedCreatorName ?? null,
    relatedCampaignId: t.relatedCampaignId ?? null,
    relatedCampaignName: t.relatedCampaignName ?? null,
    createdAt: t.createdAt,
    isMock: !!t.isMock,
    created_at_ts: t.createdAt ? new Date(t.createdAt).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveNotification(n: NotificationItem): Promise<void> {
  const db = getDb();
  check(await db.from('notifications').upsert({
    id: n.id,
    workspaceId: n.workspaceId ?? null,
    title: n.title,
    description: n.description,
    priority: n.priority,
    category: n.category,
    isRead: !!n.isRead,
    createdAt: n.createdAt,
    link: n.link ?? null,
    isMock: !!n.isMock,
    created_at_ts: n.createdAt ? new Date(n.createdAt).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveActivity(a: ActivityItem): Promise<void> {
  const db = getDb();
  check(await db.from('activities').upsert({
    id: a.id,
    workspaceId: a.workspaceId ?? null,
    actor: a.actor,
    action: a.action,
    target: a.target,
    entityType: a.entityType,
    entityId: a.entityId,
    timestamp: a.timestamp,
    isMock: !!a.isMock,
    created_at_ts: a.timestamp ? new Date(a.timestamp).getTime() || Date.now() : Date.now(),
  }));
}

export async function saveAssignment(a: CreatorCampaignAssignment): Promise<void> {
  const db = getDb();
  check(await db.from('creator_campaign_assignments').upsert({
    id: a.id,
    creatorId: a.creatorId,
    campaignId: a.campaignId,
    campaignName: a.campaignName,
    workspaceId: a.workspaceId ?? null,
    status: a.status,
    assignedAt: a.assignedAt,
    ratePaid: a.ratePaid ?? null,
    notes: a.notes ?? null,
    gmvTier: a.gmvTier ?? null,
    qualification: a.qualification ?? null,
    originalPrice: a.originalPrice ?? null,
    negotiatedPrice: a.negotiatedPrice ?? null,
    pricePerVideo: a.pricePerVideo ?? null,
    commissionPercent: a.commissionPercent ?? null,
    contractedVideoCount: a.contractedVideoCount ?? null,
    contractUrl: a.contractUrl ?? null,
    castingStage: a.castingStage ?? null,
    created_at_ts: a.assignedAt ? new Date(a.assignedAt).getTime() || Date.now() : Date.now(),
  }));
}

// PostgREST mặc định chỉ trả về tối đa 1000 dòng/query — không phân trang ở đây thì khi bảng
// vượt 1000 assignment, các dòng cũ hơn (kể cả "Contact lần 1/2/3" chưa có creator/assignment
// mới đè lên) bị rớt khỏi kết quả và "biến mất" khỏi app dù dữ liệu vẫn còn nguyên trong DB.
export async function getAllAssignments(filters?: { creatorId?: string; campaignId?: string }): Promise<CreatorCampaignAssignment[]> {
  const db = getDb();
  const PAGE_SIZE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from('creator_campaign_assignments')
      .select('*')
      .order('created_at_ts', { ascending: false })
      .order('rowid', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  let list = rows.map(rowToAssignment);
  if (filters?.creatorId) list = list.filter(a => a.creatorId === filters.creatorId);
  if (filters?.campaignId) list = list.filter(a => a.campaignId === filters.campaignId);
  return list;
}

export async function getAssignmentById(id: string): Promise<CreatorCampaignAssignment | null> {
  const db = getDb();
  const { data, error } = await db.from('creator_campaign_assignments').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToAssignment(data) : null;
}

// Gán 1 creator vào 1 campaign — không ghi đè assignment khác, creator có thể có nhiều
// campaign cùng lúc. Idempotent: gọi lại với cùng cặp creator+campaign chỉ update status.
export async function assignCreatorToCampaign(
  creatorId: string,
  campaignId: string,
  status: string
): Promise<{ assignment: CreatorCampaignAssignment; campaign: Campaign } | null> {
  const campaign = await getCampaignById(campaignId);
  if (!campaign) return null;

  const existing = (await getAllAssignments({ creatorId, campaignId }))[0];
  const assignment: CreatorCampaignAssignment = existing
    ? { ...existing, status: status as CreatorCampaignAssignment['status'] }
    : {
        id: `cca-${Date.now()}`,
        creatorId,
        campaignId,
        campaignName: campaign.name,
        workspaceId: campaign.workspaceId,
        status: status as CreatorCampaignAssignment['status'],
        assignedAt: new Date().toISOString(),
      };
  await saveAssignment(assignment);

  if (!campaign.creatorIds.includes(creatorId)) {
    campaign.creatorIds = [...campaign.creatorIds, creatorId];
    await saveCampaign(campaign);
  }

  return { assignment, campaign };
}

// Gỡ creator khỏi 1 campaign — xoá assignment và bỏ creatorId khỏi campaign.creatorIds.
export async function unassignCreatorFromCampaign(assignmentId: string): Promise<Campaign | null> {
  const db = getDb();
  const assignment = await getAssignmentById(assignmentId);
  if (!assignment) return null;

  check(await db.from('creator_campaign_assignments').delete().eq('id', assignmentId));

  const campaign = await getCampaignById(assignment.campaignId);
  if (campaign && campaign.creatorIds.includes(assignment.creatorId)) {
    campaign.creatorIds = campaign.creatorIds.filter(id => id !== assignment.creatorId);
    await saveCampaign(campaign);
  }
  return campaign;
}

export async function savePostedVideo(v: PostedVideo): Promise<void> {
  const db = getDb();
  check(await db.from('posted_videos').upsert({
    id: v.id,
    workspaceId: v.workspaceId ?? null,
    reviewId: v.reviewId ?? null,
    creatorId: v.creatorId,
    creatorName: v.creatorName,
    creatorHandle: v.creatorHandle,
    campaignId: v.campaignId,
    campaignName: v.campaignName,
    round: v.round ?? null,
    pricePerVideo: v.pricePerVideo ?? null,
    paid: v.paid ?? null,
    postedAt: v.postedAt,
    videoUrl: v.videoUrl,
    videoId: v.videoId ?? null,
    adCode: v.adCode ?? null,
    roi: v.roi ?? null,
    totalRevenue: v.totalRevenue ?? null,
    totalOrders: v.totalOrders ?? null,
    totalAdSpend: v.totalAdSpend ?? null,
    isMock: !!v.isMock,
    created_at_ts: v.postedAt ? new Date(v.postedAt).getTime() || Date.now() : Date.now(),
  }));
}

export async function getAllPostedVideos(): Promise<PostedVideo[]> {
  const db = getDb();
  const { data, error } = await db
    .from('posted_videos')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToPostedVideo);
}

export async function getPostedVideoById(id: string): Promise<PostedVideo | null> {
  const db = getDb();
  const { data, error } = await db.from('posted_videos').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToPostedVideo(data) : null;
}

export async function saveUnmatchedInboundEmail(u: UnmatchedInboundEmail): Promise<void> {
  const db = getDb();
  check(await db.from('unmatched_inbound_emails').upsert({
    id: u.id,
    senderEmail: u.senderEmail,
    senderName: u.senderName ?? null,
    subject: u.subject,
    content: u.content,
    receivedAt: u.receivedAt,
    candidateCreatorIds: u.candidateCreatorIds ?? null,
    resolved: !!u.resolved,
    messageId: u.messageId ?? null,
    created_at_ts: u.receivedAt ? new Date(u.receivedAt).getTime() || Date.now() : Date.now(),
  }));
}

// Key-Value / Settings / KPIs

export async function getKpis(defaultKpis: DashboardKPIs): Promise<DashboardKPIs> {
  const db = getDb();
  const { data, error } = await db.from('settings').select('value').eq('key', 'kpis').maybeSingle();
  if (error) throw error;
  if (!data || !data.value) return defaultKpis;
  return parseJson(data.value, defaultKpis);
}

export async function setKpis(kpis: DashboardKPIs): Promise<void> {
  const db = getDb();
  check(await db.from('settings').upsert({ key: 'kpis', value: JSON.stringify(kpis) }));
}

// Generic app-config key/value store — absorbs what used to be separate local JSON
// files (email IMAP/SMTP config, AI provider config, outreach templates).
export async function getAppConfig<T>(key: string, fallback: T): Promise<T> {
  const db = getDb();
  const { data, error } = await db.from('app_config').select('value').eq('key', key).maybeSingle();
  if (error) throw error;
  if (!data || data.value == null) return fallback;
  return parseJson(data.value, fallback);
}

export async function setAppConfig(key: string, value: unknown): Promise<void> {
  const db = getDb();
  check(await db.from('app_config').upsert({ key, value: JSON.stringify(value) }));
}

export async function deleteAppConfig(key: string): Promise<void> {
  const db = getDb();
  check(await db.from('app_config').delete().eq('key', key));
}

// Agent Prompt Studio — operator-editable "how to behave" instructions per agent id,
// stored as one JSON blob under the existing settings key-value table. Falls back to each
// agent's defaultInstructions (in code) when no override has been saved.

async function getAllAgentPromptOverrides(): Promise<Record<string, string>> {
  const db = getDb();
  const { data, error } = await db.from('settings').select('value').eq('key', 'agentPromptOverrides').maybeSingle();
  if (error) throw error;
  if (!data || !data.value) return {};
  return parseJson(data.value, {});
}

export async function getAgentPromptOverride(agentId: string): Promise<string | undefined> {
  return (await getAllAgentPromptOverrides())[agentId];
}

export async function saveAgentPromptOverride(agentId: string, customInstructions: string): Promise<void> {
  const db = getDb();
  const all = await getAllAgentPromptOverrides();
  all[agentId] = customInstructions;
  check(await db.from('settings').upsert({ key: 'agentPromptOverrides', value: JSON.stringify(all) }));
}

export async function deleteAgentPromptOverride(agentId: string): Promise<void> {
  const db = getDb();
  const all = await getAllAgentPromptOverrides();
  delete all[agentId];
  check(await db.from('settings').upsert({ key: 'agentPromptOverrides', value: JSON.stringify(all) }));
}

// Getters

type CreatorListFilters = { search?: string; keyword?: string; status?: string; country?: string; category?: string };

// Chạy 1 query creators (với select cột tuỳ chỉnh + filter status/country/category/search đẩy
// xuống SQL) phân trang bằng .range(), bắn cả batch trang song song (Promise.all) ngay từ đầu
// thay vì chờ trang đầu xong mới quyết định có cần trang tiếp không — gộp N round-trip tuần tự
// thành ~1 round-trip. PostgREST mặc định trả tối đa 1000 dòng/query dù không có .limit(), nên
// bắt buộc phải phân trang để lấy hết bảng (đã vượt mốc 1000 dòng sau các đợt import Kalodata).
async function queryAllCreatorRows(selectColumns: string, filters?: CreatorListFilters): Promise<{ rows: any[]; q: string }> {
  const db = getDb();
  const PAGE_SIZE = 1000;

  const { search, keyword, status, country, category } = filters ?? {};
  const q = (search || keyword || '').toLowerCase().trim();

  // status/country/category đẩy xuống SQL (.eq) để Postgres lọc trước khi trả về, thay vì kéo
  // hết bảng rồi lọc ở JS — giảm số dòng/băng thông đúng bằng độ chọn lọc của filter đó.
  const buildQuery = (from: number) => {
    let query = db.from('creators').select(selectColumns);
    if (status && status !== 'ALL') query = query.eq('status', status);
    if (country && country !== 'ALL') query = query.eq('country', country);
    if (category && category !== 'ALL') query = query.eq('category', category);
    // Search dàn trải nhiều cột (handle/displayName/email) qua ilike OR — niche (jsonb) không
    // đẩy xuống được bằng ilike thường nên vẫn lọc riêng ở JS bên dưới cho phần đó.
    if (q) {
      const escaped = q.replace(/[%_]/g, m => `\\${m}`);
      query = query.or(`handle.ilike.%${escaped}%,displayName.ilike.%${escaped}%,email.ilike.%${escaped}%,category.ilike.%${escaped}%`);
    }
    return query
      .order('created_at_ts', { ascending: false })
      .order('rowid', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
  };

  // Bắn cả loạt trang cùng lúc (Promise.all) thay vì chờ trang đầu xong mới biết có cần trang
  // tiếp hay không — mỗi round-trip tới Supabase tốn ~1s do độ trễ mạng bất kể query nhẹ hay
  // nặng (đã benchmark), nên gộp N round-trip *tuần tự* thành 1 round-trip *song song* mới thực
  // sự nhanh hơn. Bắt đầu với 1 batch 4 trang (~4000 dòng, dư so với quy mô bảng hiện tại); nếu
  // trang cuối batch vẫn đầy (còn dữ liệu chưa lấy hết) thì bắn tiếp batch kế, tối đa 50 trang.
  const BATCH_SIZE = 4;
  const rows: any[] = [];
  let nextFrom = 0;
  let done = false;
  while (!done && nextFrom < PAGE_SIZE * 49) {
    const batchStarts: number[] = [];
    for (let i = 0; i < BATCH_SIZE; i++) batchStarts.push(nextFrom + i * PAGE_SIZE);
    const results = await Promise.all(batchStarts.map(from => buildQuery(from)));
    for (const { data, error } of results) {
      if (error) throw error;
      if (data) rows.push(...data);
      if (!data || data.length < PAGE_SIZE) { done = true; break; }
    }
    nextFrom += BATCH_SIZE * PAGE_SIZE;
  }

  return { rows, q };
}

// niche (jsonb array) không lọc được bằng ilike ở SQL nên vẫn cần match ở JS — nhưng chỉ trên
// tập đã được SQL lọc trước theo status/country/category/handle/displayName/email/category.
function filterCreatorsByNicheSearch(list: Creator[], q: string): Creator[] {
  if (!q) return list;
  return list.filter(
    c =>
      c.displayName.toLowerCase().includes(q) ||
      c.handle.toLowerCase().includes(q) ||
      (c.category || '').toLowerCase().includes(q) ||
      (c.niche || []).some((n: string) => n.toLowerCase().includes(q)) ||
      (c.email || '').toLowerCase().includes(q)
  );
}

export async function getAllCreators(filters?: CreatorListFilters): Promise<Creator[]> {
  const { rows, q } = await queryAllCreatorRows('*', filters);
  return filterCreatorsByNicheSearch(rows.map(rowToCreator), q);
}

// Select trơn hơn cho trang danh sách CRM (/api/creators, App.tsx global `creators` state) —
// bỏ các cột JSONB nặng chỉ dùng ở CreatorDetailDrawer (notes/tags/recentVideos/demographics/
// salesMetrics/videoMetrics/liveMetrics), vốn được fetch riêng qua getCreatorById khi operator
// mở chi tiết 1 creator (xem CreatorDetailDrawer + App.tsx).
// Giữ lại niche (dùng cho search + cột Category trong bảng), collabMetrics (cờ hiện badge "đã
// cào chi tiết TCM" ở CreatorListView — field này CHỈ được normalizeTcmProfileDetail() set, KHÔNG
// bao giờ được set bởi flow list/handle-search dùng normalizeCreator(), nên là cờ đáng tin cậy
// hơn tcmCreatorOecuid/metricsSyncedAt vốn cũng bị set bởi flow "tìm cid" — xem extension/shared.js)
// vì list-level UI đọc thẳng field này mà không fetch lại — xem báo cáo audit trước khi trim.
// Đã rà lại (2026-08-13) từng field so với usage thật của CreatorListView.tsx + mọi view khác
// dùng chung state creators (OutreachView/CampaignsView/ExportView/InboxView/DashboardView) —
// bỏ 17 field không được list-level UI nào đọc tới (source/platform/language/bio/phone/
// instagram/rateCard/createdAt/updatedAt/followerGrowthRate/postingFrequency30d/maxMinRatio/
// lastVideoDate/erFollower/medianViews/gpm/hasAffiliateGmv/isMock — toàn bộ chỉ cần khi mở
// CreatorDetailDrawer, nơi đã fetch lại full row qua getCreatorById() rồi). Field nào còn giữ
// lại đều có usage thật (render/filter/sort/tooltip) đã grep xác nhận, xem báo cáo audit.
const CREATOR_LIST_COLUMNS = [
  'id', '"workspaceId"', 'handle', '"displayName"', 'avatar', 'country',
  '"profileUrl"', 'followers', '"avgViews"', '"engagementRate"', 'gmv30d', 'category', 'niche',
  'status', 'owner', 'email',
  '"lastContactAt"',
  '"gmvTier"', '"beautyCategoryRatio"', '"metricsSource"', '"metricsSyncedAt"',
  '"importedAt"', '"tcmCreatorOecuid"', '"tcmNotFoundAt"', '"collabMetrics"',
].join(', ');

export async function getCreatorsForList(filters?: CreatorListFilters): Promise<Creator[]> {
  const { rows, q } = await queryAllCreatorRows(CREATOR_LIST_COLUMNS, filters);
  return filterCreatorsByNicheSearch(rows.map(rowToCreator), q);
}

// Bộ cột cho tab Xuất file. Bằng CREATOR_LIST_COLUMNS cộng đúng 6 field mà hai bộ cột export
// cần nhưng bảng danh sách CRM không đọc tới. Trước đây ExportView phải gọi /api/creators/:id
// cho TỪNG dòng đang hiển thị (N+1 request mỗi lần đổi ngày), và `gpm` thì không có đường nào
// tới được ExportView cả — nên cột GPM trong bộ 16 cột MAIN luôn xuất ra rỗng dù DB có 975
// creator mang giá trị đó. KHÔNG gộp mấy cột này vào CREATOR_LIST_COLUMNS: recentVideos/
// demographics là JSONB, kéo chúng cho cả roster sẽ làm nặng mọi màn hình khác.
const CREATOR_EXPORT_COLUMNS = [
  CREATOR_LIST_COLUMNS,
  'gpm', 'demographics', '"salesMetrics"', '"videoMetrics"', '"recentVideos"', 'instagram',
].join(', ');

export async function getCreatorsForExport(ids: string[]): Promise<Creator[]> {
  const clean = Array.from(new Set(ids.filter(Boolean).map(String)));
  if (clean.length === 0) return [];
  const db = getDb();
  // Cắt khúc để danh sách id không làm URL của PostgREST dài quá giới hạn; các khúc chạy song
  // song vì mỗi round-trip tới Supabase tốn ~1s bất kể query nặng nhẹ (xem queryAllCreatorRows).
  const CHUNK = 200;
  const chunks: string[][] = [];
  for (let i = 0; i < clean.length; i += CHUNK) chunks.push(clean.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map(part => db.from('creators').select(CREATOR_EXPORT_COLUMNS).in('id', part))
  );
  const out: Creator[] = [];
  for (const { data, error } of results) {
    if (error) throw error;
    (data ?? []).forEach((row: any) => out.push(rowToCreator(row)));
  }
  return out;
}

// Select tối thiểu cho các UI chỉ cần "chọn 1 creator từ danh sách" chứ không hiển thị bảng CRM
// đầy đủ — CommandPalette (⌘K search), AiDrawer (dropdown "Target Creator"). Trước đây các UI
// này dùng chung state `creators` đã load CREATOR_LIST_COLUMNS (~40 cột) cho toàn bộ bảng, dù
// chỉ render avatar/tên/handle/category. rowToCreator() tự default các cột thiếu (bio,
// notes, tags,...) nên object trả về vẫn khớp type Creator — an toàn dùng làm placeholder khi
// mở CreatorDetailDrawer (xem openCreatorDetail ở App.tsx, đã fetch lại đầy đủ ngay sau đó).
// KHÔNG dùng list này để gửi thẳng cho AI research/email/reply — AiDrawer phải tự fetch full
// creator qua /api/creators/:id trước khi gọi các route đó, vì AI cần bio/metrics thật.
const CREATOR_MINI_COLUMNS = ['id', 'handle', '"displayName"', 'avatar', 'status', 'category'].join(', ');

export async function getCreatorsMini(filters?: CreatorListFilters): Promise<Creator[]> {
  const { rows, q } = await queryAllCreatorRows(CREATOR_MINI_COLUMNS, filters);
  return filterCreatorsByNicheSearch(rows.map(rowToCreator), q);
}

// Chỉ lấy id + handle (dùng cho dedup-map khi batch-import) — tránh kéo toàn bộ row (kể cả
// JSONB blobs) chỉ để tra cứu theo handle.
export async function getAllCreatorHandles(): Promise<{ id: string; handle: string }[]> {
  const db = getDb();
  const PAGE_SIZE = 1000;
  const rows: { id: string; handle: string }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db.from('creators').select('id, handle').range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...((data as any[]) ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

export async function getCreatorsCount(): Promise<number> {
  const db = getDb();
  const { count, error } = await db.from('creators').select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

// 1 dòng bất kỳ — dùng để dựng sample context cho agent test button, không cần cả bảng.
export async function getFirstCreator(): Promise<Creator | null> {
  const db = getDb();
  const { data, error } = await db
    .from('creators')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToCreator(data) : null;
}

export async function getCreatorById(id: string): Promise<Creator | null> {
  const db = getDb();
  const { data, error } = await db.from('creators').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToCreator(data) : null;
}

export async function getCreatorByHandle(handle: string): Promise<Creator | null> {
  const db = getDb();
  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
  const { data, error } = await db.from('creators').select('*').ilike('handle', cleanHandle).maybeSingle();
  if (error) throw error;
  return data ? rowToCreator(data) : null;
}

export async function archiveCreator(id: string): Promise<Creator | null> {
  const creator = await getCreatorById(id);
  if (creator) {
    creator.status = 'Archived';
    creator.updatedAt = new Date().toISOString();
    await saveCreator(creator);
    return creator;
  }
  return null;
}

// Xóa vĩnh viễn 1 creator khỏi DB — khác archiveCreator (soft-delete). Dọn sạch mọi bản ghi
// tham chiếu tới creatorId (assignment, outreach email, conversation, content review, posted
// video, task liên quan) và gỡ creatorId khỏi campaign.creatorIds trước khi xóa creator.
export async function deleteCreatorPermanently(id: string): Promise<boolean> {
  const db = getDb();

  const assignments = await getAllAssignments({ creatorId: id });
  for (const assignment of assignments) {
    await unassignCreatorFromCampaign(assignment.id);
  }

  await db.from('outreach_emails').delete().eq('creatorId', id);
  await db.from('conversations').delete().eq('creatorId', id);
  await db.from('content_reviews').delete().eq('creatorId', id);
  await db.from('posted_videos').delete().eq('creatorId', id);
  await db.from('tasks').delete().eq('relatedCreatorId', id);

  const { error } = await db.from('creators').delete().eq('id', id);
  if (error) throw error;
  return true;
}

export async function archiveCampaign(id: string): Promise<Campaign | null> {
  const campaign = await getCampaignById(id);
  if (campaign) {
    campaign.status = 'Archived';
    await saveCampaign(campaign);
    return campaign;
  }
  return null;
}

export async function getAllCampaigns(): Promise<Campaign[]> {
  const db = getDb();
  const { data, error } = await db
    .from('campaigns')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToCampaign);
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  const db = getDb();
  const { data, error } = await db.from('campaigns').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToCampaign(data) : null;
}

export async function getAllOutreach(): Promise<OutreachEmail[]> {
  const db = getDb();
  const PAGE_SIZE = 1000;
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await db
      .from('outreach_emails')
      .select('*')
      .order('created_at_ts', { ascending: false })
      .order('rowid', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows.map(rowToOutreach);
}

// Select trơn hơn cho bảng OutreachView (/api/outreach) — bỏ 'body' (nội dung HTML đầy đủ),
// vốn chỉ dùng khi soạn email mới qua EmailComposerModal (tự lấy từ 1 lần gọi AI generation
// riêng, không đọc từ outreachList). getAllOutreach() vẫn giữ nguyên đầy đủ vì server còn dùng
// nội bộ (originalOutreach context cho AI agent ở bulk-generate/regenerate/outreach-agent).
const OUTREACH_LIST_COLUMNS = [
  'id', '"workspaceId"', '"creatorId"', '"creatorName"', '"creatorHandle"', '"campaignId"',
  '"campaignName"', 'subject', 'status', '"sentAt"', '"repliedAt"', '"followUpCount"',
  '"sequenceStage"', '"messageId"', '"isMock"',
].join(', ');

export async function getOutreachForList(): Promise<OutreachEmail[]> {
  const db = getDb();
  const { data, error } = await db
    .from('outreach_emails')
    .select(OUTREACH_LIST_COLUMNS)
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToOutreach);
}

// Last-line-of-defense duplicate check for deliverOutreachEmail: a targeted, indexed lookup
// (not a full-table getAllOutreach scan) for the most recent send to this
// creator+campaign+sequenceStage, used to catch a same-item resend that slipped past the
// bulk-outreach send lock (e.g. two overlapping sendNextBulkOutreachItem invocations racing
// on a slow SMTP send).
export async function getLatestOutreachForItem(
  creatorId: string,
  campaignId: string | undefined,
  sequenceStage: string
): Promise<OutreachEmail | null> {
  const db = getDb();
  let query = db
    .from('outreach_emails')
    .select('*')
    .eq('creatorId', creatorId)
    .eq('sequenceStage', sequenceStage)
    .order('created_at_ts', { ascending: false })
    .limit(1);
  query = campaignId ? query.eq('campaignId', campaignId) : query.is('campaignId', null);
  const { data, error } = await query;
  if (error) throw error;
  return data && data.length > 0 ? rowToOutreach(data[0]) : null;
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = getDb();
  const { data, error } = await db
    .from('conversations')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToConversation);
}

// Select trơn cho các UI chỉ cần danh sách hội thoại (Inbox list rows, Dashboard "recent
// replies", badge đếm unread) — bỏ hẳn cột `messages` (jsonb chứa toàn bộ nội dung từng email
// trong thread, cột nặng nhất bảng này). lastMessagePreview/lastMessageSenderType (duy trì bởi
// saveConversation()) đủ để hiển thị preview 1 dòng. Khi cần xem trọn thread (mở Inbox tab / mở
// 1 conversation cụ thể) hoặc tính báo cáo theo message (ReportsView) thì gọi getAllConversations()
// full riêng — xem /api/conversations/full, App.tsx fetchFullConversations().
const CONVERSATION_LIST_COLUMNS = [
  'id', '"workspaceId"', '"creatorId"', '"creatorName"', '"creatorHandle"', '"creatorAvatar"',
  '"campaignId"', '"campaignName"', 'status', '"lastMessageAt"', 'unread', '"isMock"',
  '"lastMessagePreview"', '"lastMessageSenderType"',
].join(', ');

export async function getConversationsForList(): Promise<Conversation[]> {
  const db = getDb();
  const { data, error } = await db
    .from('conversations')
    .select(CONVERSATION_LIST_COLUMNS)
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => rowToConversation({ ...row, messages: [] }));
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const db = getDb();
  const { data, error } = await db.from('conversations').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToConversation(data) : null;
}

export async function getConversationByCreatorId(creatorId: string, workspaceId?: string): Promise<Conversation | null> {
  const db = getDb();
  let query = db.from('conversations').select('*').eq('creatorId', creatorId);
  if (workspaceId) {
    query = query.eq('workspaceId', workspaceId);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ? rowToConversation(data) : null;
}

// feedbackNote/aiAnalysis: không đọc/ghi ở đâu trong app (cột chết) — vẫn lấy được qua
// getReviewById nếu sau này hoá ra cần. checklist/feedback: chỉ ReviewDetailModal đọc khi mở
// 1 review, không dùng ở lưới danh sách ReviewsView. videoThumbnail: không tham chiếu ở đâu,
// thumbnailUrl mới là field thực sự hiển thị.
const REVIEW_LIST_COLUMNS = [
  'id', '"workspaceId"', '"creatorId"', '"creatorName"', '"creatorHandle"', '"creatorAvatar"',
  '"campaignId"', '"campaignName"', '"videoTitle"', '"draftUrl"', '"thumbnailUrl"',
  '"durationSeconds"', 'status', '"dueAt"', '"submittedAt"', '"isMock"',
].join(', ');

export async function getAllReviews(): Promise<ContentReview[]> {
  const db = getDb();
  const { data, error } = await db
    .from('content_reviews')
    .select(REVIEW_LIST_COLUMNS)
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToReview);
}

export async function getReviewById(id: string): Promise<ContentReview | null> {
  const db = getDb();
  const { data, error } = await db.from('content_reviews').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToReview(data) : null;
}

export async function getAllTasks(): Promise<Task[]> {
  const db = getDb();
  const { data, error } = await db
    .from('tasks')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToTask);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = getDb();
  const { data, error } = await db.from('tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToTask(data) : null;
}

export async function getAllNotifications(): Promise<NotificationItem[]> {
  const db = getDb();
  const { data, error } = await db
    .from('notifications')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToNotification);
}

export async function markAllNotificationsRead(): Promise<void> {
  const db = getDb();
  check(await db.from('notifications').update({ isRead: true }).eq('isRead', false));
}

export async function getAllActivities(): Promise<ActivityItem[]> {
  const db = getDb();
  const { data, error } = await db
    .from('activities')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToActivity);
}

export async function getUnresolvedUnmatchedInboundEmails(): Promise<UnmatchedInboundEmail[]> {
  const db = getDb();
  const { data, error } = await db
    .from('unmatched_inbound_emails')
    .select('*')
    .eq('resolved', false)
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToUnmatchedInboundEmail);
}

export async function getUnmatchedInboundEmailById(id: string): Promise<UnmatchedInboundEmail | null> {
  const db = getDb();
  const { data, error } = await db.from('unmatched_inbound_emails').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToUnmatchedInboundEmail(data) : null;
}

export async function getAllWorkspaces(): Promise<Workspace[]> {
  const db = getDb();
  const { data, error } = await db
    .from('workspaces')
    .select('*')
    .order('created_at_ts', { ascending: false })
    .order('rowid', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(rowToWorkspace);
}

export async function getWorkspaceById(id: string): Promise<Workspace | null> {
  const db = getDb();
  const { data, error } = await db.from('workspaces').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? rowToWorkspace(data) : null;
}

export async function addActivity(actor: string, action: string, target: string, entityType: any, entityId: string): Promise<ActivityItem> {
  const newActivity: ActivityItem = {
    id: `act-${Date.now()}`,
    actor,
    action,
    target,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
  };
  await saveActivity(newActivity);
  return newActivity;
}

export async function normalizeCreatorStoreInDb(
  isValidCreatorHandle: (h: string) => boolean,
  sanitizeCreatorDisplayName: (d: string, h: string) => string
): Promise<void> {
  const db = getDb();
  const creators = await getAllCreators();

  // No client-side multi-statement transaction with supabase-js — these updates aren't
  // concurrency-sensitive (one-time cleanup pass), so sequential awaits are fine.
  for (const c of creators) {
    if (!isValidCreatorHandle(c.handle)) {
      check(await db.from('creators').delete().eq('id', c.id));
    } else {
      const cleanName = sanitizeCreatorDisplayName(c.displayName, c.handle);
      if (cleanName !== c.displayName) {
        check(await db.from('creators').update({ displayName: cleanName }).eq('id', c.id));
      }
    }
  }
}

export async function searchAll(q: string) {
  const cleanQ = q.toLowerCase().trim();
  if (!cleanQ) {
    return { creators: [], campaigns: [], tasks: [] };
  }

  const [creators, allCampaigns, allTasks] = await Promise.all([
    getAllCreators({ search: cleanQ }),
    getAllCampaigns(),
    getAllTasks(),
  ]);
  const campaigns = allCampaigns.filter(
    c => c.name.toLowerCase().includes(cleanQ) || c.brand.toLowerCase().includes(cleanQ)
  );
  const tasks = allTasks.filter(t => t.title.toLowerCase().includes(cleanQ));

  return {
    creators: creators.slice(0, 5),
    campaigns: campaigns.slice(0, 5),
    tasks: tasks.slice(0, 5),
  };
}

export async function seedInitialDataIfEmpty(initialData: {
  workspaces: Workspace[];
  creators?: Creator[];
  campaigns: Campaign[];
  outreach: OutreachEmail[];
  conversations: Conversation[];
  reviews: ContentReview[];
  tasks: Task[];
  notifications: NotificationItem[];
  activities: ActivityItem[];
  kpis: DashboardKPIs;
}): Promise<void> {
  const db = getDb();
  const [{ count: wsCount }, { count: crCount }] = await Promise.all([
    db.from('workspaces').select('id', { count: 'exact', head: true }),
    db.from('creators').select('id', { count: 'exact', head: true }),
  ]);

  if ((wsCount ?? 0) > 0 && (crCount ?? 0) > 0) {
    return;
  }

  console.log(`Seeding initial database data (workspaces: ${wsCount}, creators: ${crCount})...`);

  if ((wsCount ?? 0) === 0) {
    for (const ws of initialData.workspaces) await saveWorkspace(ws);
    for (const cmp of initialData.campaigns) await saveCampaign(cmp);
    for (const out of initialData.outreach) await saveOutreach(out);
    for (const conv of initialData.conversations) await saveConversation(conv);
    for (const rev of initialData.reviews) await saveReview(rev);
    for (const t of initialData.tasks) await saveTask(t);
    for (const n of initialData.notifications) await saveNotification(n);
    for (const act of initialData.activities) await saveActivity(act);
    await setKpis(initialData.kpis);
  }

  if ((crCount ?? 0) === 0 && initialData.creators) {
    for (const cr of initialData.creators) await saveCreator(cr);
  }
}
