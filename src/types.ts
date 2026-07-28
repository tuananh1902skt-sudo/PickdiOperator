export type CreatorStatus =
  | 'New Lead'
  | 'Researching'
  | 'Qualified'
  | 'Contacted'
  | 'Interested'
  | 'Negotiating'
  | 'Approved'
  | 'Sample Sent'
  | 'Draft Submitted'
  | 'Revision Requested'
  | 'Approved Draft'
  | 'Posted'
  | 'Completed'
  | 'Archived';

export type CampaignStatus = 'Planning' | 'Recruiting' | 'Running' | 'Completed' | 'Archived';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TaskStatus = 'Pending' | 'Completed';

export type NotificationPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface Workspace {
  id: string;
  name: string;
  code: string; // e.g. "DALBA", "2AN", "PICKDI"
  brandName: string;
  category: string;
  logoUrl?: string;
  color: 'indigo' | 'rose' | 'purple' | 'emerald' | 'amber';
  description: string;
  isAgency?: boolean;
  memberCount?: number;
  creatorCount?: number;
  activeCampaignCount?: number;
  isMock?: boolean;
}

export interface CreatorVideo {
  id: string;
  title: string;
  views?: string | number;
  thumb: string;
  date?: string;
  isBranded?: boolean;
  videoUrl?: string;
}

export interface CreatorDemographics {
  genderMale?: number;
  genderFemale?: number;
  topGender?: string;
  topAgeGroup?: string;
  topCountry?: string;
  ageDistribution?: { name: string; value: number }[];
  countryDistribution?: { name: string; value: number }[];
}

export interface CreatorScores {
  overall?: number;
  broadcasting?: number;
  diligence?: number;
  commercial?: number;
}

export interface Creator {
  id: string;
  // Workspace nơi creator này được tạo ra đầu tiên (hiển thị "Created by") — KHÔNG dùng để
  // xác định creator "thuộc" brand nào nữa. 1 creator có thể chạy campaign ở nhiều brand cùng
  // lúc; brand nào đang làm việc với creator này được suy ra từ CreatorCampaignAssignment[]
  // (xem bên dưới), không phải field đơn này.
  workspaceId?: string;
  source?: 'scraper' | 'manual'; // how this creator entered the CRM — drives the "Auto-Synced" badge
  handle: string;
  displayName: string;
  avatar?: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube';
  country?: string;
  language?: string;
  bio: string;
  profileUrl: string;
  tiktokOneId?: string;
  followers?: number;
  avgViews?: number;
  engagementRate?: number; // e.g. 4.2%
  gmv30d?: number; // 30-day estimated GMV
  category?: string;
  niche?: string[];
  brandFitScore?: number; // 0-100
  commercialScore?: number; // 0-100
  riskScore?: number; // 0-100
  status: CreatorStatus;
  owner: string;
  email?: string;
  phone?: string;
  instagram?: string;
  rateCard?: string;
  lastContactAt?: string;
  // Đã đánh dấu "Không liên hệ nữa" — loại vĩnh viễn khỏi mọi đợt gửi outreach hàng loạt
  // (vẫn cho phép gửi tay từng người nếu operator chủ động mở EmailComposerModal).
  doNotContact?: boolean;
  createdAt: string;
  updatedAt?: string;
  notes: CreatorNote[];
  tags: string[];
  followerGrowthRate?: string;
  postingFrequency30d?: number;
  maxMinRatio?: string | number;
  lastVideoDate?: string;
  erFollower?: number;
  medianViews?: number | string;
  medianViewsBenchmark?: string;
  sixSecondViewRate?: string;
  sixSecondViewRateBenchmark?: string;
  engagementRateBenchmark?: string;
  industryTag?: string;
  videoContentTag?: string;
  brandedVideosCount?: number;
  industryCoveredCount?: number;
  recentVideos?: CreatorVideo[];
  demographics?: CreatorDemographics;
  scores?: CreatorScores;
  isMock?: boolean;
  // Dữ liệu thô lấy từ network-intercept MGetCreatorsCard (TikTok One) — giữ nguyên
  // shape gốc của TikTok, không chuẩn hoá lại, nên để any thay vì định nghĩa lại toàn bộ.
  audienceDemographicsFull?: any;
  followerHistory?: any[];
  topVideos?: any[];
  recentVideosFull?: any[];
  brandPartners?: string[];
  // Kết quả scoreCreator() (server/scoring.ts) — lưu lại để hiển thị breakdown chi tiết
  // trong UI thay vì chỉ có brandFitScore tổng.
  // brandFitScore/scoreBreakdown = điểm NỀN (baseline), tự động tính lại sau mỗi lần
  // scrape/update-detail, KHÔNG gắn với campaign nào — chỉ dùng Content/Follower/Ops
  // (3 nhóm không cần biết campaign) để có 1 con số tham khảo khi lướt cả kho creator.
  scoreBreakdown?: CreatorScoreBreakdown;
  // Điểm CHO TỪNG CAMPAIGN cụ thể — 1 creator dùng lại được cho nhiều campaign/brand khác
  // nhau, mỗi campaign có Niche Fit/Audience Fit riêng nên không thể dùng chung 1 con số.
  // Chỉ được ghi khi ai đó chủ động chấm cho đúng campaign đó (không tự động).
  campaignScores?: { campaignId: string; breakdown: CreatorScoreBreakdown; scoredAt: string }[];
}

