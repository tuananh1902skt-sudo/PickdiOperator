import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { ZipArchive } from 'archiver';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  INITIAL_CREATORS,
  INITIAL_CAMPAIGNS,
  INITIAL_OUTREACH,
  INITIAL_CONVERSATIONS,
  INITIAL_REVIEWS,
  INITIAL_TASKS,
  INITIAL_NOTIFICATIONS,
  INITIAL_ACTIVITIES,
  INITIAL_KPIS
} from './src/data/initialData';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable CORS only for the TikTok One scraper extension and local dev origins —
// the batch-import/update-detail routes come from a content script on tiktok.com.
const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?tiktok\.com$/, /^https:\/\/ads\.tiktok\.com$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.some(re => re.test(origin))) {
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

// In-memory data store for the session
let creators = [...INITIAL_CREATORS];
let campaigns = [...INITIAL_CAMPAIGNS];
let outreachList = [...INITIAL_OUTREACH];
let conversations = [...INITIAL_CONVERSATIONS];
let reviews = [...INITIAL_REVIEWS];
let tasks = [...INITIAL_TASKS];
let notifications = [...INITIAL_NOTIFICATIONS];
let activities = [...INITIAL_ACTIVITIES];
let kpis = { ...INITIAL_KPIS };

const GEMINI_MODEL = 'gemini-3.6-flash';

// Initialize Gemini Client server-side lazily / securely
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY process environment variable is not configured.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
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

// Log activity helper
function addActivity(actor: string, action: string, target: string, entityType: any, entityId: string) {
  const newActivity = {
    id: `act-${Date.now()}`,
    actor,
    action,
    target,
    entityType,
    entityId,
    timestamp: new Date().toISOString(),
  };
  activities.unshift(newActivity);
}

// Purge invalid handles and normalize display names — run once at startup and after
// any bulk write, not as a side effect of a read.
function normalizeCreatorStore() {
  creators = creators.filter(c => isValidCreatorHandle(c.handle));
  creators.forEach(c => {
    c.displayName = sanitizeCreatorDisplayName(c.displayName, c.handle);
  });
}
normalizeCreatorStore();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Dashboard & KPIs
app.get('/api/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      kpis,
      tasks: tasks.filter(t => t.status !== 'Completed').slice(0, 5),
      notifications: notifications.slice(0, 5),
      activities: activities.slice(0, 8),
      recentReplies: conversations.filter(c => c.unread || c.status === 'Negotiating').slice(0, 5),
      creatorsByStatus: {
        NewLead: creators.filter(c => c.status === 'New Lead').length,
        Researching: creators.filter(c => c.status === 'Researching').length,
        Qualified: creators.filter(c => c.status === 'Qualified').length,
        Contacted: creators.filter(c => c.status === 'Contacted').length,
        Negotiating: creators.filter(c => c.status === 'Negotiating').length,
        Approved: creators.filter(c => c.status === 'Approved').length,
        DraftSubmitted: creators.filter(c => c.status === 'Draft Submitted').length,
        Completed: creators.filter(c => c.status === 'Completed').length,
      }
    }
  });
});

// Creators API
app.get('/api/creators', (req, res) => {
  const { keyword, status, country, category, search } = req.query;
  let filtered = [...creators];

  const q = (search || keyword || '').toString().toLowerCase().trim();
  if (q) {
    filtered = filtered.filter(
      c =>
        c.displayName.toLowerCase().includes(q) ||
        c.handle.toLowerCase().includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.niche || []).some((n: string) => n.toLowerCase().includes(q)) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }

  if (status && status !== 'ALL') {
    filtered = filtered.filter(c => c.status === status);
  }

  if (country && country !== 'ALL') {
    filtered = filtered.filter(c => c.country === country);
  }

  if (category && category !== 'ALL') {
    filtered = filtered.filter(c => c.category === category);
  }

  res.json({ success: true, data: filtered, meta: { total: filtered.length } });
});

app.get('/api/creators/:id', (req, res) => {
  const creator = creators.find(c => c.id === req.params.id);
  if (!creator) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }
  res.json({ success: true, data: creator });
});

