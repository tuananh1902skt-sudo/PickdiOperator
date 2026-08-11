import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { ZipArchive } from 'archiver';
import { scoreCreator } from './src/scoring';
import { getEmailConfig, saveEmailConfig, DEFAULT_SENDER_NAME } from './src/lib/emailConfig';
import { sendEmail } from './src/lib/mailer';
import { renderFirstContactEmailHtml } from './src/lib/emailTemplate';
import { checkInboxForReplies } from './src/lib/imapSync';
import { downloadAvatar } from './src/lib/avatars';
import { Client as QStashClient, Receiver as QStashReceiver } from '@upstash/qstash';
import { getAiConfig, saveAiConfig, defaultModelFor, AiProviderName } from './src/lib/aiConfig';
import { getOutreachTemplates, saveOutreachTemplates, fillOutreachTemplate, SequenceStage } from './src/lib/outreachTemplates';
import { pickRandomFirstContactSubject, ensurePaidSubject } from './src/lib/outreachSubjects';
import {
  runAgent,
  runTextAgent,
  classifyAgentError,
  OUTREACH_SEQUENCE_AGENTS,
  negotiationReplyAgent,
  creatorDeepResearchAgent,
  reviewComplianceChecklistAgent,
  opsDailySummaryAgent,
  opsPrioritySuggesterAgent,
  copilotChatAgent,
  AGENT_REGISTRY,
} from './src/lib/agents';
import {
  getAgentPromptOverride,
  saveAgentPromptOverride,
  deleteAgentPromptOverride,
} from './src/db';
import {
  Workspace,
  Creator,
  CreatorStatus,
  Campaign,
  OutreachEmail,
  Conversation,
  ContentReview,
  Task,
  NotificationItem,
  ActivityItem,
  BulkOutreachJob,
  BulkOutreachItem,
  CreatorCampaignAssignment,
  PostedVideo,
} from './src/types';
import {
  INITIAL_WORKSPACES,
  INITIAL_CREATORS,
  INITIAL_CAMPAIGNS,
  INITIAL_OUTREACH,
  INITIAL_CONVERSATIONS,
  INITIAL_REVIEWS,
  INITIAL_TASKS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITIES,
  INITIAL_KPIS,
} from './src/data/initialData';
import {
  getDb,
  isDbConnected,
  seedInitialDataIfEmpty,
  getKpis,
  setKpis,
  getAllCreators,
  getCreatorsForList,
  getCreatorStatusCounts,
  getAllCreatorHandles,
  getCreatorsCount,
  getFirstCreator,
  getCreatorById,
  getCreatorByHandle,
  saveCreator,
  archiveCreator,
  deleteCreatorPermanently,
  getAllWorkspaces,
  getWorkspaceById,
  saveWorkspace,
  getAllCampaigns,
  getCampaignById,
  saveCampaign,
  archiveCampaign,
  getAllOutreach,
  saveOutreach,
  getLatestOutreachForItem,
  getAllConversations,
  getConversationById,
  saveConversation,
  getAllReviews,
  getReviewById,
  saveReview,
  getAllTasks,
  getTaskById,
  saveTask,
  getAllNotifications,
  saveNotification,
  markAllNotificationsRead,
  getAllActivities,
  addActivity,
  normalizeCreatorStoreInDb,
  searchAll,
  getUnresolvedUnmatchedInboundEmails,
  getUnmatchedInboundEmailById,
  saveUnmatchedInboundEmail,
  getAllAssignments,
  getAssignmentById,
  saveAssignment,
  assignCreatorToCampaign,
  unassignCreatorFromCampaign,
  saveBulkOutreachJob,
  getBulkOutreachJobById,
  getSendingBulkOutreachJobs,
  tryClaimBulkOutreachSendLock,
  getAllPostedVideos,
  getPostedVideoById,
  savePostedVideo,
} from './src/db';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Express 4 doesn't forward a rejected promise from an async route handler to the error
// middleware below — it's silently swallowed as an unhandled rejection, which crashes the
// whole serverless invocation instead of returning a JSON error for that one request. Wrap
// every route handler registered on `app` so async failures reach next(err) like a thrown
// error would.
for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
  const original = app[method].bind(app);
  (app as any)[method] = (path: any, ...handlers: any[]) => {
    const wrapped = handlers.map((h) =>
      typeof h === 'function'
        ? (req: express.Request, res: express.Response, next: express.NextFunction) => {
            Promise.resolve(h(req, res, next)).catch(next);
          }
        : h
    );
    return original(path, ...wrapped);
  };
}

const qstashClient = process.env.QSTASH_TOKEN ? new QStashClient({ token: process.env.QSTASH_TOKEN }) : null;
const qstashReceiver = (process.env.QSTASH_CURRENT_SIGNING_KEY && process.env.QSTASH_NEXT_SIGNING_KEY)
  ? new QStashReceiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
    })
  : null;

function publicAppUrl(): string {
  const url = process.env.APP_URL;
  if (!url) throw new Error('APP_URL must be set to schedule paced bulk-outreach sends via QStash');
  return url.replace(/\/$/, '');
}

// Enable CORS for creator-import sources (Kalodata/TCM extension, local dev, and this
// app's own Cloud Run deployment) — the batch-import route can be called from a content
// script or extension. APP_URL pins the exact deployed host instead of trusting every
// *.run.app tenant on Cloud Run.
const allowedOriginPatterns: RegExp[] = [
  /^https:\/\/(www\.)?tiktok\.com$/,
  /^https:\/\/ads\.tiktok\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^chrome-extension:\/\/[a-z0-9]{32}$/i
];
if (process.env.APP_URL) {
  try {
    const appUrl = new URL(process.env.APP_URL);
    allowedOriginPatterns.push(new RegExp(`^${appUrl.protocol}//${appUrl.host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  } catch {
    console.warn('APP_URL is not a valid URL, skipping CORS allowlist entry for it');
  }
}
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOriginPatterns.some(re => re.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));

// Opt-in shared-secret auth for mutating requests. Disabled (no-op) unless API_KEY is set,
// so existing local/dev usage keeps working; set API_KEY in production to require it.
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.warn('API_KEY is not set — all API routes are unauthenticated. Set API_KEY to require an x-api-key header on write requests.');
}
app.use((req, res, next) => {
  if (!API_KEY) return next();
  if (req.method === 'GET' || req.method === 'OPTIONS') return next();
  if (req.headers['x-api-key'] === API_KEY) return next();
  return res.status(401).json({ success: false, message: 'Unauthorized: missing or invalid x-api-key' });
});

// Initialize Supabase client (lazy — just constructs the client, no I/O yet).
getDb();

// On Vercel, this one-time seed/cleanup should be run manually via the migration script
// instead of on every cold start (it does a full table scan) — for local dev / a
// traditional long-lived host it still runs automatically like before, fire-and-forget.
if (!process.env.VERCEL) {
  (async () => {
    try {
      await seedInitialDataIfEmpty({
        workspaces: INITIAL_WORKSPACES,
        creators: INITIAL_CREATORS,
        campaigns: INITIAL_CAMPAIGNS,
        outreach: INITIAL_OUTREACH,
        conversations: INITIAL_CONVERSATIONS,
        reviews: INITIAL_REVIEWS,
        tasks: INITIAL_TASKS,
        notifications: INITIAL_NOTIFICATIONS,
        activities: INITIAL_ACTIVITIES,
        kpis: INITIAL_KPIS,
      });
      await normalizeCreatorStoreInDb(isValidCreatorHandle, sanitizeCreatorDisplayName);
    } catch (err) {
      console.error('Startup seed/normalize failed:', err);
    }
  })();
}

// Sends a thrown agent error back to the client with the right HTTP status.
async function handleAiRouteError(err: any, res: express.Response) {
  const { status, errorType, message } = await classifyAgentError(err);
  res.status(status).json({ success: false, errorType, message });
}

// Deterministic Daily Summary Fallback Generator
function buildDeterministicDailySummary(kpis: any, reviews: any[], tasks: any[]) {
  const todayEmails = kpis.todayEmailsSent || 0;
  const todayReplies = kpis.todayRepliesReceived || 0;
  const pendingReviewsCount = reviews.filter((r: any) => r.status === 'Pending Review').length;
  const pendingTasks = tasks.filter((t: any) => t.status !== 'Completed');

  const urgentTaskTitles = pendingTasks
    .filter((t: any) => t.priority === 'CRITICAL' || t.priority === 'HIGH')
    .map((t: any) => `[${t.priority}] ${t.title}`);

  const urgentPriorities = urgentTaskTitles.length > 0
    ? urgentTaskTitles.slice(0, 3)
    : pendingReviewsCount > 0
      ? [`Duyệt ${pendingReviewsCount} video draft đang chờ`]
      : ['Không có công việc khẩn cấp hôm nay.'];

  let aiRecommendation = 'Tiếp tục tìm kiếm và liên hệ thêm các TikTok Creator phù hợp.';
  if (pendingReviewsCount > 0) {
    aiRecommendation = `Ưu tiên xử lý duyệt ${pendingReviewsCount} draft video đang chờ phản hồi từ Creator.`;
  } else if (pendingTasks.length > 0) {
    aiRecommendation = `Ưu tiên giải quyết ${pendingTasks.length} công việc tồn đọng trong CRM.`;
  }

  return {
    progressSummary: `Hôm nay đã gửi ${todayEmails} email, nhận ${todayReplies} phản hồi từ Creator.`,
    urgentPriorities,
    aiRecommendation,
    source: 'deterministic' as const,
  };
}

// Safe numeric coercion — Number("abc") is NaN, which is a valid JS number and would
// silently corrupt a stored column if written as-is. Returns undefined instead.
function toFiniteNumber(value: any): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Strips identity/system-controlled fields from a PATCH body before merging, so a caller
// can't reassign a record's id, spoof its creation timestamp, or fake the "isMock" flag.
function stripImmutableFields<T extends Record<string, any>>(body: T, extraKeys: string[] = []): Partial<T> {
  const clone = { ...body };
  for (const key of ['id', 'createdAt', 'isMock', ...extraKeys]) {
    delete clone[key];
  }
  return clone;
}

// Handle & Creator Data Validation Helpers
function isValidCreatorHandle(handleStr: string): boolean {
  if (!handleStr || typeof handleStr !== 'string') return false;
  const clean = handleStr.replace(/^@/, '').trim();
  if (clean.length < 2 || clean.length > 50) return false;
  
  // Reject pure numbers or formatted numbers like 266.7K, 19.6k, 306.3M, 4.8%, 1000
  if (/^[0-9\.\,\s\u00a0]+[kmbKMB%]?$/i.test(clean)) return false;
  if (/^\d+[\.\d]*[kmbKMB]?$/i.test(clean)) return false;
  if (/^[0-9]+$/i.test(clean)) return false;
  
  const lower = clean.toLowerCase();
  if (/followers|follower|người theo dõi|fans|views|xem|engagement|tương tác|collaborate|usd|\$/i.test(lower)) return false;

  const noiseList = ['profile', 'explore', 'search', 'select', 'filter', 'category', 'copyright', 'undefined', 'pickdi', 'keyword', 'recommended', 'tools', 'payment', 'sort', 'relevance'];
  if (noiseList.some(n => lower === n || lower.includes('undefined'))) return false;

  // A scraper source coerced a non-string field (object/array) to string via String(x) — e.g.
  // `[object Object]` — instead of throwing. Catch that failure mode here instead of letting
  // it become a permanent garbage creator record.
  if (lower.includes('[object object]') || lower.includes('[object array]')) return false;

  return true;
}

function sanitizeCreatorDisplayName(displayName: string, handle: string): string {
  if (!displayName || !isValidCreatorHandle(displayName) || /^[0-9\.\,]+[kmbKMB%]?$/i.test(displayName) || /followers|views|engagement|theo dõi/i.test(displayName)) {
    if (handle.startsWith('creator_')) {
      return `TikTok Creator #${handle.replace('creator_', '')}`;
    }
    return handle;
  }
  return displayName;
}

// API Routes
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), dbConnected: await isDbConnected() });
});

// Dashboard & KPIs
app.get('/api/dashboard', async (req, res) => {
  // Safety net beyond the bulk-job modal's own polling: if the operator closed that modal
  // and comes back later via the dashboard, any job stalled past its nextSendAt still gets
  // nudged forward here instead of staying stuck until someone reopens that exact job.
  getSendingBulkOutreachJobs()
    .then(jobs => jobs.forEach(job => maybeResumeBulkJob(job).catch(err => console.error(`Bulk outreach job ${job.id} resume-on-poll failed:`, err))))
    .catch(err => console.error('Bulk outreach resume sweep failed:', err));

  // Không phụ thuộc lẫn nhau — chạy song song thay vì 6 round-trip Supabase nối tiếp
  // (mỗi round-trip ~0.5-1s, tuần tự cộng dồn là nguyên nhân chính khiến dashboard chậm).
  const [kpis, allTasks, allNotifications, allActivities, conversations, statusCounts] = await Promise.all([
    getKpis(INITIAL_KPIS),
    getAllTasks(),
    getAllNotifications(),
    getAllActivities(),
    getAllConversations(),
    getCreatorStatusCounts(),
  ]);
  const tasks = allTasks.filter(t => t.status !== 'Completed').slice(0, 5);
  const notifications = allNotifications.slice(0, 5);
  const activities = allActivities.slice(0, 8);
  const recentReplies = conversations.filter(c => c.unread || c.status === 'Negotiating').slice(0, 5);

  res.json({
    success: true,
    data: {
      kpis,
      tasks,
      notifications,
      activities,
      recentReplies,
      creatorsByStatus: {
        NewLead: statusCounts['New Lead'] || 0,
        Researching: statusCounts['Researching'] || 0,
        Qualified: statusCounts['Qualified'] || 0,
        ContactLan1: statusCounts['Contact lần 1'] || 0,
        ContactLan2: statusCounts['Contact lần 2'] || 0,
        ContactLan3: statusCounts['Contact lần 3'] || 0,
        Negotiating: statusCounts['Negotiating'] || 0,
        Approved: statusCounts['Approved'] || 0,
        DraftSubmitted: statusCounts['Draft Submitted'] || 0,
        Completed: statusCounts['Completed'] || 0,
      }
    }
  });
});