export interface CreatorScoreBreakdown {
  totalScore: number;
  recommendation: string;
  groups: {
    key: string;
    label: string;
    weightPct: number;
    available: boolean;
    scorePct: number | null; // 0-100, null nếu cả nhóm không đủ dữ liệu
    items: { key: string; label: string; weightPct: number; value: number | null }[];
  }[];
  riskFlags: string[];
  strengths: string[];
  weaknesses: string[];
  scoredAt: string;
}

export interface CreatorNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface Campaign {
  id: string;
  workspaceId?: string;
  name: string;
  brand: string;
  objective: string;
  description: string;
  budget: number;
  spent: number;
  currency: string;
  status: CampaignStatus;
  startDate: string;
  endDate: string;
  owner: string;
  creatorIds: string[];
  targetCategories: string[];
  targetAudience?: CampaignTargetAudience;
  products: { id: string; name: string; sku: string; price: number }[];
  isMock?: boolean;
}

// Quan hệ nhiều-nhiều Creator ↔ Campaign — 1 creator có thể chạy nhiều campaign ở nhiều
// brand/workspace cùng lúc. workspaceId được copy từ campaign.workspaceId lúc assign (để
// filter theo workspace không cần join), và status là trạng thái RIÊNG của lần hợp tác này —
// không dùng chung Creator.status vì cùng 1 creator có thể đang "Negotiating" ở brand A nhưng
// đã "Posted" ở brand B.
export interface CreatorCampaignAssignment {
  id: string;
  creatorId: string;
  campaignId: string;
  campaignName: string;
  workspaceId?: string;
  status: CreatorStatus;
  assignedAt: string;
  ratePaid?: number;
  notes?: string;
}

export interface CampaignTargetAudience {
  gender?: 'Male' | 'Female' | 'Any';
  ageGroups?: string[]; // vd ['18-24','25-34'] — khớp với format topAgeGroup của TikTok One
  countries?: string[];
}

export interface UnmatchedInboundEmail {
  id: string;
  senderEmail: string;
  senderName?: string;
  subject: string;
  content: string; // đã strip quote
  receivedAt: string;
  candidateCreatorIds: string[]; // các creator khớp senderEmail, chờ Operator chọn 1
  resolved: boolean; // true sau khi Operator đã gán vào 1 conversation cụ thể
}

export interface CheckInboxResult {
  imported: number;
  skipped: number;
  skippedReasons: {
    forwarded: number;
    duplicate: number;
    no_match: number;
    ambiguous_multi_match: number;
  };
  needsManualReview: number;
}

export interface OutreachEmail {
  id: string;
  workspaceId?: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  campaignId?: string;
  campaignName?: string;
  subject: string;
  body: string;
  status: 'Draft' | 'Sent' | 'Opened' | 'Replied';
  sentAt?: string;
  repliedAt?: string;
  followUpCount: number;
  // Drives which outreach agent (first contact / reminder 1-3) generates the next message
  // for this thread — see src/lib/agents/outreach.ts.
  sequenceStage?: 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3' | 'closed';
  messageId?: string;
  isMock?: boolean;
}