app.post('/api/creators', (req, res) => {
  const handle = req.body.handle?.replace(/^@/, '').trim();
  if (!isValidCreatorHandle(handle)) {
    return res.status(400).json({ success: false, message: 'A valid TikTok handle is required' });
  }

  const newCreator: any = {
    id: `cr-${Date.now()}`,
    source: 'manual',
    handle,
    displayName: req.body.displayName || handle,
    avatar: req.body.avatar || undefined,
    platform: req.body.platform || 'TikTok',
    country: req.body.country || undefined,
    language: req.body.language || undefined,
    bio: req.body.bio || '',
    profileUrl: req.body.profileUrl || `https://tiktok.com/@${handle}`,
    followers: req.body.followers !== undefined && req.body.followers !== '' ? Number(req.body.followers) : undefined,
    avgViews: req.body.avgViews !== undefined && req.body.avgViews !== '' ? Number(req.body.avgViews) : undefined,
    engagementRate: req.body.engagementRate !== undefined && req.body.engagementRate !== '' ? Number(req.body.engagementRate) : undefined,
    category: req.body.category || undefined,
    niche: Array.isArray(req.body.niche) ? req.body.niche : undefined,
    brandFitScore: req.body.brandFitScore !== undefined ? Number(req.body.brandFitScore) : undefined,
    commercialScore: req.body.commercialScore !== undefined ? Number(req.body.commercialScore) : undefined,
    riskScore: req.body.riskScore !== undefined ? Number(req.body.riskScore) : undefined,
    status: req.body.status || 'New Lead',
    owner: req.body.owner || 'Anh Tuan',
    email: req.body.email || undefined,
    phone: req.body.phone || undefined,
    rateCard: req.body.rateCard || undefined,
    createdAt: new Date().toISOString(),
    tags: Array.isArray(req.body.tags) ? req.body.tags : ['New Creator'],
    notes: req.body.notes ? [{ id: `n-${Date.now()}`, author: 'Anh Tuan', content: req.body.notes, createdAt: new Date().toISOString() }] : []
  };

  creators.unshift(newCreator);
  addActivity('Anh Tuan', 'created creator profile', `@${newCreator.handle}`, 'creator', newCreator.id);

  res.status(201).json({ success: true, data: newCreator });
});

app.patch('/api/creators/:id', (req, res) => {
  const index = creators.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Creator not found' });
  }

  const prevStatus = creators[index].status;
  creators[index] = { ...creators[index], ...req.body, updatedAt: new Date().toISOString() };

  if (req.body.status && req.body.status !== prevStatus) {
    addActivity('Anh Tuan', `updated status to ${req.body.status}`, `@${creators[index].handle}`, 'creator', creators[index].id);
  }

  res.json({ success: true, data: creators[index] });
});

app.delete('/api/creators/:id', (req, res) => {
  const creator = creators.find(c => c.id === req.params.id);
  if (creator) {
    creator.status = 'Archived';
    addActivity('Anh Tuan', 'archived creator', `@${creator.handle}`, 'creator', creator.id);
  }
  res.json({ success: true, message: 'Creator archived successfully' });
});

// ==========================================
// ZERO-COST TIKTOK SCRAPER ENGINE ROUTES
// ==========================================