// Creators API
app.get('/api/creators', async (req, res) => {
  const { keyword, status, country, category, search } = req.query;
  const filtered = await getCreatorsForList({
    keyword: keyword ? String(keyword) : undefined,
    search: search ? String(search) : undefined,
    status: status ? String(status) : undefined,
    country: country ? String(country) : undefined,
    category: category ? String(category) : undefined,
  });
  res.json({ success: true, data: filtered, meta: { total: filtered.length } });
});

app.get('/api/creators/:id', async (req, res) => {
  const creator = await getCreatorById(req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }
  res.json({ success: true, data: creator });
});

app.post('/api/creators', async (req, res) => {
  const handle = req.body.handle?.replace(/^@/, '').trim();
  if (!isValidCreatorHandle(handle)) {
    return res.status(400).json({ success: false, message: 'A valid TikTok handle is required' });
  }

  const newCreatorId = `cr-${Date.now()}`;
  let avatarPath: string | undefined = req.body.avatar || undefined;
  if (avatarPath && avatarPath.startsWith('http')) {
    const downloaded = await downloadAvatar(avatarPath, newCreatorId);
    if (downloaded) {
      avatarPath = downloaded;
    }
  }

  const newCreator: Creator = {
    id: newCreatorId,
    source: 'manual',
    handle,
    displayName: req.body.displayName || handle,
    avatar: avatarPath,
    platform: req.body.platform || 'TikTok',
    country: req.body.country || undefined,
    language: req.body.language || undefined,
    bio: req.body.bio || '',
    profileUrl: req.body.profileUrl || `https://tiktok.com/@${handle}`,
    followers: toFiniteNumber(req.body.followers),
    avgViews: toFiniteNumber(req.body.avgViews),
    engagementRate: toFiniteNumber(req.body.engagementRate),
    category: req.body.category || undefined,
    niche: Array.isArray(req.body.niche) ? req.body.niche : undefined,
    brandFitScore: toFiniteNumber(req.body.brandFitScore),
    commercialScore: toFiniteNumber(req.body.commercialScore),
    riskScore: toFiniteNumber(req.body.riskScore),
    status: req.body.status || 'New Lead',
    owner: req.body.owner || 'Anh Tuan',
    email: req.body.email || undefined,
    phone: req.body.phone || undefined,
    rateCard: req.body.rateCard || undefined,
    createdAt: new Date().toISOString(),
    tags: Array.isArray(req.body.tags) ? req.body.tags : ['New Creator'],
    notes: req.body.notes ? [{ id: `n-${Date.now()}`, author: 'Anh Tuan', content: req.body.notes, createdAt: new Date().toISOString() }] : []
  };

  await saveCreator(newCreator);
  await addActivity('Anh Tuan', 'created creator profile', `@${newCreator.handle}`, 'creator', newCreator.id);

  res.status(201).json({ success: true, data: newCreator });
});

app.patch('/api/creators/:id', async (req, res) => {
  const creator = await getCreatorById(req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }

  const prevStatus = creator.status;
  const updatedCreator: Creator = {
    ...creator,
    ...stripImmutableFields(req.body, ['source']),
    updatedAt: new Date().toISOString()
  };

  await saveCreator(updatedCreator);

  if (req.body.status && req.body.status !== prevStatus) {
    await addActivity('Anh Tuan', `updated status to ${req.body.status}`, `@${updatedCreator.handle}`, 'creator', updatedCreator.id);
  }

  res.json({ success: true, data: updatedCreator });
});

// Đổi trạng thái pipeline (kéo-thả kanban outreach, hoặc archive) — PHẢI ghi vào đúng
// assignment của workspace đang mở, không phải Creator.status chung, để 1 workspace đổi
// trạng thái không làm lộ/ảnh hưởng tới cách creator này hiện ra ở các workspace khác.
// Chỉ fallback về Creator.status chung khi creator không có assignment nào ở workspace đó
// (vd workspace Agency xem 1 creator chưa từng chạy campaign với brand nào).
// Dùng chung cho cả thao tác kéo-thả tay (route dưới) lẫn trigger tự động từ Google Sheet
// (route /api/creators/sheet-approval) để 2 đường đi luôn cho kết quả nhất quán.
async function setCreatorWorkspaceStatus(
  creator: Creator,
  workspaceId: string | undefined,
  status: string,
  actor: string
): Promise<{ assignment?: CreatorCampaignAssignment; creator?: Creator }> {
  const scoped = workspaceId
    ? (await getAllAssignments({ creatorId: creator.id })).filter(a => a.workspaceId === workspaceId)
    : [];

  if (scoped.length > 0) {
    const latest = [...scoped].sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())[0];
    latest.status = status as CreatorCampaignAssignment['status'];
    await saveAssignment(latest);
    await addActivity(actor, `updated status to ${status}`, `@${creator.handle}`, 'creator', creator.id);
    return { assignment: latest };
  }

  creator.status = status as Creator['status'];
  creator.updatedAt = new Date().toISOString();
  await saveCreator(creator);
  await addActivity(actor, `updated status to ${status}`, `@${creator.handle}`, 'creator', creator.id);
  return { creator };
}

app.post('/api/creators/:id/workspace-status', async (req, res) => {
  const { workspaceId, status } = req.body;
  const creator = await getCreatorById(req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }
  if (!status) {
    return res.status(400).json({ success: false, message: 'status là bắt buộc' });
  }

  const result = await setCreatorWorkspaceStatus(creator, workspaceId, status, 'Anh Tuan');
  res.json({ success: true, data: result });
});

// D'Alba's TCM creator-approval reviewer không có tài khoản trong hệ thống — họ chỉ duyệt
// creator qua Google Sheet dùng chung (cột "O/X", giá trị "O" = duyệt). 1 Apps Script gắn
// vào Sheet đó (onEdit trigger) POST vào đây mỗi khi cột đó đổi thành "O", để tự động đẩy
// creator sang Qualified — CÙNG logic với kéo-thả kanban tay ở route trên, không phải 1
// đường đi riêng. "O" -> Qualified, "X" -> Archived — CẢ HAI đều ghi vào assignment của
// riêng workspace dalba (setCreatorWorkspaceStatus), KHÔNG global-archive Creator.status,
// vì 1 creator có thể vẫn đang chạy campaign ở workspace khác (quyết định user 2026-07-31,
// sửa lại từ lần đầu lỡ dùng archiveCreator() global). Handle không khớp creator nào thì bỏ
// qua (404), không tự tạo creator rác.
const DALBA_SHEET_WORKSPACE_ID = process.env.DALBA_SHEET_WORKSPACE_ID || 'ws-1785364956726';

app.post('/api/creators/sheet-approval', async (req, res) => {
  const handle = typeof req.body.handle === 'string' ? req.body.handle.trim() : '';
  const value = typeof req.body.value === 'string' ? req.body.value.trim().toUpperCase() : 'O';
  if (!handle) {
    return res.status(400).json({ success: false, message: 'handle là bắt buộc' });
  }

  const creator = await getCreatorByHandle(handle);
  if (!creator) {
    return res
      .status(404)
      .json({ success: false, message: `Không tìm thấy creator với handle @${handle} — bỏ qua` });
  }

  // "O" chỉ được phép đẩy New Lead -> Qualified. Nếu reviewer đã liên hệ creator này
  // trong app (Contact lần 1/2/3, Interested, Negotiating, ...) thì tiến trình đó là
  // của người vận hành app, sheet không được ghi đè lùi lại. "X" (từ chối) thì luôn áp
  // dụng bất kể đang ở giai đoạn nào.
  if (value !== 'X') {
    const scopedAssignments = (await getAllAssignments({ creatorId: creator.id })).filter(
      a => a.workspaceId === DALBA_SHEET_WORKSPACE_ID
    );
    const latestAssignment = scopedAssignments.length
      ? [...scopedAssignments].sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime())[0]
      : undefined;
    const currentStatus = latestAssignment ? latestAssignment.status : creator.status;

    if (currentStatus !== 'New Lead') {
      return res.json({
        success: true,
        data: { handle: creator.handle, skipped: true, currentStatus, reason: 'not New Lead' },
      });
    }
  }

  const result = await setCreatorWorkspaceStatus(
    creator,
    DALBA_SHEET_WORKSPACE_ID,
    value === 'X' ? 'Archived' : 'Qualified',
    "Google Sheet (d'Alba reviewer)"
  );
  res.json({ success: true, data: { handle: creator.handle, ...result } });
});

app.delete('/api/creators/:id', async (req, res) => {
  const creator = await archiveCreator(req.params.id);
  if (creator) {
    await addActivity('Anh Tuan', 'archived creator', `@${creator.handle}`, 'creator', creator.id);
  }
  res.json({ success: true, message: 'Creator archived successfully' });
});

app.delete('/api/creators/:id/permanent', async (req, res) => {
  const creator = await getCreatorById(req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }
  await deleteCreatorPermanently(req.params.id);
  await addActivity('Anh Tuan', 'permanently deleted creator', `@${creator.handle}`, 'creator', creator.id);
  res.json({ success: true, message: 'Creator permanently deleted' });
});

// ==========================================
// CREATOR IMPORT ROUTES
// ==========================================

// Extension chạy 2 hàng đợi độc lập (auto-detail-queue và search-cid-queue, xem
// extension-v2/background.js) — mỗi item của mỗi hàng đợi tự POST 1 request riêng lên đây, không
// khoá lẫn nhau. Nếu 2 request cho CÙNG 1 handle chồng thời gian (ví dụ user chạy cả 2 hàng đợi
// gần nhau cho cùng creator), request nào cũng đọc existingByHandle NGAY LÚC BẮT ĐẦU — request
// B có thể đọc snapshot TRƯỚC KHI request A kịp lưu xong, không thấy creator A vừa tạo -> tạo
// thêm 1 dòng trùng thay vì update (bug thật: đã thấy 2 dòng "Jori Renee" trùng handle, 1 dòng
// thiếu email do search-cid, 1 dòng có email do auto-detail, ngày 2026-08-03). Tuần tự hoá toàn
// bộ handler bằng 1 promise chain — mỗi request đợi request trước xử lý xong (đọc DB + lưu DB)
// rồi mới bắt đầu đọc, loại bỏ hoàn toàn khoảng hở race này. Chi phí chấp nhận được vì tần suất
// gọi endpoint này rất thấp (giãn cách vài giây/creator theo thiết kế chống bot của extension).
let batchImportChain: Promise<void> = Promise.resolve();