export interface Message {
  id: string;
  senderType: 'USER' | 'CREATOR' | 'AI' | 'SYSTEM';
  senderName: string;
  content: string;
  isAiGenerated?: boolean;
  createdAt: string;
  messageId?: string;
  inReplyTo?: string;
  subject?: string;
}

export interface Conversation {
  id: string;
  workspaceId?: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string;
  campaignId?: string;
  campaignName?: string;
  status: 'Waiting Reply' | 'Need Reply' | 'Negotiating' | 'Completed';
  lastMessageAt: string;
  messages: Message[];
  unread: boolean;
  isMock?: boolean;
}

export interface ContentReview {
  id: string;
  workspaceId?: string;
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  creatorAvatar: string;
  campaignId: string;
  campaignName: string;
  videoTitle: string;
  draftUrl: string;
  thumbnailUrl?: string;
  videoThumbnail?: string;
  durationSeconds?: number;
  status: 'Pending Review' | 'Approved' | 'Revision Requested' | 'Rejected';
  dueAt: string;
  submittedAt: string;
  checklist?: {
    productVisible: boolean;
    brandMentioned: boolean;
    ctaPresent: boolean;
    linkCorrect: boolean;
    compliance: boolean;
    hookQualityScore: number; // 0-100
  };
  feedbackNote?: string;
  feedback?: string;
  aiAnalysis?: string;
  isMock?: boolean;
}

export type DraftReview = ContentReview;

export interface Task {
  id: string;
  workspaceId?: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  owner: string;
  assignedTo?: string;
  relatedCreatorId?: string;
  relatedCreatorName?: string;
  relatedCampaignId?: string;
  relatedCampaignName?: string;
  createdAt: string;
  isMock?: boolean;
}

export interface NotificationItem {
  id: string;
  workspaceId?: string;
  title: string;
  description: string;
  priority: NotificationPriority;
  category: 'Creator' | 'Outreach' | 'Campaign' | 'Review' | 'Task' | 'AI' | 'System';
  isRead: boolean;
  createdAt: string;
  link?: string;
  isMock?: boolean;
}

export interface ActivityItem {
  id: string;
  workspaceId?: string;
  actor: string;
  action: string;
  target: string;
  entityType: 'creator' | 'campaign' | 'task' | 'review' | 'outreach' | 'email' | 'workspace';
  entityId: string;
  timestamp: string;
  isMock?: boolean;
}

export interface DashboardKPIs {
  todayEmailsSent: number;
  todayRepliesReceived: number;
  pendingReviewsCount: number;
  overdueTasksCount: number;
  activeCampaignsCount: number;
  creatorsAddedThisWeek: number;
  conversionRate: number; // e.g. 18.5%
}

export interface AiRequestPayload {
  action: 'research' | 'email' | 'reply' | 'review' | 'daily-summary';
  promptData: Record<string, any>;
}

// One draft (and eventual send outcome) for a single creator inside a bulk outreach job —
// see src/lib/agents/outreach.ts + server.ts /api/outreach/bulk/* routes.
export interface BulkOutreachItem {
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  email?: string;
  subject: string;
  body: string;
  // 'ai' = written by a configured AI provider; 'template_fallback' = every configured
  // provider failed, filled from data/outreach-templates.json instead — surfaced to the
  // operator as a warning in the review step, never sent silently.
  source: 'ai' | 'template_fallback';
  status:
    | 'pending'
    | 'skipped_no_email'
    | 'skipped_do_not_contact'
    | 'skipped_cooldown'
    | 'draft'
    | 'sending'
    | 'sent'
    | 'failed';
  skipReason?: string;
  error?: string;
  sentAt?: string;
  outreachId?: string;
}

export interface BulkOutreachJob {
  id: string;
  workspaceId?: string;
  campaignId?: string;
  campaignName?: string;
  sequenceStage: 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3';
  status: 'generating' | 'ready' | 'sending' | 'done';
  pacingMinSeconds: number;
  pacingMaxSeconds: number;
  dailyCap: number;
  createdAt: string;
  items: BulkOutreachItem[];
}