// 1. Webhook Endpoint for Extension & Scraper Script Sync
app.post('/api/creators/batch-import', (req, res) => {
  const { workspaceId, source, region, creators: batchList } = req.body;
  if (!Array.isArray(batchList) || batchList.length === 0) {
    return res.status(400).json({ success: false, message: 'No valid creators provided in batch payload' });
  }

  let importedCount = 0;
  let updatedCount = 0;

  batchList.forEach((item: any) => {
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

    if (!isValidCreatorHandle(rawHandle)) return;

    const existingIndex = creators.findIndex(c => c.handle.toLowerCase() === rawHandle.toLowerCase());

    const targetWs = workspaceId || 'ws-dalba';
    const countryName = item.country || region || (rawHandle.includes('_us') ? 'United States' : rawHandle.includes('_uk') ? 'United Kingdom' : 'Vietnam');

    const scrapedTiktokOneId = item.tiktokOneId || item.creator_id || item.creator_o_id || item.star_id || item.user_id || undefined;
    const cleanDisplayName = sanitizeCreatorDisplayName(item.displayName || item.nickname || item.name || rawHandle, rawHandle);

    const scrapedFollowers = item.followers ?? item.follower_cnt ?? item.follower_count;
    const scrapedAvgViews = item.avgViews ?? item.avg_video_views ?? item.median_views;
    const scrapedEngagement = item.engagementRate ?? item.engagement ?? item.engagement_rate;
    const scrapedGmv = item.gmv30d ?? item.e_commerce_gmv ?? item.gmv;

    if (existingIndex >= 0) {
      // Enrich existing profile with scraped stats — only overwrite when the scraper actually found a value
      const existing = creators[existingIndex];
      creators[existingIndex] = {
        ...existing,
        workspaceId: targetWs,
        displayName: sanitizeCreatorDisplayName(existing.displayName, rawHandle),
        avatar: item.avatar || item.avatar_thumb || item.head_url || existing.avatar,
        tiktokOneId: scrapedTiktokOneId || existing.tiktokOneId,
        followers: scrapedFollowers !== undefined ? Number(scrapedFollowers) : existing.followers,
        avgViews: scrapedAvgViews !== undefined ? Number(scrapedAvgViews) : existing.avgViews,
        engagementRate: scrapedEngagement !== undefined ? Number(scrapedEngagement) : existing.engagementRate,
        gmv30d: scrapedGmv !== undefined ? Number(scrapedGmv) : existing.gmv30d,
        email: item.email || item.contact_email || existing.email,
        bio: item.bio || existing.bio,
        recentVideos: (item.recentVideos && item.recentVideos.length > 0) ? item.recentVideos : existing.recentVideos,
        demographics: item.demographics || existing.demographics,
        scores: item.scores || existing.scores,
        followerGrowthRate: item.followerGrowthRate || existing.followerGrowthRate,
        postingFrequency30d: item.postingFrequency30d || existing.postingFrequency30d,
        tags: Array.from(new Set([...(existing.tags || []), 'Scraper Enriched', source || 'Pickdi Extension'])),
        updatedAt: new Date().toISOString()
      };
      updatedCount++;
    } else {
      // Create new creator profile from scraped data — leave a field undefined if the scraper didn't find it,
      // never invent a placeholder number/email that would look like real data.
      const newCr: any = {
        id: `cr-scraped-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        source: 'scraper',
        workspaceId: targetWs,
        handle: rawHandle,
        displayName: cleanDisplayName,
        avatar: item.avatar || item.avatar_thumb || item.head_url || undefined,
        platform: 'TikTok',
        country: countryName,
        language: countryName === 'United States' || countryName === 'United Kingdom' ? 'English' : 'Vietnamese',
        bio: item.bio || undefined,
        profileUrl: item.profileUrl || `https://tiktok.com/@${rawHandle}`,
        tiktokOneId: scrapedTiktokOneId,
        followers: scrapedFollowers !== undefined ? Number(scrapedFollowers) : undefined,
        avgViews: scrapedAvgViews !== undefined ? Number(scrapedAvgViews) : undefined,
        engagementRate: scrapedEngagement !== undefined ? Number(scrapedEngagement) : undefined,
        gmv30d: scrapedGmv !== undefined ? Number(scrapedGmv) : undefined,
        category: item.category || undefined,
        niche: item.niche ? (Array.isArray(item.niche) ? item.niche : item.niche.split(',')) : undefined,
        brandFitScore: item.brandFitScore !== undefined ? Number(item.brandFitScore) : undefined,
        commercialScore: item.commercialScore !== undefined ? Number(item.commercialScore) : undefined,
        riskScore: item.riskScore !== undefined ? Number(item.riskScore) : undefined,
        status: 'New Lead',
        owner: 'Anh Tuan (Scraper Bot)',
        email: item.email || item.contact_email || undefined,
        phone: item.phone || undefined,
        createdAt: new Date().toISOString(),
        tags: ['TikTok Scraped', source || 'Auto Extension', countryName],
        notes: [],
        recentVideos: item.recentVideos || [],
        demographics: item.demographics || undefined,
        scores: item.scores || undefined
      };
      creators.unshift(newCr);
      importedCount++;
    }
  });

  normalizeCreatorStore();
  addActivity('Scraper Bot', `synced ${importedCount} new & ${updatedCount} updated creators`, source || 'Pickdi Harvester', 'creator', 'batch-scrape');

  // Push notification into CRM bell list
  notifications.unshift({
    id: `notif-${Date.now()}`,
    title: 'TikTok Sync Complete 🚀',
    description: `Successfully synced ${importedCount} new creators (${updatedCount} enriched) into workspace (${workspaceId || 'ws-dalba'})!`,
    priority: 'HIGH',
    category: 'System',
    isRead: false,
    createdAt: new Date().toISOString(),
    link: '/creators'
  } as any);

  res.json({
    success: true,
    importedCount,
    updatedCount,
    totalProcessed: batchList.length,
    message: `Successfully processed ${batchList.length} creator records into workspace (${importedCount} new, ${updatedCount} enriched).`
  });
});