// 1. Webhook Endpoint for Extension & Scraper Script Sync — receives creators from any
// import source via item.metricsSource (Kalodata, TCM, CSV, etc.); source-specific field
// mapping is added per-source as those integrations land.
app.post('/api/creators/batch-import', async (req, res) => {
  const { workspaceId, source, region, metricsSource, creators: batchList } = req.body;
  if (!Array.isArray(batchList) || batchList.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid creators provided in batch payload' });
  }

  // Xếp hàng sau request trước (nếu có) — .catch(() => {}) để 1 request lỗi không làm kẹt cả
  // chain, chặn mãi mãi mọi request batch-import sau nó.
  const runAfterPrevious = batchImportChain.catch(() => {});
  let releaseNext: () => void = () => {};
  batchImportChain = runAfterPrevious.then(() => new Promise<void>((resolve) => { releaseNext = resolve; }));
  await runAfterPrevious;
  try {

  let importedCount = 0;
  let updatedCount = 0;
  const avatarJobs: { creatorId: string; avatarUrl: string }[] = [];
  const failedHandles: { handle: string; message: string }[] = [];
  const toSave: { creator: Creator; kind: 'new' | 'updated' }[] = [];

  // 1 lần fetch toàn bộ creators hiện có thay vì gọi getCreatorByHandle (1 round-trip Supabase)
  // riêng cho từng dòng — với import hàng nghìn dòng, N round-trip tuần tự là nguyên nhân chính
  // khiến request treo lâu tới mức client timeout ("Lỗi kết nối tới máy chủ") dù dữ liệu đã ghi
  // được vào DB. Batch-import không cần dữ liệu real-time tuyệt đối như getCreatorByHandle đơn lẻ.
  const existingByHandle = new Map<string, Creator>();
  for (const c of await getAllCreators()) {
    existingByHandle.set(c.handle.toLowerCase(), c);
  }
  // Cache scoring criteria theo workspace — đa số dòng trong 1 lần import cùng chung workspace
  // đích, gọi lại getWorkspaceById cho từng dòng (như applyScore vẫn làm) là round-trip thừa.
  const criteriaCache = new Map<string, any>();
  async function getCachedCriteria(wsId: string | undefined) {
    if (!wsId) return undefined;
    if (!criteriaCache.has(wsId)) {
      const ws = await getWorkspaceById(wsId);
      criteriaCache.set(wsId, ws?.scoringCriteria);
    }
    return criteriaCache.get(wsId);
  }

  for (const item of batchList as any[]) {
   try {
    const rawHandle = (
      item.handle ||
      item.unique_id ||
      item.uniqueId ||
      item.username ||
      item.creator_handle ||
      item.nickName ||
      item.nickname ||
      item.displayName ||
      item.name ||
      (item.user_info ? (item.user_info.unique_id || item.user_info.username) : '') ||
      (item.creator_info ? (item.creator_info.unique_id || item.creator_info.handle) : '') ||
      ''
    ).toString().replace(/^@/, '').trim();

    if (!isValidCreatorHandle(rawHandle)) continue;

    const existing = existingByHandle.get(rawHandle.toLowerCase());

    const targetWs = workspaceId || INITIAL_WORKSPACES[0]?.id;
    // BUG THẬT (2026-08-03, phát hiện lúc test cào chi tiết thật): profile.selection_region trả
    // về mã vùng viết tắt ("US", "UK"...) chứ không phải tên đầy đủ, nhưng phần còn lại của app
    // (CreatorDetailDrawer flag icon, outreach.ts chọn ngôn ngữ, và nhánh language phía dưới) đều
    // so sánh countryName với tên đầy đủ ("United States", "Vietnam") — creator US thật bị gắn
    // nhầm "Languages spoken: Vietnamese" nếu không normalize trước khi lưu.
    const REGION_CODE_TO_COUNTRY: Record<string, string> = {
      US: 'United States',
      UK: 'United Kingdom',
      GB: 'United Kingdom',
      VN: 'Vietnam',
    };
    const rawCountry = item.country || region;
    const countryName =
      (rawCountry && REGION_CODE_TO_COUNTRY[String(rawCountry).toUpperCase()]) ||
      rawCountry ||
      (rawHandle.includes('_us') ? 'United States' : rawHandle.includes('_uk') ? 'United Kingdom' : undefined);

    const cleanDisplayName = sanitizeCreatorDisplayName(item.displayName || item.nickname || item.name || rawHandle, rawHandle);

    const scrapedFollowers = item.followers ?? item.follower_cnt ?? item.follower_count;
    const scrapedAvgViews = item.avgViews ?? item.avg_video_views ?? item.median_views;
    const scrapedEngagement = item.engagementRate ?? item.engagement ?? item.engagement_rate;
    const scrapedGmv = item.gmv30d ?? item.e_commerce_gmv ?? item.gmv;
    const rawAvatar = item.avatar || item.avatar_thumb || item.head_url;
    // d'Alba sourcing criteria (Kalodata import) — chỉ có khi import từ tab Kalodata.
    const itemMetricsSource = metricsSource || item.metricsSource || undefined;
    // TCM extension luôn gửi metricsSource: 'tcm' (xem extension/background.js) — đây là scrape
    // event thật (ngày cào). Mọi request khác đi qua endpoint này đều là file/sheet import
    // (Kalodata/Cruva/Generic CSV từ ImportWizardModal) — ngày import, không phải ngày cào.
    const isTcmScrape = itemMetricsSource === 'tcm';
    const isFileImport = !isTcmScrape;
    const nowIso = new Date().toISOString();

    if (existing) {
      if (rawAvatar && typeof rawAvatar === 'string' && rawAvatar.startsWith('http')) {
        avatarJobs.push({ creatorId: existing.id, avatarUrl: rawAvatar });
      }

      // Enrich existing profile with scraped stats — only overwrite when the scraper actually found a value.
      // workspaceId chỉ set lần đầu (home workspace lúc tạo) — re-scrape từ 1 workspace khác
      // KHÔNG được đổi home workspace của creator đã có, nếu không sẽ vô tình làm creator này
      // biến mất khỏi workspace gốc (xem creatorBelongsToActiveWorkspace ở App.tsx).
      const updated: Creator = {
        ...existing,
        workspaceId: existing.workspaceId || targetWs,
        // BUG THẬT (2026-08-03): nhánh update creator đã tồn tại trước đây KHÔNG merge
        // displayName/country từ data mới scrape — chỉ sanitize lại displayName CŨ, còn country
        // thì hoàn toàn không có trong object này. Kết quả: creator nào đã tồn tại từ trước (vd
        // được tạo stub qua "Import creator đã bắt được") rồi sau đó cào chi tiết đầy đủ qua "Lấy
        // chi tiết trang này" thì displayName/country vẫn bị bỏ trống vĩnh viễn dù shared.js đã
        // trích xuất đúng field từ TCM — đây chính là nguyên nhân "creator detail không có đủ" dù
        // extension báo cào thành công.
        displayName: (item.displayName || item.nickname || item.name) ? cleanDisplayName : sanitizeCreatorDisplayName(existing.displayName, rawHandle),
        country: countryName || existing.country,
        language: countryName ? (countryName === 'United States' || countryName === 'United Kingdom' ? 'English' : 'Vietnamese') : existing.language,
        avatar: (typeof rawAvatar === 'string' && rawAvatar.startsWith('/api/avatars/')) ? rawAvatar : existing.avatar,
        followers: toFiniteNumber(scrapedFollowers) ?? existing.followers,
        avgViews: toFiniteNumber(scrapedAvgViews) ?? existing.avgViews,
        engagementRate: toFiniteNumber(scrapedEngagement) ?? existing.engagementRate,
        gmv30d: toFiniteNumber(scrapedGmv) ?? existing.gmv30d,
        email: item.email || item.contact_email || existing.email,
        bio: item.bio || existing.bio,
        category: (typeof item.category === 'string' && item.category) ? item.category : existing.category,
        niche: (item.niche && (Array.isArray(item.niche) ? item.niche.length : String(item.niche).length))
          ? (Array.isArray(item.niche) ? item.niche : String(item.niche).split(','))
          : existing.niche,
        recentVideos: (item.recentVideos && item.recentVideos.length > 0) ? item.recentVideos : existing.recentVideos,
        demographics: item.demographics || existing.demographics,
        followerGrowthRate: item.followerGrowthRate || existing.followerGrowthRate,
        postingFrequency30d: item.postingFrequency30d || existing.postingFrequency30d,
        gpm: toFiniteNumber(item.gpm) ?? existing.gpm,
        beautyCategoryRatio: toFiniteNumber(item.beautyCategoryRatio) ?? existing.beautyCategoryRatio,
        hasAffiliateGmv: item.hasAffiliateGmv !== undefined ? item.hasAffiliateGmv : existing.hasAffiliateGmv,
        // Chi tiết theo tab thật của TCM (PPS/Sample score/Sales/Collaboration/Video/LIVE) —
        // popup.js đã chuẩn hoá đúng shape Creator, chỉ forward nguyên object, không parse lại.
        pps: item.pps || existing.pps,
        sampleScore: item.sampleScore || existing.sampleScore,
        salesMetrics: item.salesMetrics || existing.salesMetrics,
        collabMetrics: item.collabMetrics || existing.collabMetrics,
        videoMetrics: item.videoMetrics || existing.videoMetrics,
        liveMetrics: item.liveMetrics || existing.liveMetrics,
        metricsSource: itemMetricsSource || existing.metricsSource,
        metricsSyncedAt: isTcmScrape ? nowIso : existing.metricsSyncedAt,
        importedAt: isFileImport ? nowIso : existing.importedAt,
        tcmCreatorOecuid: item.tcmCreatorOecuid || existing.tcmCreatorOecuid,
        // Tìm thấy trên TCM ở lượt sync này (có tcmCreatorOecuid) — xoá nhãn "không tìm thấy"
        // đã đánh dấu trước đó, nếu có.
        tcmNotFoundAt: item.tcmCreatorOecuid ? undefined : existing.tcmNotFoundAt,
        tags: Array.from(new Set([...(existing.tags || []), 'Scraper Enriched', source || 'Pickdi Extension'])),
        updatedAt: new Date().toISOString()
      };
      const criteria = await getCachedCriteria(updated.workspaceId);
      const breakdown = scoreCreator(updated, undefined, criteria);
      updated.scoreBreakdown = breakdown;
      updated.brandFitScore = breakdown.totalScore;
      toSave.push({ creator: updated, kind: 'updated' });
      // Ghi đè lại map ngay — nếu file import có 2 dòng trùng handle, dòng thứ 2 phải update lên
      // trên bản dòng 1 vừa build (chưa lưu DB), không phải update lên bản cũ trước khi import.
      existingByHandle.set(rawHandle.toLowerCase(), updated);
    } else {
      const newCrId = `cr-scraped-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      if (rawAvatar && typeof rawAvatar === 'string' && rawAvatar.startsWith('http')) {
        avatarJobs.push({ creatorId: newCrId, avatarUrl: rawAvatar });
      }

      // Create new creator profile from scraped data
      const newCr: Creator = {
        id: newCrId,
        source: 'scraper',
        workspaceId: targetWs,
        handle: rawHandle,
        displayName: cleanDisplayName,
        avatar: (typeof rawAvatar === 'string' && rawAvatar.startsWith('/api/avatars/')) ? rawAvatar : undefined,
        platform: 'TikTok',
        country: countryName,
        language: countryName === 'United States' || countryName === 'United Kingdom' ? 'English' : (countryName ? 'Vietnamese' : undefined),
        bio: item.bio || '',
        profileUrl: item.profileUrl || `https://tiktok.com/@${rawHandle}`,
        followers: toFiniteNumber(scrapedFollowers),
        avgViews: toFiniteNumber(scrapedAvgViews),
        engagementRate: toFiniteNumber(scrapedEngagement),
        gmv30d: toFiniteNumber(scrapedGmv),
        category: (typeof item.category === 'string' && item.category) ? item.category : undefined,
        niche: item.niche ? (Array.isArray(item.niche) ? item.niche : item.niche.split(',')) : undefined,
        brandFitScore: toFiniteNumber(item.brandFitScore),
        commercialScore: toFiniteNumber(item.commercialScore),
        riskScore: toFiniteNumber(item.riskScore),
        status: 'New Lead',
        owner: 'Anh Tuan (Scraper Bot)',
        email: item.email || item.contact_email || undefined,
        phone: item.phone || undefined,
        createdAt: new Date().toISOString(),
        tags: ['TikTok Scraped', source || 'Auto Extension', ...(countryName ? [countryName] : [])],
        notes: [],
        recentVideos: item.recentVideos || [],
        demographics: item.demographics || undefined,
        gpm: toFiniteNumber(item.gpm),
        beautyCategoryRatio: toFiniteNumber(item.beautyCategoryRatio),
        hasAffiliateGmv: item.hasAffiliateGmv,
        pps: item.pps || undefined,
        sampleScore: item.sampleScore || undefined,
        salesMetrics: item.salesMetrics || undefined,
        collabMetrics: item.collabMetrics || undefined,
        videoMetrics: item.videoMetrics || undefined,
        liveMetrics: item.liveMetrics || undefined,
        metricsSource: itemMetricsSource || (isFileImport ? 'manual' : undefined),
        metricsSyncedAt: isTcmScrape ? nowIso : undefined,
        importedAt: isFileImport ? nowIso : undefined,
        tcmCreatorOecuid: item.tcmCreatorOecuid || undefined
      };
      const criteria = await getCachedCriteria(newCr.workspaceId);
      const breakdown = scoreCreator(newCr, undefined, criteria);
      newCr.scoreBreakdown = breakdown;
      newCr.brandFitScore = breakdown.totalScore;
      toSave.push({ creator: newCr, kind: 'new' });
      existingByHandle.set(rawHandle.toLowerCase(), newCr);
    }
   } catch (err: any) {
    console.error('batch-import: failed to build one creator record:', err);
    const failedHandle = (item && (item.handle || item.nickname || item.name)) || '(unknown)';
    failedHandles.push({ handle: String(failedHandle), message: err && err.message ? String(err.message) : String(err) });
   }
  }

  // Lưu theo lô song song (thay vì 1 request Supabase tuần tự/creator) — với vài nghìn dòng,
  // tuần tự từng dòng là nguyên nhân chính khiến cả request treo lâu tới mức client timeout
  // ("Lỗi kết nối tới máy chủ") dù dữ liệu vẫn có thể ghi được. Giới hạn concurrency để không
  // dí quá nhiều request cùng lúc vào Supabase.
  const SAVE_CONCURRENCY = 25;
  for (let i = 0; i < toSave.length; i += SAVE_CONCURRENCY) {
    const chunk = toSave.slice(i, i + SAVE_CONCURRENCY);
    const results = await Promise.allSettled(chunk.map(({ creator }) => saveCreator(creator)));
    results.forEach((r, idx) => {
      const { creator, kind } = chunk[idx];
      if (r.status === 'fulfilled') {
        if (kind === 'new') importedCount++; else updatedCount++;
      } else {
        console.error('batch-import: failed to save one creator record:', r.reason);
        failedHandles.push({ handle: creator.handle, message: r.reason?.message ? String(r.reason.message) : String(r.reason) });
      }
    });
  }

  // Đã xong phần đọc existingByHandle + quyết định new/update + lưu DB (vùng race thật) — nhả
  // khoá ngay đây để request batch-import kế tiếp không phải đợi thêm phần housekeeping/response/
  // avatar download bên dưới, vốn không đụng tới existingByHandle nên không cần tuần tự hoá.
  releaseNext();

  // Best-effort housekeeping — lỗi transient ở đây không được làm sập cả response, vì import
  // chính (phần lưu DB ở trên) đã xong rồi. normalizeCreatorStoreInDb (quét lại toàn bộ bảng
  // creators) không còn chạy sau MỖI lần import nữa — quá tốn kém khi bảng đã lớn (~vài nghìn
  // dòng) và không cần chạy real-time; vẫn chạy 1 lần lúc server khởi động (xem seed ở trên).
  try {
    await addActivity('Scraper Bot', `synced ${importedCount} new & ${updatedCount} updated creators`, source || 'Pickdi Harvester', 'creator', 'batch-scrape');

    // Push notification into CRM bell list
    await saveNotification({
      id: `notif-${Date.now()}`,
      title: 'TikTok Sync Complete 🚀',
      description: `Successfully synced ${importedCount} new creators (${updatedCount} enriched) into workspace (${workspaceId || INITIAL_WORKSPACES[0]?.id})!`,
      priority: 'HIGH',
      category: 'System',
      isRead: false,
      createdAt: new Date().toISOString(),
      link: '/creators'
    });
  } catch (err: any) {
    console.error('batch-import: post-import housekeeping (normalize/activity/notification) failed:', err);
  }

  const allFailed = failedHandles.length > 0 && importedCount === 0 && updatedCount === 0;
  res.json({
    success: !allFailed,
    importedCount,
    updatedCount,
    failedCount: failedHandles.length,
    failed: failedHandles,
    totalProcessed: batchList.length,
    message: allFailed
      ? `Failed to save ${failedHandles.length} creator record(s): ${failedHandles[0].message}`
      : `Successfully processed ${batchList.length} creator records into workspace (${importedCount} new, ${updatedCount} enriched)${failedHandles.length > 0 ? `, ${failedHandles.length} failed` : ''}.`
  });

  // Background non-blocking avatar downloads
  if (avatarJobs.length > 0) {
    Promise.allSettled(
      avatarJobs.map(async ({ creatorId, avatarUrl }) => {
        const localPath = await downloadAvatar(avatarUrl, creatorId);
        if (localPath) {
          const cr = await getCreatorById(creatorId);
          if (cr) {
            cr.avatar = localPath;
            await saveCreator(cr);
          }
        }
      })
    ).then(results => {
      const failed = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      if (failed.length > 0) {
        console.error(`${failed.length}/${avatarJobs.length} avatar downloads failed during batch-import:`, failed.map(f => f.reason));
      }
    });
  }
  } catch (err: any) {
    // Lỗi thoát khỏi cả vùng đọc/lưu (ví dụ getAllCreators() ở đầu ném lỗi) — vẫn PHẢI nhả khoá,
    // nếu không mọi request batch-import sau đó (từ cả 2 hàng đợi extension) sẽ treo vĩnh viễn
    // chờ 1 request đã chết. releaseNext() an toàn gọi 2 lần (no-op nếu đã gọi ở nhánh thành công).
    releaseNext();
    console.error('batch-import: unexpected error:', err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: err?.message ? String(err.message) : String(err) });
    }
  }
});

// Extension search-cid queue (background.js processOneSearchCidItem) báo về đây khi TCM "Find
// Creators" search theo handle trả về no_match — khác batch-import (chỉ gọi khi search THÀNH
// CÔNG), route này ghi nhận thất bại để hiện nhãn cảnh báo trong CreatorListView, tránh operator
// lặp lại tìm kiếm vô ích. Không tạo creator mới — chỉ đánh dấu creator đã tồn tại trong CRM.
app.post('/api/creators/tcm-not-found', async (req, res) => {
  const { handles } = req.body;
  if (!Array.isArray(handles) || handles.length === 0) {
    return res.status(400).json({ success: false, message: 'No handles provided' });
  }

  const nowIso = new Date().toISOString();
  let markedCount = 0;
  for (const rawHandle of handles) {
    const handle = String(rawHandle || '').replace(/^@/, '').trim();
    if (!handle) continue;
    const existing = await getCreatorByHandle(handle);
    // Đã có tcmCreatorOecuid nghĩa là đã tìm thấy ở lượt khác sau lượt search này — không ghi đè
    // thành "không tìm thấy" nữa.
    if (!existing || existing.tcmCreatorOecuid) continue;
    await saveCreator({ ...existing, tcmNotFoundAt: nowIso });
    markedCount++;
  }

  res.json({ success: true, markedCount, totalProcessed: handles.length });
});

// Download the Chrome Extension source as a .zip for "Load unpacked" — team chưa đăng
// Chrome Web Store, nên đây là cách phân phối extension nhanh nhất.
app.get('/api/extension/download', (req, res) => {
  const extensionDir = path.join(process.cwd(), 'extension');
  res.attachment('pickdi-tcm-scraper.zip');
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    console.error('Extension zip error:', err);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.destroy();
    }
  });
  archive.pipe(res);
  archive.directory(extensionDir, false);
  archive.finalize();
});

// Campaigns API
app.get('/api/workspaces', async (req, res) => {
  res.json({ success: true, data: await getAllWorkspaces() });
});

app.post('/api/workspaces', async (req, res) => {
  // The client (App.tsx) resolves id/code/color locally before this call so it can use the
  // workspace synchronously (e.g. to stamp a campaign's workspaceId right away). This route
  // just persists whatever was resolved client-side, filling in defaults for anything missing.
  const WORKSPACE_COLORS = ['indigo', 'rose', 'purple', 'emerald', 'amber'] as const;
  const existingCount = (await getAllWorkspaces()).length;
  const name = req.body.name || 'New Brand Workspace';

  const newWorkspace: Workspace = {
    id: req.body.id || `ws-${Date.now()}`,
    name,
    code: req.body.code || (String(name).replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase() || 'BRND'),
    brandName: req.body.brandName || name,
    category: req.body.category || 'Brand Affiliate Program',
    logoUrl: req.body.logoUrl || undefined,
    color: WORKSPACE_COLORS.includes(req.body.color) ? req.body.color : WORKSPACE_COLORS[existingCount % WORKSPACE_COLORS.length],
    description: req.body.description || `Affiliate campaign workspace cho ${name}`,
    isAgency: Boolean(req.body.isAgency),
    memberCount: toFiniteNumber(req.body.memberCount) ?? 1,
    creatorCount: 0,
    activeCampaignCount: 0,
  };

  await saveWorkspace(newWorkspace);
  await addActivity('Anh Tuan', 'created new workspace', newWorkspace.name, 'workspace', newWorkspace.id);
  res.status(201).json({ success: true, data: newWorkspace });
});

// Dùng để sửa cấu hình workspace, hiện chủ yếu cho Sourcing Scoring Criteria trong Settings
// (xem WorkspaceScoringCriteria) — tiêu chí GMV/audience thay đổi theo thời gian nên phải
// sửa được qua UI thay vì hardcode trong scoring.ts.
app.put('/api/workspaces/:id', async (req, res) => {
  const workspace = await getWorkspaceById(req.params.id);
  if (!workspace) {
    return res.status(404).json({ success: false, message: 'Workspace not found' });
  }

  const updatedWorkspace: Workspace = { ...workspace, ...stripImmutableFields(req.body) };
  await saveWorkspace(updatedWorkspace);
  res.json({ success: true, data: updatedWorkspace });
});

app.get('/api/campaigns', async (req, res) => {
  res.json({ success: true, data: await getAllCampaigns() });
});

app.post('/api/campaigns', async (req, res) => {
  const newCampaign: Campaign = {
    id: `cmp-${Date.now()}`,
    name: req.body.name || 'New Affiliate Campaign',
    brand: req.body.brand || 'Brand Partner',
    objective: req.body.objective || 'Drive sales and product visibility on TikTok Shop.',
    description: req.body.description || '',
    budget: toFiniteNumber(req.body.budget) ?? 5000,
    spent: 0,
    currency: 'USD',
    status: req.body.status || 'Planning',
    startDate: req.body.startDate || new Date().toISOString().split('T')[0],
    endDate: req.body.endDate || new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
    owner: req.body.owner || 'Anh Tuan',
    creatorIds: [],
    targetCategories: Array.isArray(req.body.targetCategories) ? req.body.targetCategories : ['Beauty'],
    targetAudience: req.body.targetAudience || undefined,
    products: req.body.products || [],
    workspaceId: req.body.workspaceId || undefined
  };

  await saveCampaign(newCampaign);
  await addActivity('Anh Tuan', 'created new campaign', newCampaign.name, 'campaign', newCampaign.id);
  res.status(201).json({ success: true, data: newCampaign });
});

app.patch('/api/campaigns/:id', async (req, res) => {
  const campaign = await getCampaignById(req.params.id);
  if (!campaign) {
    return res.status(404).json({ success: false, message: 'Campaign not found' });
  }

  const updatedCampaign: Campaign = { ...campaign, ...stripImmutableFields(req.body) };
  await saveCampaign(updatedCampaign);
  res.json({ success: true, data: updatedCampaign });
});

app.delete('/api/campaigns/:id', async (req, res) => {
  const campaign = await archiveCampaign(req.params.id);
  if (campaign) {
    await addActivity('Anh Tuan', 'archived campaign', campaign.name, 'campaign', campaign.id);
  }
  res.json({ success: true, message: 'Campaign archived successfully' });
});

// Creator ↔ Campaign assignments — 1 creator có thể được gán vào nhiều campaign ở nhiều
// brand/workspace khác nhau cùng lúc. Đây là nguồn sự thật duy nhất cho việc "creator này
// đang chạy campaign nào ở brand nào", thay cho field campaignId đơn (đã bỏ) trên Creator.
app.get('/api/assignments', async (req, res) => {
  const { creatorId, campaignId } = req.query;
  const data = await getAllAssignments({
    creatorId: creatorId ? String(creatorId) : undefined,
    campaignId: campaignId ? String(campaignId) : undefined,
  });
  res.json({ success: true, data });
});

app.post('/api/assignments', async (req, res) => {
  const { creatorId, campaignId, status } = req.body;
  if (!creatorId || !campaignId) {
    return res.status(400).json({ success: false, message: 'creatorId và campaignId là bắt buộc' });
  }

  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }

  // Trạng thái ban đầu của 1 hợp tác mới PHẢI trung lập ('New Lead'), không được kế thừa
  // creator.status (field chung, có thể đang là 'Contacted'/'Archived' từ 1 workspace khác
  // hoàn toàn không liên quan) — nếu không sẽ tái tạo đúng lỗi leak mà cơ chế assignment
  // này được sinh ra để tránh.
  const result = await assignCreatorToCampaign(creatorId, campaignId, status || 'New Lead');
  if (!result) {
    return res.status(404).json({ success: false, message: 'Campaign not found' });
  }

  await addActivity('Anh Tuan', `assigned to campaign "${result.campaign.name}"`, `@${creator.handle}`, 'campaign', result.campaign.id);
  res.status(201).json({ success: true, data: result });
});

// Cập nhật thông tin Sourcing List (giá/hợp đồng/hạng GMV...) của 1 assignment cụ thể —
// khác với POST ở trên chỉ tạo mới/đổi status, route này chỉ sửa các trường thương mại.
app.patch('/api/assignments/:id', async (req, res) => {
  const assignment = await getAssignmentById(req.params.id);
  if (!assignment) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }

  const updated: CreatorCampaignAssignment = {
    ...assignment,
    ...stripImmutableFields(req.body, ['creatorId', 'campaignId', 'campaignName', 'workspaceId', 'assignedAt']),
  };
  await saveAssignment(updated);
  res.json({ success: true, data: updated });
});

app.delete('/api/assignments/:id', async (req, res) => {
  const campaign = await unassignCreatorFromCampaign(req.params.id);
  if (!campaign) {
    return res.status(404).json({ success: false, message: 'Assignment not found' });
  }
  res.json({ success: true, data: campaign });
});

// Settings - Email API
app.get('/api/settings/email', async (req, res) => {
  const config = await getEmailConfig();
  res.json({
    success: true,
    data: {
      email: config.email,
      imapHost: config.imapHost || '',
      imapPort: config.imapPort ?? null,
      smtpHost: config.smtpHost || '',
      smtpPort: config.smtpPort ?? null,
      brand: config.brand || '',
      product: config.product || '',
      logoUrl: config.logoUrl || '',
      primaryColor: config.primaryColor || '',
      senderName: config.senderName || DEFAULT_SENDER_NAME,
      defaultCc: config.defaultCc || '',
      hasPassword: Boolean(config.password)
    }
  });
});

app.put('/api/settings/email', async (req, res) => {
  const { email, password, imapHost, imapPort, smtpHost, smtpPort, brand, product, logoUrl, primaryColor, senderName, defaultCc } = req.body;
  if (email && (!email.includes('@') || !email.includes('.'))) {
    return res.status(400).json({ success: false, message: 'Email không hợp lệ' });
  }
  const updated = await saveEmailConfig({
    email,
    password: password || undefined,
    imapHost,
    imapPort: imapPort !== undefined && imapPort !== '' ? Number(imapPort) : undefined,
    smtpHost,
    smtpPort: smtpPort !== undefined && smtpPort !== '' ? Number(smtpPort) : undefined,
    brand,
    product,
    logoUrl,
    primaryColor,
    senderName,
    defaultCc
  });
  res.json({
    success: true,
    data: {
      email: updated.email,
      imapHost: updated.imapHost || '',
      imapPort: updated.imapPort ?? null,
      smtpHost: updated.smtpHost || '',
      smtpPort: updated.smtpPort ?? null,
      brand: updated.brand || '',
      product: updated.product || '',
      logoUrl: updated.logoUrl || '',
      primaryColor: updated.primaryColor || '',
      senderName: updated.senderName || DEFAULT_SENDER_NAME,
      defaultCc: updated.defaultCc || '',
      hasPassword: Boolean(updated.password)
    }
  });
});

// Inbox Check API
app.post('/api/inbox/check', async (req, res) => {
  try {
    const result = await checkInboxForReplies();
    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Inbox check error:', err);
    res.status(500).json({ success: false, message: 'Không thể đồng bộ hộp thư lúc này. Vui lòng kiểm tra cấu hình Email trong Cài đặt hoặc thử lại sau.' });
  }
});

// Unmatched Inbound Emails API
app.get('/api/inbox/unmatched', async (req, res) => {
  const unresolved = await getUnresolvedUnmatchedInboundEmails();
  res.json({ success: true, data: unresolved });
});

app.post('/api/inbox/unmatched/:id/assign', async (req, res) => {
  const { creatorId } = req.body;
  if (!creatorId) {
    return res.status(400).json({ success: false, message: 'Thiếu creatorId' });
  }

  const record = await getUnmatchedInboundEmailById(req.params.id);
  if (!record || record.resolved) {
    return res.status(404).json({ success: false, message: 'Email chưa xác định không tồn tại hoặc đã được xử lý' });
  }

  if (!record.candidateCreatorIds.includes(creatorId)) {
    return res.status(400).json({ success: false, message: 'creatorId không nằm trong danh sách creator ứng viên (candidateCreatorIds)' });
  }

  const creator = await getCreatorById(creatorId);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator không tồn tại' });
  }

  const currentConvs = await getAllConversations();
  let conv = currentConvs.find((c) => c.creatorId === creator.id);
  if (!conv) {
    conv = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      creatorId: creator.id,
      creatorName: creator.displayName,
      creatorHandle: creator.handle,
      creatorAvatar: creator.avatar || '',
      status: 'Need Reply',
      lastMessageAt: new Date().toISOString(),
      messages: [],
      unread: true,
    };
  }

  const newMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderType: 'CREATOR' as const,
    senderName: record.senderName || record.senderEmail || creator.displayName,
    content: record.content || '(No text content)',
    createdAt: record.receivedAt || new Date().toISOString(),
    subject: record.subject,
    messageId: record.messageId,
  };

  conv.messages.push(newMessage);
  conv.unread = true;
  conv.status = 'Need Reply';
  conv.lastMessageAt = newMessage.createdAt;
  await saveConversation(conv);

  record.resolved = true;
  await saveUnmatchedInboundEmail(record);

  await addActivity('Anh Tuan', 'manually assigned email to creator', `@${creator.handle}`, 'outreach', conv.id);
  res.json({ success: true, data: conv, message: 'Đã gán email cho creator thành công' });
});