// TikTok One Detail Page Update Endpoint — chỉ set field khi extension thực sự scrape
// được giá trị; field nào scrape không ra thì bỏ qua, KHÔNG đè bằng số/hằng số bịa và
// KHÔNG xoá mất giá trị thật đã lưu trước đó.
app.post('/api/creators/update-detail', (req, res) => {
  const { handle, tiktokOneId, detail } = req.body;
  if (!handle && !tiktokOneId) {
    return res.status(400).json({ status: 'error', message: 'Thiếu handle hoặc tiktokOneId' });
  }

  const cleanHandle = (handle || '').replace(/^@/, '').toLowerCase().trim();
  const creator = creators.find(c =>
    (cleanHandle && c.handle.toLowerCase() === cleanHandle) ||
    (tiktokOneId && c.tiktokOneId === tiktokOneId)
  );

  if (!creator) {
    return res.status(404).json({ status: 'error', message: `Không tìm thấy creator @${handle} trong CRM` });
  }

  if (tiktokOneId) creator.tiktokOneId = tiktokOneId;

  if (detail) {
    if (detail.videoContentTag) creator.videoContentTag = detail.videoContentTag;
    if (detail.industryTag) creator.industryTag = detail.industryTag;
    if (detail.languagesSpoken) creator.language = detail.languagesSpoken;
    if (detail.followerGrowthRate) creator.followerGrowthRate = detail.followerGrowthRate;
    if (detail.postingFrequencyPer30Days != null) creator.postingFrequency30d = detail.postingFrequencyPer30Days;

    if (detail.collabScore != null || detail.collabBroadcasting != null || detail.collabDiligence != null || detail.collabCommercial != null) {
      creator.scores = {
        ...creator.scores,
        ...(detail.collabScore != null ? { overall: detail.collabScore } : {}),
        ...(detail.collabBroadcasting != null ? { broadcasting: detail.collabBroadcasting } : {}),
        ...(detail.collabDiligence != null ? { diligence: detail.collabDiligence } : {}),
        ...(detail.collabCommercial != null ? { commercial: detail.collabCommercial } : {})
      };
    }

    if (detail.medianViews) creator.medianViews = detail.medianViews;
    if (detail.medianViewsBenchmark) creator.medianViewsBenchmark = detail.medianViewsBenchmark;
    if (detail.sixSecondViewRate) creator.sixSecondViewRate = detail.sixSecondViewRate;
    if (detail.sixSecondViewRateBenchmark) creator.sixSecondViewRateBenchmark = detail.sixSecondViewRateBenchmark;
    if (detail.engagementRateContent) creator.engagementRate = parseFloat(detail.engagementRateContent) || creator.engagementRate;
    if (detail.engagementRateBenchmark) creator.engagementRateBenchmark = detail.engagementRateBenchmark;
    if (detail.responseRate) creator.responseRate = detail.responseRate;
    if (detail.brandedVideosCount != null) creator.brandedVideosCount = detail.brandedVideosCount;
    if (detail.industryCoveredCount != null) creator.industryCoveredCount = detail.industryCoveredCount;

    if (detail.audienceTopGender || detail.audienceTopAgeRange || detail.audienceTopCountry) {
      creator.demographics = {
        ...creator.demographics,
        ...(detail.audienceTopAgeRange ? { topAgeGroup: detail.audienceTopAgeRange } : {}),
        ...(detail.audienceTopCountry ? { topCountry: detail.audienceTopCountry } : {})
      };
    }

    creator.updatedAt = new Date().toISOString();
  }

  addActivity('TikTok One Extension', `updated detail metrics for @${creator.handle}`, `@${creator.handle}`, 'creator', creator.id);

  res.json({ status: 'ok', creator });
});

// TikTok Profile Engagement Update Endpoint — pure passthrough/computed từ số liệu scrape thật,
// không có fallback bịa.
app.post('/api/creators/update-engagement', (req, res) => {
  const { handle, avatarUrl, bio, email, instagram, engagement } = req.body;
  if (!handle) {
    return res.status(400).json({ status: 'error', message: 'Thiếu handle' });
  }

  const cleanHandle = handle.replace(/^@/, '').toLowerCase().trim();
  const creator = creators.find(c => c.handle.toLowerCase() === cleanHandle);

  if (!creator) {
    return res.status(404).json({ status: 'error', message: `Không tìm thấy creator @${handle} trong CRM` });
  }

  if (avatarUrl) creator.avatar = avatarUrl;
  if (bio) creator.bio = bio;
  if (email) creator.email = email;
  if (instagram) creator.instagram = instagram;

  if (engagement) {
    if (engagement.avgViews) creator.avgViews = engagement.avgViews;
    if (engagement.maxMinRatio) creator.maxMinRatio = engagement.maxMinRatio;
    if (engagement.lastVideoDate) creator.lastVideoDate = engagement.lastVideoDate;
    if (engagement.postingFrequency) creator.postingFrequency30d = Math.round(engagement.postingFrequency * 4);
    if (engagement.erView) creator.engagementRate = engagement.erView;
    if (engagement.erFollower) creator.erFollower = engagement.erFollower;

    creator.updatedAt = new Date().toISOString();
  }

  addActivity('TikTok Extension', `updated engagement metrics for @${creator.handle}`, `@${creator.handle}`, 'creator', creator.id);

  res.json({ status: 'ok', creator });
});

// Download the Chrome Extension source as a .zip for "Load unpacked" — team chưa đăng
// Chrome Web Store, nên đây là cách phân phối extension nhanh nhất.
app.get('/api/extension/download', (req, res) => {
  const extensionDir = path.join(process.cwd(), 'extension');
  res.attachment('pickdi-tiktok-one-scraper.zip');
  const archive = new ZipArchive({ zlib: { level: 9 } });
  archive.on('error', (err: Error) => {
    console.error('Extension zip error:', err);
    res.status(500).end();
  });
  archive.pipe(res);
  archive.directory(extensionDir, false);
  archive.finalize();
});

// Campaigns API
app.get('/api/campaigns', (req, res) => {
  res.json({ success: true, data: campaigns });
});

app.post('/api/campaigns', (req, res) => {
  const newCampaign = {
    id: `cmp-${Date.now()}`,
    name: req.body.name || 'New Affiliate Campaign',
    brand: req.body.brand || 'Brand Partner',
    objective: req.body.objective || 'Drive sales and product visibility on TikTok Shop.',
    description: req.body.description || '',
    budget: Number(req.body.budget) || 5000,
    spent: 0,
    currency: 'USD',
    status: req.body.status || 'Planning',
    startDate: req.body.startDate || new Date().toISOString().split('T')[0],
    endDate: req.body.endDate || new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
    owner: req.body.owner || 'Anh Tuan',
    creatorIds: [],
    targetCategories: Array.isArray(req.body.targetCategories) ? req.body.targetCategories : ['Beauty'],
    products: req.body.products || []
  };

  campaigns.unshift(newCampaign as any);
  addActivity('Anh Tuan', 'created new campaign', newCampaign.name, 'campaign', newCampaign.id);
  res.status(201).json({ success: true, data: newCampaign });
});

app.patch('/api/campaigns/:id', (req, res) => {
  const index = campaigns.findIndex(c => c.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Campaign not found' });
  }

  campaigns[index] = { ...campaigns[index], ...req.body };
  res.json({ success: true, data: campaigns[index] });
});

// Outreach & Email API
app.get('/api/outreach', (req, res) => {
  res.json({ success: true, data: outreachList });
});

app.post('/api/outreach/send', (req, res) => {
  const { creatorId, creatorName, creatorHandle, campaignId, campaignName, subject, body } = req.body;

  const newOutreach = {
    id: `out-${Date.now()}`,
    creatorId,
    creatorName,
    creatorHandle,
    campaignId,
    campaignName,
    subject,
    body,
    status: 'Sent',
    sentAt: new Date().toISOString(),
    followUpCount: 0
  };

  outreachList.unshift(newOutreach as any);
  kpis.todayEmailsSent += 1;

  // Update creator status to Contacted
  const cr = creators.find(c => c.id === creatorId);
  if (cr && cr.status === 'Qualified') {
    cr.status = 'Contacted';
    cr.lastContactAt = new Date().toISOString();
  }

  addActivity('Anh Tuan', 'sent outreach email', `To ${creatorName} (${creatorHandle})`, 'email', newOutreach.id);
  res.status(201).json({ success: true, data: newOutreach });
});