// Outreach & Email API
app.get('/api/outreach', async (req, res) => {
  res.json({ success: true, data: await getAllOutreach() });
});

// Shared by the single-creator composer (/api/outreach/send) and the bulk-outreach send
// loop (/api/outreach/bulk/:jobId/send) — actually sends the email, then keeps every
// downstream record (outreach history, KPI, assignment status, creator.lastContactAt,
// conversation thread, activity feed) in sync exactly the same way regardless of caller.
async function deliverOutreachEmail(payload: {
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  campaignId?: string;
  campaignName?: string;
  subject: string;
  body: string;
  cc?: string;
  workspaceId?: string;
  sequenceStage?: OutreachEmail['sequenceStage'];
}): Promise<{ outreach: OutreachEmail; conversation: Conversation; assignment: any }> {
  const { creatorId, creatorName, creatorHandle, campaignId, campaignName, subject, body, cc, workspaceId } = payload;

  const cr = await getCreatorById(creatorId);
  if (!cr) throw new Error('Không tìm thấy creator trong CRM');
  if (!cr.email || !cr.email.trim()) throw new Error('Creator này chưa có email');

  // Last-line-of-defense against duplicate sends: if this exact creator+campaign+stage was
  // already sent within the last 2 minutes, refuse to send again. A legitimate manual resend
  // of the same sequence stage this soon is implausible; a race between two overlapping
  // sendNextBulkOutreachItem invocations (or a double-submitted request) landing here within
  // that window is exactly what this guards against.
  const recent = await getLatestOutreachForItem(creatorId, campaignId, payload.sequenceStage || 'first');
  if (recent?.sentAt && Date.now() - Date.parse(recent.sentAt) < 2 * 60 * 1000) {
    throw new Error(`Email này vừa được gửi cho ${creatorName} rồi (trùng lặp) — bỏ qua để tránh gửi 2 lần.`);
  }

  const emailConfig = await getEmailConfig();
  const isFirstContact = !payload.sequenceStage || payload.sequenceStage === 'first';

  // Best-effort inbox threading via In-Reply-To/References when we have a prior Message-ID
  // on file — harmless to include even when a mail client ends up starting a new thread
  // anyway, which is why reminder subjects/copy below no longer depend on it working: they
  // say "just following up" / "last chance" in plain language instead.
  const currentConvs = await getAllConversations();
  let conv = currentConvs.find((c) => c.creatorId === creatorId && (!workspaceId || c.workspaceId === workspaceId));

  const sendSubject = ensurePaidSubject(subject);
  let inReplyTo: string | undefined;
  let references: string[] | undefined;
  if (!isFirstContact && conv) {
    const messageIdChain = conv.messages.map((m) => m.messageId).filter((id): id is string => !!id);
    inReplyTo = messageIdChain[messageIdChain.length - 1];
    references = messageIdChain.length ? messageIdChain : undefined;
  }

  const ctaHref = emailConfig.email ? `mailto:${emailConfig.email}?subject=${encodeURIComponent(sendSubject)}` : undefined;

  // Reminders reuse the exact same Piedmont Ethereal layout (product card, offer, CTA) as
  // first contact — only the hero paragraph changes (via introText) to acknowledge this is
  // a follow-up instead of re-pitching from scratch, so the product stays visible/consistent
  // across the whole sequence instead of dropping to a bare-text email.
  const campaign = campaignId ? await getCampaignById(campaignId) : undefined;
  const product = campaign?.products?.[0];
  const html = renderFirstContactEmailHtml({
    creatorName,
    senderName: emailConfig.senderName || DEFAULT_SENDER_NAME,
    brandName: campaignName || emailConfig.brand,
    logoUrl: emailConfig.logoUrl,
    primaryColor: emailConfig.primaryColor,
    productName: product?.name,
    productImageUrl: product?.imageUrl,
    productUrl: product?.productUrl,
    productRating: product?.rating,
    productReviewCount: product?.reviewCount,
    productSoldCount: product?.soldCount,
    productHighlights: product?.highlights,
    compensationOffer: product?.compensationOffer,
    bodyText: isFirstContact ? body : undefined,
    introText: isFirstContact ? undefined : body,
    ctaHref,
  });

  const { messageId } = await sendEmail({ to: cr.email, cc, subject: sendSubject, text: body, html, inReplyTo, references });

  const newOutreach: OutreachEmail = {
    id: `out-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    workspaceId,
    creatorId,
    creatorName,
    creatorHandle,
    campaignId,
    campaignName,
    subject: sendSubject,
    body,
    cc,
    status: 'Sent',
    sentAt: new Date().toISOString(),
    followUpCount: 0,
    sequenceStage: payload.sequenceStage || 'first',
    messageId,
  };

  await saveOutreach(newOutreach);

  const kpis = await getKpis(INITIAL_KPIS);
  kpis.todayEmailsSent += 1;
  await setKpis(kpis);

  // "Contact lần N" là trạng thái của LẦN HỢP TÁC này (creator ↔ campaign ↔ workspace cụ thể),
  // không phải trạng thái chung của creator — nếu không, workspace khác đang chạy campaign
  // khác với cùng creator này sẽ vô tình thấy "Đã liên hệ" dù chưa từng nói chuyện.
  // Chỉ có thể ghi đúng phạm vi khi request có campaignId; nếu gửi outreach không gắn
  // campaign nào (workspace chưa có campaign) thì bỏ qua — KHÔNG fallback về ghi status
  // toàn cục nữa.
  // sequenceStage đánh dấu email này là lần liên hệ thứ mấy trong chuỗi outreach —
  // map trực tiếp sang cột Kanban tương ứng (reminder_2/3 đều dồn về "lần 3" vì board chỉ có 3 cột).
  const contactStageBySequence: Record<string, CreatorStatus> = {
    first: 'Contact lần 1',
    reminder_1: 'Contact lần 2',
    reminder_2: 'Contact lần 3',
    reminder_3: 'Contact lần 3',
  };
  const contactStage = contactStageBySequence[payload.sequenceStage || 'first'] || 'Contact lần 1';

  let updatedAssignment = null;
  if (campaignId) {
    const assignResult = await assignCreatorToCampaign(creatorId, campaignId, contactStage);
    updatedAssignment = assignResult?.assignment ?? null;
  }
  cr.lastContactAt = new Date().toISOString();
  await saveCreator(cr);

  if (!conv) {
    conv = {
      id: `conv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId,
      creatorId: cr.id,
      creatorName: creatorName,
      creatorHandle: creatorHandle,
      creatorAvatar: cr.avatar || '',
      campaignId,
      campaignName,
      status: 'Waiting Reply',
      lastMessageAt: newOutreach.sentAt,
      messages: [],
      unread: false,
    };
  }

  conv.messages.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    senderType: 'USER',
    senderName: 'Anh Tuan',
    content: body,
    createdAt: newOutreach.sentAt,
    messageId,
    inReplyTo,
    subject: sendSubject,
  });
  conv.lastMessageAt = newOutreach.sentAt;
  conv.status = 'Waiting Reply';
  conv.unread = false;
  await saveConversation(conv);

  await addActivity('Anh Tuan', 'sent outreach email', `To ${creatorName} (${creatorHandle})`, 'email', newOutreach.id);

  return { outreach: newOutreach, conversation: conv, assignment: updatedAssignment };
}

app.post('/api/outreach/send', async (req, res) => {
  try {
    const result = await deliverOutreachEmail(req.body);
    res.status(201).json({ success: true, data: result.outreach, conversation: result.conversation, assignment: result.assignment });
  } catch (err: any) {
    console.error('Send outreach error:', err);
    const notFound = err?.message === 'Không tìm thấy creator trong CRM';
    const noEmail = err?.message === 'Creator này chưa có email';
    if (notFound) return res.status(404).json({ success: false, message: err.message });
    if (noEmail) return res.status(400).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: 'Gửi email thất bại. Vui lòng kiểm tra cấu hình Email trong Cài đặt và thử lại.' });
  }
});

// --- Bulk Outreach API ---
const DEFAULT_PACING_MIN_SECONDS = 45;
const DEFAULT_PACING_MAX_SECONDS = 120;
const DEFAULT_DAILY_CAP = 80;