// Conversations API
app.get('/api/conversations', (req, res) => {
  res.json({ success: true, data: conversations });
});

app.post('/api/conversations/:id/reply', (req, res) => {
  const conv = conversations.find(c => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ success: false, message: 'Conversation not found' });
  }

  const newMessage = {
    id: `msg-${Date.now()}`,
    senderType: req.body.senderType || 'USER',
    senderName: req.body.senderName || 'Anh Tuan',
    content: req.body.content,
    isAiGenerated: req.body.isAiGenerated || false,
    createdAt: new Date().toISOString()
  };

  conv.messages.push(newMessage as any);
  conv.lastMessageAt = new Date().toISOString();
  conv.unread = false;

  addActivity('Anh Tuan', 'sent reply message', `To ${conv.creatorName}`, 'outreach', conv.id);
  res.json({ success: true, data: conv });
});

// Content Reviews API
app.get('/api/reviews', (req, res) => {
  res.json({ success: true, data: reviews });
});

app.patch('/api/reviews/:id', (req, res) => {
  const rev = reviews.find(r => r.id === req.params.id);
  if (!rev) {
    return res.status(404).json({ success: false, message: 'Review not found' });
  }

  rev.status = req.body.status;
  if (req.body.feedback) rev.feedback = req.body.feedback;

  addActivity('Anh Tuan', `marked draft review as ${req.body.status}`, `${rev.creatorName} - ${rev.videoTitle}`, 'review', rev.id);
  res.json({ success: true, data: rev });
});

// Tasks API
app.get('/api/tasks', (req, res) => {
  res.json({ success: true, data: tasks });
});

app.post('/api/tasks', (req, res) => {
  const newTask = {
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

  tasks.unshift(newTask as any);
  addActivity('Anh Tuan', 'created task', newTask.title, 'task', newTask.id);
  res.status(201).json({ success: true, data: newTask });
});

app.patch('/api/tasks/:id', (req, res) => {
  const task = tasks.find(t => t.id === req.params.id);
  if (!task) {
    return res.status(404).json({ success: false, message: 'Task not found' });
  }

  Object.assign(task, req.body);
  res.json({ success: true, data: task });
});

// Notifications API
app.get('/api/notifications', (req, res) => {
  res.json({ success: true, data: notifications });
});

app.patch('/api/notifications/read-all', (req, res) => {
  notifications.forEach(n => (n.isRead = true));
  res.json({ success: true, message: 'All notifications marked as read' });
});

// Search API
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toString().toLowerCase().trim();
  if (!q) {
    return res.json({ success: true, data: { creators: [], campaigns: [], tasks: [] } });
  }

  const matchedCreators = creators.filter(
    c => c.displayName.toLowerCase().includes(q) || c.handle.toLowerCase().includes(q) || (c.category || '').toLowerCase().includes(q)
  );
  const matchedCampaigns = campaigns.filter(c => c.name.toLowerCase().includes(q) || c.brand.toLowerCase().includes(q));
  const matchedTasks = tasks.filter(t => t.title.toLowerCase().includes(q));

  res.json({
    success: true,
    data: {
      creators: matchedCreators.slice(0, 5),
      campaigns: matchedCampaigns.slice(0, 5),
      tasks: matchedTasks.slice(0, 5)
    }
  });
});