function daysSince(dateStr?: string): number | undefined {
  if (!dateStr) return undefined;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

// Turns a generated email body into a short "phrasing" fingerprint (its opening ~12 words)
// so the next generation call in the same batch can be told not to reuse it — cheap way to
// keep bulk drafts from converging on the same template shape.
function extractOpeningPhrasing(body: string): string {
  return body.trim().split(/\s+/).slice(0, 12).join(' ');
}

app.post('/api/outreach/bulk/generate', async (req, res) => {
  try {
    const {
      creatorIds,
      campaignId,
      sequenceStage = 'first',
      tone,
      workspaceId,
      cc,
      contentSource = 'ai',
    }: {
      creatorIds: string[];
      campaignId?: string;
      sequenceStage: SequenceStage;
      tone?: string;
      workspaceId?: string;
      cc?: string;
      contentSource?: 'ai' | 'template';
    } = req.body;

    if (!Array.isArray(creatorIds) || creatorIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Chưa chọn creator nào' });
    }

    const campaign = campaignId ? await getCampaignById(campaignId) : undefined;
    const agent = OUTREACH_SEQUENCE_AGENTS[sequenceStage] || OUTREACH_SEQUENCE_AGENTS.first;
    const allOutreach = await getAllOutreach();

    const items: BulkOutreachItem[] = [];
    const avoidPhrasings: string[] = [];

    for (const creatorId of creatorIds) {
      const cr = await getCreatorById(creatorId);
      if (!cr) continue;

      const baseItem = {
        creatorId: cr.id,
        creatorName: cr.displayName,
        creatorHandle: `@${cr.handle}`,
        email: cr.email,
      };

      if (!cr.email || !cr.email.trim()) {
        items.push({ ...baseItem, subject: '', body: '', source: 'ai', status: 'skipped_no_email', skipReason: 'Creator chưa có email' });
        continue;
      }
      if (cr.doNotContact) {
        items.push({ ...baseItem, subject: '', body: '', source: 'ai', status: 'skipped_do_not_contact', skipReason: 'Đã đánh dấu "Không liên hệ nữa"' });
        continue;
      }
      const sinceContact = daysSince(cr.lastContactAt);

      const originalOutreach = allOutreach.find(o => o.creatorId === cr.id); // most recent first (getAllOutreach is ordered desc)

      // Operator explicitly picked "use the template" — no AI call. For first-contact,
      // "the template" is the fixed Piedmont Ethereal HTML design (greeting/product/offer/
      // next-steps/signature are already baked into renderFirstContactEmailHtml — see
      // src/lib/emailTemplate.ts), so body stays empty and only the subject + per-creator
      // name/handle need filling. Reminders have no equivalent fixed HTML copy, so they
      // still mail-merge the saved text template (Settings > Mẫu Email).
      if (contentSource === 'template') {
        const filled = await fillOutreachTemplate(sequenceStage, cr, campaign);
        const body = sequenceStage === 'first' ? '' : filled.body;
        // First-contact subjects rotate through a pool of varied phrasings instead of the
        // one fixed template line — sending the same subject to every creator in a batch is
        // an easy fingerprint for spam filters to key off of.
        const subject = sequenceStage === 'first'
          ? pickRandomFirstContactSubject()
          : ensurePaidSubject(filled.subject);
        items.push({ ...baseItem, subject, body, source: 'template', status: 'draft' });
        continue;
      }

      try {
        const { data } = await runAgent(agent, {
          creator: cr,
          campaign,
          tone,
          avoidPhrasings: [...avoidPhrasings],
          originalOutreach,
          daysSinceLastContact: sinceContact,
        });
        const draftSubject = data.subject || `Collaboration Offer: ${campaign?.name || 'Partnership'}`;
        const subject = sequenceStage === 'first'
          ? pickRandomFirstContactSubject()
          : ensurePaidSubject(draftSubject);
        const body = data.body || '';
        items.push({ ...baseItem, subject, body, source: 'ai', status: 'draft' });
        avoidPhrasings.push(extractOpeningPhrasing(body));
      } catch (err: any) {
        // Every configured AI provider failed for this creator — fall back to the
        // editable mail-merge template rather than blocking the whole batch. Flagged so
        // the review UI can warn the operator before they send it.
        console.warn(`Bulk outreach: AI generation failed for creator ${cr.id}, using template fallback:`, err?.message);
        const filled = await fillOutreachTemplate(sequenceStage, cr, campaign);
        const subject = sequenceStage === 'first'
          ? pickRandomFirstContactSubject()
          : ensurePaidSubject(filled.subject);
        items.push({ ...baseItem, subject, body: filled.body, source: 'template_fallback', status: 'draft' });
      }
    }

    const job: BulkOutreachJob = {
      id: `bulk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      workspaceId,
      campaignId,
      campaignName: campaign?.name,
      sequenceStage,
      contentSource,
      cc,
      status: 'ready',
      pacingMinSeconds: DEFAULT_PACING_MIN_SECONDS,
      pacingMaxSeconds: DEFAULT_PACING_MAX_SECONDS,
      dailyCap: DEFAULT_DAILY_CAP,
      createdAt: new Date().toISOString(),
      items,
    };
    await saveBulkOutreachJob(job);
    res.status(201).json({ success: true, data: job });
  } catch (error: any) {
    await handleAiRouteError(error, res);
  }
});

app.get('/api/outreach/bulk/:jobId', async (req, res) => {
  const job = await getBulkOutreachJobById(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Không tìm thấy job' });
  maybeResumeBulkJob(job).catch(err => console.error(`Bulk outreach job ${job.id} resume-on-poll failed:`, err));
  res.json({ success: true, data: job });
});

// Edit or regenerate a single creator's draft before sending — never mutates a job whose
// send loop is already running.
app.patch('/api/outreach/bulk/:jobId/items/:creatorId', async (req, res) => {
  const job = await getBulkOutreachJobById(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Không tìm thấy job' });
  if (job.status === 'sending' || job.status === 'done') {
    return res.status(409).json({ success: false, message: 'Job đang gửi hoặc đã gửi xong, không thể sửa nữa' });
  }

  const item = job.items.find(i => i.creatorId === req.params.creatorId);
  if (!item) return res.status(404).json({ success: false, message: 'Không tìm thấy creator trong job này' });

  const { subject, body, regenerate, email } = req.body;
  let shouldRegenerate = Boolean(regenerate);

  if (typeof email === 'string' && email.trim()) {
    const cr = await getCreatorById(item.creatorId);
    if (!cr) return res.status(404).json({ success: false, message: 'Không tìm thấy creator trong CRM' });
    cr.email = email.trim();
    cr.updatedAt = new Date().toISOString();
    await saveCreator(cr);
    item.email = cr.email;
    // Was skipped for missing email, so no draft was ever generated for it — un-skip and
    // generate content now that the operator has supplied one.
    if (item.status === 'skipped_no_email') {
      item.status = 'draft';
      item.skipReason = undefined;
      shouldRegenerate = true;
    }
  }

  if (shouldRegenerate) {
    try {
      const cr = await getCreatorById(item.creatorId);
      if (!cr) return res.status(404).json({ success: false, message: 'Không tìm thấy creator trong CRM' });
      const campaign = job.campaignId ? await getCampaignById(job.campaignId) : undefined;

      if (job.contentSource === 'template') {
        // Job was generated from the saved template — "Viết lại" here means re-fill it
        // (e.g. after the operator edited the item and wants to revert to the template,
        // or after they updated the saved template in Settings), not switch to AI. Same
        // first-contact-stays-empty rule as the initial generate loop above.
        const filled = await fillOutreachTemplate(job.sequenceStage, cr, campaign);
        item.subject = job.sequenceStage === 'first'
          ? pickRandomFirstContactSubject()
          : ensurePaidSubject(filled.subject);
        item.body = job.sequenceStage === 'first' ? '' : filled.body;
        item.source = 'template';
      } else {
        const agent = OUTREACH_SEQUENCE_AGENTS[job.sequenceStage] || OUTREACH_SEQUENCE_AGENTS.first;
        const avoidPhrasings = job.items
          .filter(i => i.creatorId !== item.creatorId && i.body)
          .map(i => extractOpeningPhrasing(i.body));
        const allOutreach = await getAllOutreach();
        const originalOutreach = allOutreach.find(o => o.creatorId === cr.id);

        const { data } = await runAgent(agent, {
          creator: cr,
          campaign,
          avoidPhrasings,
          originalOutreach,
          daysSinceLastContact: daysSince(cr.lastContactAt),
        });
        const draftSubject = data.subject || item.subject;
        item.subject = job.sequenceStage === 'first'
          ? pickRandomFirstContactSubject()
          : ensurePaidSubject(draftSubject);
        item.body = data.body || item.body;
        item.source = 'ai';
      }
    } catch (error: any) {
      return await handleAiRouteError(error, res);
    }
  } else {
    if (subject !== undefined) item.subject = subject;
    if (body !== undefined) item.body = body;
  }

  await saveBulkOutreachJob(job);
  res.json({ success: true, data: job });
});

// Sends the next 'draft' item in a bulk-outreach job, then paces the following send.
// On Vercel there's no long-lived process between requests, so pacing is done via a
// delayed Upstash QStash message that calls POST /api/outreach/bulk/:jobId/send-next
// again after a random delay. When QStash isn't configured (local dev), this falls back
// to the old in-process setTimeout + recursive-call chain so local dev keeps working.
// SMTP steps are capped at 20s each (src/lib/mailer.ts); this leaves generous headroom for
// the DB round trips in deliverOutreachEmail plus the persist step's retries below.
const STALE_SENDING_MS = 3 * 60 * 1000;

// deliverOutreachEmail makes several sequential Supabase calls that have no network timeout
// of their own — a stalled one would otherwise hang the `await` forever without throwing, so
// the try/catch around it never fires and the item sits at 'sending' until the staleness
// sweep above catches it minutes later. Racing a hard timeout turns that hang into a normal
// caught failure right away.
const DELIVER_OUTREACH_TIMEOUT_MS = 60 * 1000;
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      err => { clearTimeout(timer); reject(err); },
    );
  });
}

async function sendNextBulkOutreachItem(jobId: string) {
  const job = await getBulkOutreachJobById(jobId);
  if (!job || job.status !== 'sending') return;

  // Claim an exclusive short-lived lock before doing any real work — the QStash callback,
  // the local setTimeout fallback, and the resume-on-poll check (see maybeResumeBulkJob)
  // can all fire for the same job around the same moment. Losing this race just means
  // another caller is already handling this job's next item; that's expected, not an error.
  const claimedLock = await tryClaimBulkOutreachSendLock(job);
  if (!claimedLock) return;
  job.sendLockUntil = claimedLock;

  const kpis = await getKpis(INITIAL_KPIS);
  if (kpis.todayEmailsSent >= job.dailyCap) {
    // 'paused_cap', not 'done' — items left as draft still need to go out once the
    // operator raises dailyCap and resumes; 'done' would permanently block /send (see the
    // 409 guard below) and strand them.
    console.warn(`Bulk outreach job ${jobId}: daily cap (${job.dailyCap}) reached, pausing — remaining items left as draft.`);
    job.status = 'paused_cap';
    job.sendLockUntil = undefined;
    await saveBulkOutreachJob(job);
    return;
  }

  // Reclaim items stranded in 'sending': the persist step below (freshJob re-fetch + save)
  // can throw and get its error swallowed by a .catch(console.error) caller, or
  // deliverOutreachEmail can hang indefinitely on an un-timeout'd Supabase call — either way
  // the item never reaches a terminal status and no other code path ever looks for 'sending'
  // items again (every resume path only searches for 'draft'). SMTP itself is capped at 20s
  // per step (src/lib/mailer.ts), so anything still 'sending' after STALE_SENDING_MS is
  // certainly stuck, not just slow.
  const staleCutoff = Date.now() - STALE_SENDING_MS;
  const staleItems = job.items.filter(i => i.status === 'sending' && i.sendingSince && Date.parse(i.sendingSince) < staleCutoff);
  if (staleItems.length) {
    for (const stale of staleItems) {
      stale.status = 'failed';
      stale.error = 'Gửi bị treo quá lâu, đã tự động đánh dấu thất bại';
    }
    await saveBulkOutreachJob(job);
  }

  const item = job.items.find(i => i.status === 'draft');
  if (!item) {
    job.status = 'done';
    job.sendLockUntil = undefined;
    await saveBulkOutreachJob(job);
    return;
  }

  item.status = 'sending';
  item.sendingSince = new Date().toISOString();
  await saveBulkOutreachJob(job);

  let itemUpdate: Partial<typeof item>;
  try {
    const result = await withTimeout(deliverOutreachEmail({
      creatorId: item.creatorId,
      creatorName: item.creatorName,
      creatorHandle: item.creatorHandle,
      campaignId: job.campaignId,
      campaignName: job.campaignName,
      subject: item.subject,
      body: item.body,
      cc: job.cc,
      workspaceId: job.workspaceId,
      sequenceStage: job.sequenceStage,
    }), DELIVER_OUTREACH_TIMEOUT_MS, 'Gửi bị treo quá lâu (timeout)');
    itemUpdate = { status: 'sent', sentAt: result.outreach.sentAt, outreachId: result.outreach.id };
  } catch (err: any) {
    itemUpdate = { status: 'failed', error: err?.message || 'Gửi thất bại' };
  }

  const pacingSeconds = Math.round(job.pacingMinSeconds + Math.random() * (job.pacingMaxSeconds - job.pacingMinSeconds));

  // deliverOutreachEmail above (live SMTP send + several sequential DB round trips) can run
  // long enough for another sendNextBulkOutreachItem invocation to have advanced this job in
  // the meantime (lock expiry, or the poll-driven resume fallback). Re-fetch the job fresh
  // and merge just this item's update onto it instead of writing back the stale in-memory
  // `job` snapshot read at the top of this call — a blind full-row save here was the root
  // cause of duplicate sends: it would revert a concurrently-processed item back to 'draft',
  // making a later invocation pick it up and send it again.
  // A transient Supabase blip here used to strand the item at 'sending' forever — nothing
  // ever revisits an item once it's off 'draft', and the caller only logs-and-swallows a
  // thrown error. Retry a few times before giving up; the staleness reclaim above is the
  // backstop if every attempt fails.
  let persisted = false;
  for (let attempt = 1; attempt <= 3 && !persisted; attempt++) {
    try {
      const freshJob = await getBulkOutreachJobById(jobId);
      if (!freshJob) return;
      const freshItem = freshJob.items.find(i => i.creatorId === item.creatorId && i.status === 'sending');
      if (freshItem) {
        Object.assign(freshItem, itemUpdate);
      } else {
        console.error(`Bulk outreach job ${jobId}: item for ${item.creatorId} was no longer 'sending' on re-fetch — skipping merge to avoid clobbering a concurrent update.`);
      }
      // Marks when the next item is due and releases the lock — the resume-on-poll fallback
      // (maybeResumeBulkJob) uses nextSendAt to tell "still pacing normally" apart from "the
      // scheduled continuation never fired" once this deadline passes.
      freshJob.nextSendAt = new Date(Date.now() + pacingSeconds * 1000).toISOString();
      freshJob.sendLockUntil = undefined;
      await saveBulkOutreachJob(freshJob);
      persisted = true;
    } catch (err) {
      console.error(`Bulk outreach job ${jobId}: attempt ${attempt} to persist result for ${item.creatorId} failed:`, err);
      if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
  if (!persisted) {
    console.error(`Bulk outreach job ${jobId}: giving up persisting result for ${item.creatorId} after 3 attempts — will be reclaimed as stale once STALE_SENDING_MS elapses.`);
    return;
  }

  if (qstashClient) {
    await qstashClient.publishJSON({
      url: `${publicAppUrl()}/api/outreach/bulk/${jobId}/send-next`,
      body: {},
      delay: pacingSeconds,
    });
  } else {
    // Local dev fallback without QStash configured — keep the old in-process pacing loop.
    // Fire-and-forget from the caller's perspective; errors are logged, not thrown.
    setTimeout(() => {
      sendNextBulkOutreachItem(jobId).catch(err => console.error(`Bulk outreach job ${jobId} crashed:`, err));
    }, pacingSeconds * 1000);
  }
}

// Fallback for when QStash isn't configured (e.g. deployed to Vercel without it): the
// in-process setTimeout above is lost whenever the serverless function instance that set it
// gets torn down, silently stranding the job on its first item forever ("Đang chờ" with no
// progress). Called from spots the operator's browser hits anyway (bulk job polling,
// dashboard load) so a stalled job self-heals the next time anyone is looking at the app,
// without needing a real background worker. No-op once QStash is configured — that path's
// own retry/delivery guarantees make this unnecessary.
async function maybeResumeBulkJob(job: BulkOutreachJob) {
  if (qstashClient) return;
  if (job.status !== 'sending') return;
  if (!job.nextSendAt || Date.parse(job.nextSendAt) > Date.now()) return;
  try {
    sendNextBulkOutreachItem(job.id).catch(err => console.error(`Bulk outreach job ${job.id} resume crashed:`, err));
  } catch (err) {
    console.error(`Bulk outreach job ${job.id} resume check failed:`, err);
  }
}

// Verified via Upstash's signature when QStash keys are configured; Express already parses
// the body globally as JSON, so JSON.stringify(req.body) is a best-effort reconstruction of
// what QStash actually signed rather than the true raw bytes — acceptable for our purposes,
// but note this isn't byte-exact. Skip verification entirely when qstashReceiver isn't
// configured (QStash not in use in this environment).
app.post('/api/outreach/bulk/:jobId/send-next', async (req, res) => {
  if (qstashReceiver) {
    try {
      await qstashReceiver.verify({
        signature: req.headers['upstash-signature'] as string,
        body: JSON.stringify(req.body),
      });
    } catch (err) {
      console.error('QStash signature verification failed:', err);
      return res.status(401).json({ success: false, message: 'Invalid QStash signature' });
    }
  }

  await sendNextBulkOutreachItem(req.params.jobId);
  res.json({ success: true });
});

app.post('/api/outreach/bulk/:jobId/send', async (req, res) => {
  const job = await getBulkOutreachJobById(req.params.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'Không tìm thấy job' });
  if (job.status === 'sending' || job.status === 'done') {
    return res.status(409).json({ success: false, message: 'Job này đã gửi hoặc đang gửi rồi' });
  }

  const { pacingMinSeconds, pacingMaxSeconds, dailyCap, cc } = req.body || {};
  if (typeof pacingMinSeconds === 'number' && pacingMinSeconds > 0) job.pacingMinSeconds = pacingMinSeconds;
  if (typeof pacingMaxSeconds === 'number' && pacingMaxSeconds > 0) job.pacingMaxSeconds = pacingMaxSeconds;
  if (typeof dailyCap === 'number' && dailyCap > 0) job.dailyCap = dailyCap;
  if (typeof cc === 'string') job.cc = cc;
  job.status = 'sending';
  await saveBulkOutreachJob(job);

  sendNextBulkOutreachItem(job.id).catch(err => console.error(`Bulk outreach job ${job.id} crashed:`, err));

  res.status(202).json({ success: true, data: job });
});

// --- AI Provider Config API (Settings > AI Providers) ---
app.get('/api/settings/ai-providers', async (req, res) => {
  const config = await getAiConfig();
  res.json({
    success: true,
    data: {
      providers: config.providers.map(p => ({
        provider: p.provider,
        model: p.model,
        enabled: p.enabled,
        hasApiKey: Boolean(p.apiKey),
      })),
    },
  });
});

app.put('/api/settings/ai-providers', async (req, res) => {
  const { providers } = req.body as { providers: { provider: AiProviderName; apiKey?: string; model?: string; enabled: boolean }[] };
  if (!Array.isArray(providers)) {
    return res.status(400).json({ success: false, message: 'providers phải là 1 danh sách' });
  }

  const current = (await getAiConfig()).providers;
  const updated = providers.map(p => {
    const existing = current.find(c => c.provider === p.provider);
    return {
      provider: p.provider,
      // Keep the existing stored key when the client sends a blank one back (same pattern
      // as Gmail app-password editing) — never let a masked-display round trip wipe it out.
      apiKey: p.apiKey && p.apiKey.trim() !== '' ? p.apiKey : (existing?.apiKey || ''),
      model: p.model || existing?.model || defaultModelFor(p.provider),
      enabled: Boolean(p.enabled),
    };
  });
  await saveAiConfig(updated);

  res.json({
    success: true,
    data: {
      providers: updated.map(p => ({ provider: p.provider, model: p.model, enabled: p.enabled, hasApiKey: Boolean(p.apiKey) })),
    },
  });
});

// --- Outreach Template Fallback API (Settings > Outreach Templates) ---
app.get('/api/settings/outreach-templates', async (req, res) => {
  res.json({ success: true, data: await getOutreachTemplates() });
});

app.put('/api/settings/outreach-templates', async (req, res) => {
  const templates = req.body;
  if (!templates || typeof templates !== 'object') {
    return res.status(400).json({ success: false, message: 'Dữ liệu mẫu không hợp lệ' });
  }
  const updated = await saveOutreachTemplates({ ...(await getOutreachTemplates()), ...templates });
  res.json({ success: true, data: updated });
});

// Conversations API
app.get('/api/conversations', async (req, res) => {
  res.json({ success: true, data: await getAllConversations() });
});

app.post('/api/conversations/:id/reply', async (req, res) => {
  const conv = await getConversationById(req.params.id);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  const cr = await getCreatorById(conv.creatorId);
  if (!cr || !cr.email || !cr.email.trim()) {
    return res.status(400).json({ success: false, message: 'Creator này chưa có email' });
  }

  const content = req.body.content;
  if (!content || !content.trim()) {
    return res.status(400).json({ success: false, message: 'Nội dung tin nhắn không được rỗng' });
  }

  let replySubject = 'Re: Collaborate with Pickdi';
  const lastMsgWithSubject = [...conv.messages].reverse().find(m => m.subject);
  if (lastMsgWithSubject && lastMsgWithSubject.subject) {
    replySubject = lastMsgWithSubject.subject.startsWith('Re:') ? lastMsgWithSubject.subject : `Re: ${lastMsgWithSubject.subject}`;
  } else {
    const outreachList = (await getAllOutreach()).filter(o => o.creatorId === conv.creatorId);
    if (outreachList.length > 0 && outreachList[0].subject) {
      replySubject = outreachList[0].subject.startsWith('Re:') ? outreachList[0].subject : `Re: ${outreachList[0].subject}`;
    }
  }

  const messageIdChain = conv.messages.map(m => m.messageId).filter((id): id is string => !!id);
  const inReplyTo = messageIdChain[messageIdChain.length - 1];
  const references = messageIdChain.length ? messageIdChain : undefined;

  try {
    const { messageId } = await sendEmail({
      to: cr.email,
      subject: replySubject,
      text: content,
      inReplyTo,
      references
    });

    const newMessage = {
      id: `msg-${Date.now()}`,
      senderType: req.body.senderType || 'USER',
      senderName: req.body.senderName || 'Anh Tuan',
      content,
      isAiGenerated: req.body.isAiGenerated || false,
      createdAt: new Date().toISOString(),
      messageId,
      inReplyTo,
      subject: replySubject
    };

    conv.messages.push(newMessage as any);
    conv.lastMessageAt = new Date().toISOString();
    conv.status = 'Waiting Reply';
    conv.unread = false;

    await saveConversation(conv);
    await addActivity('Anh Tuan', 'sent reply message', `To ${conv.creatorName}`, 'outreach', conv.id);
    res.json({ success: true, data: conv });
  } catch (err: any) {
    console.error('Send reply error:', err);
    res.status(500).json({ success: false, message: 'Gửi phản hồi thất bại. Vui lòng kiểm tra cấu hình email và thử lại.' });
  }
});

// Content Reviews API
app.get('/api/reviews', async (req, res) => {
  res.json({ success: true, data: await getAllReviews() });
});

app.patch('/api/reviews/:id', async (req, res) => {
  const rev = await getReviewById(req.params.id);
  if (!rev) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  rev.status = req.body.status;
  if (req.body.feedback) rev.feedback = req.body.feedback;
  if (req.body.checklist) rev.checklist = req.body.checklist;

  await saveReview(rev);
  await addActivity('Anh Tuan', `marked draft review as ${req.body.status}`, `${rev.creatorName} - ${rev.videoTitle}`, 'review', rev.id);
  res.json({ success: true, data: rev });
});

// Posted Videos API — bảng "Uploaded" trong file d'Alba, video đã đăng chính thức + ROI.
app.get('/api/posted-videos', async (req, res) => {
  res.json({ success: true, data: await getAllPostedVideos() });
});

app.post('/api/posted-videos', async (req, res) => {
  const { creatorId, creatorName, creatorHandle, campaignId, campaignName, videoUrl } = req.body;
  if (!creatorId || !campaignId || !videoUrl) {
    return res.status(400).json({ success: false, message: 'creatorId, campaignId và videoUrl là bắt buộc' });
  }

  const newVideo: PostedVideo = {
    id: `pv-${Date.now()}`,
    workspaceId: req.body.workspaceId,
    reviewId: req.body.reviewId,
    creatorId,
    creatorName,
    creatorHandle,
    campaignId,
    campaignName,
    round: req.body.round,
    pricePerVideo: toFiniteNumber(req.body.pricePerVideo),
    paid: req.body.paid,
    postedAt: req.body.postedAt || new Date().toISOString(),
    videoUrl,
    videoId: req.body.videoId,
    adCode: req.body.adCode,
    roi: toFiniteNumber(req.body.roi),
    totalRevenue: toFiniteNumber(req.body.totalRevenue),
    totalOrders: toFiniteNumber(req.body.totalOrders),
    totalAdSpend: toFiniteNumber(req.body.totalAdSpend),
  };

  await savePostedVideo(newVideo);
  await addActivity('Anh Tuan', 'marked video as posted', `${newVideo.creatorName} - ${newVideo.campaignName}`, 'campaign', newVideo.id);
  res.status(201).json({ success: true, data: newVideo });
});

app.patch('/api/posted-videos/:id', async (req, res) => {
  const video = await getPostedVideoById(req.params.id);
  if (!video) {
    return res.status(404).json({ success: false, message: 'Posted video not found' });
  }

  const updated: PostedVideo = {
    ...video,
    ...stripImmutableFields(req.body, ['creatorId', 'campaignId', 'workspaceId', 'reviewId']),
  };
  await savePostedVideo(updated);
  res.json({ success: true, data: updated });
});

// Tasks API
app.get('/api/tasks', async (req, res) => {
  res.json({ success: true, data: await getAllTasks() });
});

app.post('/api/tasks', async (req, res) => {
  const newTask: Task = {
    id: `tsk-${Date.now()}`,
    title: req.body.title,
    description: req.body.description || '',
    priority: req.body.priority || 'MEDIUM',
    status: 'Pending',
    dueDate: req.body.dueDate || new Date().toISOString().split('T')[0],
    owner: req.body.owner || 'Anh Tuan',
    relatedCreatorId: req.body.relatedCreatorId,
    relatedCreatorName: req.body.relatedCreatorName,
    relatedCampaignId: req.body.relatedCampaignId,
    relatedCampaignName: req.body.relatedCampaignName,
    createdAt: new Date().toISOString()
  };

  await saveTask(newTask);
  await addActivity('Anh Tuan', 'created task', newTask.title, 'task', newTask.id);
  res.status(201).json({ success: true, data: newTask });
});

app.patch('/api/tasks/:id', async (req, res) => {
  const task = await getTaskById(req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  const updatedTask: Task = { ...task, ...stripImmutableFields(req.body) };
  await saveTask(updatedTask);
  res.json({ success: true, data: updatedTask });
});

// Notifications API
app.get('/api/notifications', async (req, res) => {
  res.json({ success: true, data: await getAllNotifications() });
});

app.patch('/api/notifications/read-all', async (req, res) => {
  await markAllNotificationsRead();
  res.json({ success: true, message: 'All notifications marked as read' });
});

// Search API
app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').toString();
  const data = await searchAll(q);
  res.json({ success: true, data });
});

// Deterministic Brand-Fit Scoring
// Sourcing criteria (GMV tier target, gpm/gender/beauty/avgViews band) sống ở
// Workspace.scoringCriteria (cấu hình trong Settings), không hardcode trong scoring.ts —
// ưu tiên workspace của campaign (brand đang chạy) rồi mới tới workspace gốc của creator.
async function getScoringCriteria(creator: Creator, campaign: Campaign | undefined) {
  const workspaceId = campaign?.workspaceId || creator.workspaceId;
  if (!workspaceId) return undefined;
  const workspace = await getWorkspaceById(workspaceId);
  return workspace?.scoringCriteria;
}

async function applyScore(creator: Creator, campaign: Campaign | undefined) {
  const criteria = await getScoringCriteria(creator, campaign);
  const breakdown = scoreCreator(creator, campaign, criteria);
  if (campaign) {
    const entry = { campaignId: campaign.id, breakdown, scoredAt: new Date().toISOString() };
    creator.campaignScores = [...(creator.campaignScores || []).filter((s: any) => s.campaignId !== campaign.id), entry];
  } else {
    creator.scoreBreakdown = breakdown;
    creator.brandFitScore = breakdown.totalScore;
  }
  creator.updatedAt = new Date().toISOString();
  await saveCreator(creator);
  return breakdown;
}

app.post('/api/creators/:id/score', async (req, res) => {
  const creator = await getCreatorById(req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }
  const campaignId = req.body.campaignId as string | undefined;
  const campaign = campaignId ? await getCampaignById(campaignId) : undefined;
  if (campaignId && !campaign) {
    return res.status(404).json({ success: false, message: 'Campaign not found' });
  }

  const breakdown = await applyScore(creator, campaign);
  await addActivity('Anh Tuan', campaign ? `scored creator for campaign "${campaign.name}"` : 'scored creator (baseline)', `@${creator.handle}`, 'creator', creator.id);
  res.json({ success: true, data: { creator, breakdown } });
});

// Deterministic fallback summary — used when GEMINI_API_KEY isn't configured or the LLM
// call fails, so the drawer still shows something useful instead of erroring out.
function buildDeterministicResearchSummary(breakdown: ReturnType<typeof scoreCreator>) {
  const summary = breakdown.groups
    .filter(g => g.available)
    .map(g => `${g.label}: ${g.scorePct}/100`)
    .join('. ') || 'Not enough scraped data to evaluate this creator yet.';

  return {
    summary,
    strengths: breakdown.strengths.length ? breakdown.strengths : ['Chưa có đủ chỉ số lượt xem/follower để xác định thế mạnh'],
    weaknesses: breakdown.weaknesses,
    brandFitScore: breakdown.totalScore,
    recommendation: breakdown.recommendation,
    reasoning: breakdown.riskFlags.length ? `Cảnh báo rủi ro: ${breakdown.riskFlags.join('; ')}` : 'Không phát hiện rủi ro bất thường.',
    breakdown,
    source: 'deterministic' as const,
  };
}

// Runs the deterministic scoreCreator() (unchanged — the score itself is never decided by
// the LLM), then hands the breakdown + bio/tags/notes to creator.deep_research so the
// "AI Research" button gives an actual reasoned judgment instead of just restating scores.
app.post('/api/ai/research', async (req, res) => {
  const { creator: creatorInput, campaignId } = req.body;
  const creator = creatorInput?.id ? ((await getCreatorById(creatorInput.id)) || creatorInput) : creatorInput;
  const campaign = campaignId ? await getCampaignById(campaignId) : undefined;

  const stored = creator?.id ? await getCreatorById(creator.id) : null;
  const breakdown = stored ? await applyScore(stored, campaign) : scoreCreator(creator, campaign, await getScoringCriteria(creator, campaign));

  try {
    const { data } = await runAgent(creatorDeepResearchAgent, { creator, campaign, breakdown });
    res.json({
      success: true,
      data: {
        summary: data.reasoning,
        strengths: Array.isArray(data.opportunities) && data.opportunities.length ? data.opportunities : breakdown.strengths,
        weaknesses: Array.isArray(data.risks) && data.risks.length ? data.risks : breakdown.weaknesses,
        brandFitScore: breakdown.totalScore,
        recommendation: data.recommendation || breakdown.recommendation,
        reasoning: data.reasoning,
        breakdown,
        source: 'ai',
      },
    });
  } catch (error: any) {
    console.warn('creator.deep_research agent failed, using deterministic fallback:', error?.message);
    res.json({ success: true, data: buildDeterministicResearchSummary(breakdown) });
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { prompt, messages, creatorId, campaignId } = req.body;
    const creator = creatorId ? await getCreatorById(creatorId) : null;
    const campaign = campaignId ? await getCampaignById(campaignId) : null;

    const text = await runTextAgent(copilotChatAgent, {
      prompt,
      messages,
      creator,
      campaign,
      totalCreators: await getCreatorsCount(),
      totalCampaigns: (await getAllCampaigns()).length,
    });

    res.json({ success: true, text: text || 'Không có phản hồi từ Gemini.' });
  } catch (error: any) {
    await handleAiRouteError(error, res);
  }
});

// Generates the FIRST-CONTACT outreach email. Reminder emails (2nd/3rd follow-up) are
// handled by /api/ai/outreach-agent, which picks the right agent by sequence stage.
app.post('/api/ai/email', async (req, res) => {
  try {
    const { creator: creatorInput, campaign, tone = 'friendly and professional' } = req.body;
    // creatorInput có thể là bản đã trim cột (từ list state client) — nạp lại full row từ DB để
    // agent có đủ niche/recentVideos cho creatorLine()/recentContentLine(), fallback về input gốc
    // nếu không tìm thấy (vd creator chưa lưu DB).
    const creator = creatorInput?.id ? ((await getCreatorById(creatorInput.id)) || creatorInput) : creatorInput;
    const { data, cached } = await runAgent(OUTREACH_SEQUENCE_AGENTS.first, { creator, campaign, tone });
    // First-contact subject rotates through a pool of varied phrasings rather than
    // whatever the AI picks — keeps subjects diverse across creators, avoiding the
    // identical-subject spam fingerprint.
    res.json({ success: true, data: { ...data, subject: pickRandomFirstContactSubject(), cached } });
  } catch (error: any) {
    await handleAiRouteError(error, res);
  }
});

// Picks the right outreach agent (first contact / reminder 1 / 2 / 3) for an existing
// OutreachEmail record based on its sequenceStage.
app.post('/api/ai/outreach-agent', async (req, res) => {
  try {
    const { outreachId, creator: creatorInput, campaign, tone } = req.body;
    // Cùng lý do refetch như /api/ai/email — creatorInput có thể là bản list đã trim cột.
    const creator = creatorInput?.id ? ((await getCreatorById(creatorInput.id)) || creatorInput) : creatorInput;
    const outreach = outreachId ? (await getAllOutreach()).find(o => o.id === outreachId) : undefined;
    const stage = outreach?.sequenceStage || 'first';
    const agent = OUTREACH_SEQUENCE_AGENTS[stage] || OUTREACH_SEQUENCE_AGENTS.first;

    const daysSinceLastContact = outreach?.sentAt
      ? Math.floor((Date.now() - new Date(outreach.sentAt).getTime()) / 86400000)
      : undefined;

    const { data, cached } = await runAgent(agent, {
      creator,
      campaign,
      tone,
      originalOutreach: outreach,
      daysSinceLastContact,
    });
    res.json({ success: true, data: { ...data, cached, agentUsed: agent.id } });
  } catch (error: any) {
    await handleAiRouteError(error, res);
  }
});

app.post('/api/ai/reply', async (req, res) => {
  try {
    const { conversation, creator, campaign } = req.body;
    const { data, cached } = await runAgent(negotiationReplyAgent, { conversation, creator, campaign });
    res.json({ success: true, data: { ...data, cached } });
  } catch (error: any) {
    await handleAiRouteError(error, res);
  }
});

app.post('/api/ai/review', async (req, res) => {
  try {
    const { videoTitle, campaignName, draftUrl } = req.body;
    const { data } = await runAgent(reviewComplianceChecklistAgent, { videoTitle, campaignName, draftUrl });
    data.analysisScope = 'metadata-only';
    res.json({ success: true, data });
  } catch (error: any) {
    await handleAiRouteError(error, res);
  }
});

// workspaceId có thể rỗng (workspace Agency, xem toàn bộ) — nếu có, chỉ giữ lại các bản ghi
// thuộc đúng workspace đó, cùng logic với `inActiveWorkspace` ở App.tsx phía client, để banner
// AI trên Dashboard không gợi ý dựa trên dữ liệu của workspace khác.
const scopedToWorkspace = <T extends { workspaceId?: string }>(items: T[], workspaceId?: string): T[] =>
  workspaceId ? items.filter(item => !item.workspaceId || item.workspaceId === workspaceId) : items;

app.post('/api/ai/daily-summary', async (req, res) => {
  const { workspaceId } = req.body || {};
  const kpis = await getKpis(INITIAL_KPIS);
  const reviews = scopedToWorkspace(await getAllReviews(), workspaceId);
  const tasks = scopedToWorkspace(await getAllTasks(), workspaceId);

  try {
    const { data } = await runAgent(opsDailySummaryAgent, {
      todayEmailsSent: kpis.todayEmailsSent,
      todayRepliesReceived: kpis.todayRepliesReceived,
      pendingReviewsCount: reviews.filter(r => r.status === 'Pending Review').length,
      pendingTasksCount: tasks.filter(t => t.status !== 'Completed').length,
    });
    res.json({ success: true, data: { ...data, source: 'ai' } });
  } catch (error: any) {
    console.warn('AI Daily Summary call failed or missing API key, using deterministic fallback:', error?.message);
    const fallbackData = buildDeterministicDailySummary(kpis, reviews, tasks);
    res.json({ success: true, data: fallbackData });
  }
});

// Replaces the previously-hardcoded dashboard "AI Recommendation" banner (which just
// printed a canned string around recentReplies[0]) with a real judgment call over
// everything currently open — campaigns, stale conversations, pending reviews, tasks.
app.post('/api/ai/priority-suggestion', async (req, res) => {
  const { workspaceId } = req.body || {};
  const campaigns = scopedToWorkspace(await getAllCampaigns(), workspaceId).filter(c => c.status !== 'Completed' && c.status !== 'Archived');
  const conversations = scopedToWorkspace(await getAllConversations(), workspaceId).filter(c => c.status !== 'Completed');
  const reviews = scopedToWorkspace(await getAllReviews(), workspaceId).filter(r => r.status === 'Pending Review');
  const tasks = scopedToWorkspace(await getAllTasks(), workspaceId).filter(t => t.status !== 'Completed');

  const openCampaigns = campaigns.map(c => ({ name: c.name, status: c.status, creatorCount: c.creatorIds?.length || 0 }));
  const staleConversations = conversations.map(c => ({
    creatorName: c.creatorName,
    status: c.status,
    daysSinceLastMessage: Math.floor((Date.now() - new Date(c.lastMessageAt).getTime()) / 86400000),
  }));
  const pendingReviews = reviews.map(r => ({ creatorName: r.creatorName, videoTitle: r.videoTitle, dueAt: r.dueAt }));
  const overdueTasks = tasks.map(t => ({ title: t.title, priority: t.priority, dueDate: t.dueDate }));

  try {
    const { data } = await runAgent(opsPrioritySuggesterAgent, { openCampaigns, staleConversations, pendingReviews, overdueTasks });
    res.json({ success: true, data: { ...data, source: 'ai' } });
  } catch (error: any) {
    console.warn('ops.priority_suggester agent failed, using deterministic fallback:', error?.message);
    const noOpenItems = openCampaigns.length === 0 && staleConversations.length === 0 && pendingReviews.length === 0 && overdueTasks.length === 0;
    res.json({
      success: true,
      data: {
        priorityAction: noOpenItems
          ? 'Không có việc gì khẩn cấp — tiếp tục tìm kiếm và liên hệ thêm creator mới.'
          : pendingReviews.length > 0
            ? `Ưu tiên duyệt ${pendingReviews.length} draft video đang chờ.`
            : overdueTasks.length > 0
              ? `Ưu tiên xử lý ${overdueTasks.length} công việc tồn đọng.`
              : `Theo dõi ${staleConversations.length} cuộc trò chuyện đang chờ phản hồi.`,
        reasoning: 'Đề xuất theo số lượng việc tồn đọng (fallback không dùng AI).',
        secondaryActions: [],
        source: 'deterministic',
      },
    });
  }
});

// ==========================================
// AGENT PROMPT STUDIO — operator-editable "how to behave" instructions per agent
// ==========================================

// List every trained agent + whether it currently has a custom (operator-saved) prompt.
app.get('/api/agent-prompts', async (req, res) => {
  const data = await Promise.all(Object.values(AGENT_REGISTRY).map(async (agent) => {
    const override = await getAgentPromptOverride(agent.id);
    return {
      id: agent.id,
      label: agent.label,
      defaultInstructions: agent.defaultInstructions,
      customInstructions: override ?? null,
      isCustom: override !== undefined,
    };
  }));
  res.json({ success: true, data });
});

app.put('/api/agent-prompts/:agentId', async (req, res) => {
  const agent = AGENT_REGISTRY[req.params.agentId];
  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }
  const { customInstructions } = req.body;
  if (typeof customInstructions !== 'string' || !customInstructions.trim()) {
    return res.status(400).json({ success: false, message: 'customInstructions không được để trống' });
  }
  await saveAgentPromptOverride(agent.id, customInstructions);
  await addActivity('Anh Tuan', 'customized agent prompt', agent.label, 'agent-prompt', agent.id);
  res.json({ success: true, data: { id: agent.id, customInstructions, isCustom: true } });
});

app.delete('/api/agent-prompts/:agentId', async (req, res) => {
  const agent = AGENT_REGISTRY[req.params.agentId];
  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }
  await deleteAgentPromptOverride(agent.id);
  await addActivity('Anh Tuan', 'reset agent prompt to default', agent.label, 'agent-prompt', agent.id);
  res.json({ success: true, data: { id: agent.id, defaultInstructions: agent.defaultInstructions, isCustom: false } });
});

// Builds reasonable sample data (from whatever is actually in the CRM) so the Test button
// works with zero setup — the operator can still pass their own `context` in the body.
async function buildSampleAgentContext(agentId: string) {
  const [creator, totalCreatorsCount, campaigns, conversations, outreachList] = await Promise.all([
    getFirstCreator(),
    getCreatorsCount(),
    getAllCampaigns(),
    getAllConversations(),
    getAllOutreach(),
  ]);
  const campaign = campaigns[0];
  const conversation = conversations[0];
  const outreach = outreachList[0];

  switch (agentId) {
    case 'outreach.first_contact':
    case 'outreach.reminder_1':
    case 'outreach.reminder_2':
    case 'outreach.reminder_3':
      return {
        creator: creator || { displayName: 'Sample Creator', handle: 'samplecreator', country: 'Vietnam', category: 'Beauty' },
        campaign: campaign || { name: 'Sample Campaign', brand: 'Pickdi', objective: 'Drive TikTok Shop sales' },
        tone: 'friendly and professional',
        originalOutreach: outreach,
        daysSinceLastContact: 3,
      };
    case 'negotiation.reply':
      return {
        conversation: conversation || { messages: [{ senderName: 'Creator', senderType: 'CREATOR', content: 'Rate của mình là 500k/video được không ạ?' }] },
        creator: creator || { displayName: 'Sample Creator', handle: 'samplecreator' },
        campaign: campaign || { budget: 5000 },
      };
    case 'creator.deep_research': {
      const c = creator || { displayName: 'Sample Creator', handle: 'samplecreator', bio: 'Beauty & lifestyle content creator', tags: ['Beauty'], notes: [] } as any;
      const breakdown = scoreCreator(c, campaign);
      return { creator: c, campaign, breakdown };
    }
    case 'review.compliance_checklist':
      return { videoTitle: 'Unbox sản phẩm mới #ad', campaignName: campaign?.name || 'Sample Campaign', draftUrl: 'https://tiktok.com/@sample/video/123' };
    case 'ops.daily_summary':
      return { todayEmailsSent: 12, todayRepliesReceived: 3, pendingReviewsCount: 2, pendingTasksCount: 5 };
    case 'ops.priority_suggester':
      return {
        openCampaigns: campaign ? [{ name: campaign.name, status: campaign.status, creatorCount: campaign.creatorIds?.length || 0 }] : [],
        staleConversations: conversation ? [{ creatorName: conversation.creatorName, status: conversation.status, daysSinceLastMessage: 2 }] : [],
        pendingReviews: [],
        overdueTasks: [],
      };
    case 'ops.copilot_chat':
      return {
        prompt: 'Creator này có phù hợp với campaign hiện tại không?',
        messages: [],
        creator,
        campaign,
        totalCreators: totalCreatorsCount,
        totalCampaigns: campaigns.length,
      };
    default:
      return {};
  }
}

// Runs an agent with a DRAFT instructions string (not yet saved) so the operator can preview
// output before committing an edit in the Agent Prompt Studio UI.
app.post('/api/agent-prompts/:agentId/test', async (req, res) => {
  const agent = AGENT_REGISTRY[req.params.agentId];
  if (!agent) {
    return res.status(404).json({ success: false, message: 'Agent not found' });
  }
  const { customInstructions, context } = req.body;
  if (typeof customInstructions !== 'string' || !customInstructions.trim()) {
    return res.status(400).json({ success: false, message: 'customInstructions không được để trống' });
  }

  const ctx = context && typeof context === 'object' ? context : await buildSampleAgentContext(agent.id);

  try {
    if (agent.id === copilotChatAgent.id) {
      const text = await runTextAgent(copilotChatAgent, ctx, customInstructions);
      return res.json({ success: true, data: { text } });
    }
    const { data } = await runAgent(agent, ctx, customInstructions);
    res.json({ success: true, data });
  } catch (error: any) {
    await handleAiRouteError(error, res);
  }
});

// Last middleware in the chain — catches anything forwarded via next(err), including the
// async rejections the wrapper above now routes here, so a failure returns a JSON 500
// instead of crashing the whole function.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled route error:', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, message: err?.message || 'Internal server error' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Dynamic import so `vite` (and the rollup native binary it pulls in) is only ever
    // loaded for local dev — this whole branch is already unreachable on Vercel (guarded by
    // `!process.env.VERCEL` below), but a static top-level import would still eagerly load
    // vite's module graph in the serverless bundle and crash on the missing native binary.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    // Traditional long-lived-process production (e.g. `npm run build && npm start`).
    // On Vercel the static frontend is served by the platform and this Express app only
    // ever runs as the API serverless function — see api/index.ts and vercel.json.
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (!process.env.VERCEL) {
  startServer();
}

export default app;