// Gemini AI Endpoints (Server-side)
app.post('/api/ai/research', async (req, res) => {
  try {
    const { creator } = req.body;
    const ai = getGenAI();

    const prompt = `You are an expert TikTok Shop Affiliate Operator AI Assistant. Analyze this creator profile and generate a structured evaluation report in JSON format:
Creator Data:
- Handle: @${creator.handle}
- Display Name: ${creator.displayName}
- Category: ${creator.category}
- Followers: ${creator.followers}
- Avg Views: ${creator.avgViews}
- Engagement Rate: ${creator.engagementRate}%
- Bio: "${creator.bio}"
- Country: ${creator.country}

Provide output with JSON schema:
{
  "summary": "2-3 concise sentences summarizing suitability for beauty/skincare TikTok shop campaigns",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["point 1", "point 2"],
  "brandFitScore": number (0-100),
  "commercialScore": number (0-100),
  "riskScore": number (0-100),
  "recommendation": "Priority A - Immediate Outreach" | "Priority B - Recommended" | "Priority C - Optional" | "Not Recommended",
  "reasoning": "Detailed justification"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('AI Research Error:', error);
    res.status(500).json({ success: false, message: error.message || 'AI Research generation failed.' });
  }
});

app.post('/api/ai/email', async (req, res) => {
  try {
    const { creator, campaign, tone = 'friendly and professional' } = req.body;
    const ai = getGenAI();

    const prompt = `Generate a high-converting TikTok Shop Affiliate outreach email.
Creator Name: ${creator.displayName} (@${creator.handle})
Category: ${creator.category}
Campaign: ${campaign.name}
Brand: ${campaign.brand}
Objective: ${campaign.objective}
Product: ${campaign.products?.[0]?.name || 'Beauty Product Sample'}

RULES & CONVENTIONS:
1. ALWAYS lead with the commission structure and gifted product offer clearly ("Lead with commission" rule).
2. Keep the tone ${tone}, warm, authentic, and concise.
3. Language: Match creator country (${creator.country === 'Vietnam' ? 'Vietnamese' : 'English'}).
4. Output strict JSON:
{
  "subject": "Subject line string",
  "body": "Full email text formatted with line breaks",
  "cta": "Single clear call to action statement",
  "followUpSuggestion": "Suggested follow-up reminder note in 3 days"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('AI Email Error:', error);
    res.status(500).json({ success: false, message: error.message || 'AI Email generation failed.' });
  }
});

app.post('/api/ai/reply', async (req, res) => {
  try {
    const { conversation, creator, campaign } = req.body;
    const ai = getGenAI();

    const messagesText = conversation.messages
      .map((m: any) => `${m.senderName} (${m.senderType}): ${m.content}`)
      .join('\n');

    const prompt = `You are an Affiliate Negotiation Specialist. Suggest an optimal reply to this creator's latest message.

Creator: ${creator.displayName} (@${creator.handle})
Campaign Budget: $${campaign.budget}
Latest Thread:
${messagesText}

Instructions:
1. Analyze rate asks or conditions.
2. Provide a polite counter-negotiation or acceptance.
3. Output strict JSON:
{
  "suggestedReply": "The text reply ready to send",
  "negotiationStrategy": "Short explanation of the negotiation rationale",
  "suggestedNextAction": "Assign Campaign" | "Counter Offer" | "Request Shipping Address" | "Close Deal"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('AI Reply Error:', error);
    res.status(500).json({ success: false, message: error.message || 'AI Reply generation failed.' });
  }
});

app.post('/api/ai/review', async (req, res) => {
  try {
    const { videoTitle, campaignName, draftUrl } = req.body;
    const ai = getGenAI();

    const prompt = `Analyze this draft video submission for TikTok Shop compliance & hook power.
Title: ${videoTitle}
Campaign: ${campaignName}

Generate review score and checklist evaluation in JSON format:
{
  "hookQualityScore": number (0-100),
  "productVisibilityScore": number (0-100),
  "compliancePass": boolean,
  "keyObservations": ["Observation 1", "Observation 2"],
  "improvementSuggestions": "Actionable feedback string for creator",
  "recommendation": "APPROVED" | "REVISION_REQUIRED" | "REJECTED"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('AI Review Error:', error);
    res.status(500).json({ success: false, message: error.message || 'AI Review generation failed.' });
  }
});

app.post('/api/ai/daily-summary', async (req, res) => {
  try {
    const ai = getGenAI();
    const prompt = `Summarize today's TikTok Shop Affiliate Operations digest:
Emails Sent: ${kpis.todayEmailsSent}
Replies Received: ${kpis.todayRepliesReceived}
Pending Reviews: ${reviews.filter(r => r.status === 'Pending Review').length}
Pending Tasks: ${tasks.filter(t => t.status !== 'Completed').length}

Generate a executive daily summary in JSON:
{
  "progressSummary": "2 sentence summary of today's key wins",
  "urgentPriorities": ["Urgent task 1", "Urgent task 2"],
  "aiRecommendation": "Strategic recommendation for tomorrow's outreach focus"
}`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('AI Daily Summary Error:', error);
    res.status(500).json({ success: false, message: error.message || 'AI Summary failed.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
