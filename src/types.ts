export type CreatorStatus =
  | 'New Lead'
  | 'Researching'
  | 'Qualified'
  | 'Contact lần 1'
  | 'Contact lần 2'
  | 'Contact lần 3'
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

// Ngưỡng chấm điểm sourcing riêng của workspace (vd tiêu chí d'Alba trong file d'Alba
// Onboarding.xlsx, sheet Workflow!D22). Đây là cấu hình do operator tự nhập/sửa trong
// Settings — KHÔNG hardcode trong scoring.ts — vì mỗi brand có tiêu chí GMV/audience khác
// nhau và các mốc này thay đổi theo thời gian. Thiếu field nào thì scoring.ts loại field đó
// khỏi nhóm tương ứng (theo đúng nguyên tắc thiếu-dữ-liệu chung của scoreCreator()).
export interface WorkspaceScoringCriteria {
  gmvTierTarget?: CreatorGmvTier;
  gpmFloor?: number;
  gpmIdeal?: number;
  genderFemaleFloor?: number; // % 0-100
  genderFemaleIdeal?: number; // % 0-100
  beautyCategoryRatioFloor?: number; // % 0-100
  beautyCategoryRatioIdeal?: number; // % 0-100
  avgViewsFloor?: number;
  avgViewsIdeal?: number;
  preferredAgeGroup?: string; // vd "35-44" — chỉ cộng điểm thưởng, không phải ngưỡng loại
  // Followers từ mức này trở lên mà chưa từng có affiliate GMV bị coi là rủi ro sourcing
  // (nổi tiếng nhưng chưa chứng minh được bán hàng affiliate) — thêm vào computeRiskFlags().
  highFollowerNoAffiliateThreshold?: number;
}

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
  scoringCriteria?: WorkspaceScoringCriteria;
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

// Field riêng cho layout Creator detail thật của TikTok Shop Affiliate Center (TCM) — mỗi
// nhóm ứng với 1 tab con thật trên trang (PPS/Sample score/Sales/Collaboration metrics/
// Video/LIVE), lấy từ response marketplace/profile đã confirm field name (xem memory
// tcm-scraper-endpoints). Field nào TCM chưa xác nhận tên JSON thật (vd avg video/LIVE
// engagement rate riêng, products count, est post rate, time-series Trends) thì KHÔNG có
// trong các interface này — UI phải tự hiển thị "Chưa có dữ liệu" khi field undefined,
// không suy diễn/tính hộ từ field khác.
export interface CreatorSampleScoreBreakdownItem {
  key: 'postsWithSamples' | 'postFrequency' | 'salesGeneration' | 'contentQuality';
  label: string;
  score?: number; // 0-100
  percentileText?: string; // vd "Higher than 72% creators" — TCM trả sẵn dạng rank, không tự tính percentile
}

export interface CreatorSampleScore {
  total?: number; // 0-100
  tier?: string; // vd "Excellent"
  breakdown: CreatorSampleScoreBreakdownItem[];
}

export interface CreatorPps {
  score?: number; // 0-5.0
  tier?: string; // vd "Medium"
}

// content_groups: video_gmv/live_gmv (fraction) — % doanh thu theo kênh, KHÔNG phải %
// video/live count.
export interface CreatorSalesMetrics {
  gmv?: number; // med_gmv_revenue (median 30d GMV, USD)
  itemsSold?: number; // units_sold
  gpm?: number; // gpm.value
  gmvPerCustomer?: number; // avg_revenue_per_buyer
  channelSplit?: { video?: number; live?: number }; // % 0-100, từ content_groups
  // % GMV theo ngành hàng (donut "GMV by product category" thật) — nguồn thật cho
  // beautyCategoryRatio, lấy nguyên mảng industry_groups thay vì chỉ suy ra 1 số Beauty.
  categorySplit?: { name: string; value: number }[]; // % 0-100
}

export interface CreatorCollabMetrics {
  avgCommissionRatePct?: number; // med_commission_rate/100
  brandCollabCount?: number; // collaborated_brands_num
  brandPartners?: { id: string; name: string }[]; // partnered_brand[]
  estPostRatePct?: number; // sample_fulfillment_rate/100 — xác nhận thật qua recon lúc test cào (2026-08-03)
  productsCount?: number; // promoted_product_num — xác nhận thật qua recon lúc test cào (2026-08-03)
}

export interface CreatorVideoMetrics {
  gpm?: number; // ec_video_gpm (range {minimal,maximum} — không phải video_gpm như đoán trước, field đó không tồn tại)
  videosCount?: number; // video_publish_cnt_30d
  avgViews?: number; // video_play_cnt_med — xác nhận thật qua recon lúc test cào (2026-08-03), khớp "Avg. video views" trên UI TCM
  engagementRatePct?: number; // video_engagement/100 — xác nhận thật qua live recon (Session 6/7)
}

export interface CreatorLiveMetrics {
  gpm?: number; // ec_live_gpm (range {minimal,maximum} — không phải live_gpm như đoán trước, field đó không tồn tại)
  streamsCount?: number; // live_streaming_cnt_30d
  avgViews?: number; // live_med_view_cnt — xác nhận thật qua recon lúc test cào (2026-08-03), khớp "Avg. LIVE views" trên UI TCM
  engagementRatePct?: number; // live_engagement/100 — xác nhận thật qua live recon (Session 6/7)
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
  recentVideos?: CreatorVideo[];
  demographics?: CreatorDemographics;
  // GMV tier theo bảng Pickdi (src/lib/gmvTier.ts) — tự động suy ra từ gmv30d mỗi lần
  // saveCreator(), KHÔNG còn nhập tay từ Kalodata nữa. Quyết định hình thức hợp tác: L2 chỉ
  // commission, từ L3 trở lên mới thương lượng được commission + flat-fee.
  gmvTier?: CreatorGmvTier;
  gpm?: number;
  beautyCategoryRatio?: number; // % 0-100
  hasAffiliateGmv?: boolean;
  // Nhãn nguồn dữ liệu metrics — Kalodata/Cruva là platform sourcing tương tự nhau (import file/sheet
  // thủ công), TCM là cào trực tiếp qua extension. 'cruva' chưa có luồng import riêng, tạm dùng qua
  // tab Generic CSV của ImportWizardModal với metricsSource gán cứng 'cruva'.
  metricsSource?: 'kalodata' | 'tcm' | 'cruva' | 'manual';
  // Ngày cào — set khi có scrape event thật (hiện chỉ TCM extension), KHÔNG set khi import file.
  metricsSyncedAt?: string;
  // Ngày import — set khi creator được nhập từ file/sheet (Kalodata/Cruva/Generic CSV) qua
  // ImportWizardModal, KHÔNG set khi enrich qua TCM extension.
  importedAt?: string;
  // creator_oecuid thật của TCM — dùng để dựng link "Xem trên TCM" trong CreatorDetailDrawer
  // (affiliate-us.tiktok.com/connection/creator/detail?cid=<tcmCreatorOecuid>).
  tcmCreatorOecuid?: string;
  // Lần gần nhất extension search "Find Creators" theo handle KHÔNG khớp được creator này trên
  // TCM (no_match — xem extension/background.js processOneSearchCidItem). Dùng để hiện nhãn cảnh
  // báo trong CreatorListView thay vì để operator lặp lại tìm kiếm vô ích mỗi lần. Bị xoá (set
  // undefined) ngay khi tcmCreatorOecuid được set — nghĩa là đã tìm thấy.
  tcmNotFoundAt?: string;
  // Chi tiết theo đúng layout tab thật của TCM creator detail — chỉ có khi metricsSource
  // là 'tcm' và extension đã cào được (xem tcm-scraper-endpoints memory). KHÔNG áp dụng cho
  // creator nhập từ Kalodata/manual.
  pps?: CreatorPps;
  sampleScore?: CreatorSampleScore;
  salesMetrics?: CreatorSalesMetrics;
  collabMetrics?: CreatorCollabMetrics;
  videoMetrics?: CreatorVideoMetrics;
  liveMetrics?: CreatorLiveMetrics;
  isMock?: boolean;
  // Kết quả scoreCreator() (server/scoring.ts) — lưu lại để hiển thị breakdown chi tiết
  // trong UI thay vì chỉ có brandFitScore tổng.
  // brandFitScore/scoreBreakdown = điểm NỀN (baseline), tự động tính lại sau mỗi lần
  // import/enrich, KHÔNG gắn với campaign nào — chỉ dùng các nhóm không cần biết campaign
  // để có 1 con số tham khảo khi lướt cả kho creator.
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
  products: {
    id: string; name: string; sku: string; price: number; imageUrl?: string; productUrl?: string;
    // Social-proof + USP shown in the first-contact outreach email's product card
    // (src/lib/emailTemplate.ts renderFirstContactEmailHtml). All optional — the card
    // gracefully drops the rating line / checklist when unset.
    rating?: number; reviewCount?: number; soldCount?: string; highlights?: string[];
    // Starting compensation pitch shown in the first-contact outreach email, e.g.
    // "$100 for 10 videos" — free text since it's a negotiation opener, not a fixed rate.
    // Lives on the product (not the campaign) because it round-trips through the
    // `products` jsonb column — there is no dedicated `compensationOffer` DB column.
    compensationOffer?: string;
  }[];
  isMock?: boolean;
}

// Quan hệ nhiều-nhiều Creator ↔ Campaign — 1 creator có thể chạy nhiều campaign ở nhiều
// brand/workspace cùng lúc. workspaceId được copy từ campaign.workspaceId lúc assign (để
// filter theo workspace không cần join), và status là trạng thái RIÊNG của lần hợp tác này —
// không dùng chung Creator.status vì cùng 1 creator có thể đang "Negotiating" ở brand A nhưng
// đã "Posted" ở brand B.
export type CreatorGmvTier = 'L1' | 'L2' | 'L3' | 'L4' | 'L5';

export type CreatorQualification = 'Qualified' | 'Not Qualified' | 'Not Reviewed';

export type CastingStage =
  | 'Awaiting Confirmation'
  | 'Awaiting dAlba Signature'
  | 'Signed'
  | 'Confirmed';

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
  // Sourcing List fields (khớp file d'Alba Onboarding.xlsx) — giá/hợp đồng khác nhau theo
  // từng cặp creator × sản phẩm nên lưu ở đây, không lưu trên Creator dùng chung.
  gmvTier?: CreatorGmvTier;
  qualification?: CreatorQualification;
  originalPrice?: number;
  negotiatedPrice?: number;
  pricePerVideo?: number;
  commissionPercent?: number;
  contractedVideoCount?: number;
  contractUrl?: string;
  castingStage?: CastingStage;
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
  messageId?: string; // Message-ID gốc của email này — cần giữ để reminder sau này thread đúng
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
  cc?: string;
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
  // Bản sao rút gọn của message cuối cùng — duy trì bởi saveConversation() mỗi lần lưu, dùng để
  // hiển thị preview 1 dòng (Inbox list row, Dashboard recent replies) mà KHÔNG cần load cả mảng
  // `messages` (toàn bộ nội dung email trong thread) — xem getConversationsForList() ở db.ts.
  // Khi `messages` được load đầy đủ (fetchFullConversations), 2 field này không còn ý nghĩa —
  // luôn ưu tiên messages[messages.length-1] nếu messages.length > 0.
  lastMessagePreview?: string;
  lastMessageSenderType?: Message['senderType'];
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
    productNameCorrect?: boolean; // Tên sản phẩm nhắc đúng
    ingredientsBenefitsCorrect?: boolean; // Thành phần/công dụng nói đúng
    durationValid?: boolean; // Độ dài video hợp lý (30-90 giây)
    hookIn3Seconds?: boolean; // Có hook trong 3 giây đầu
    matchesBrief?: boolean; // Đúng theo brief đã gửi
  };
  feedbackNote?: string;
  feedback?: string;
  aiAnalysis?: string;
  isMock?: boolean;
}

export type DraftReview = ContentReview;

// Bảng "Uploaded" trong file d'Alba Onboarding.xlsx — 1 dòng cho mỗi video đã đăng chính
// thức (sau khi ContentReview được Approve). doanh thu/số đơn/chi ads có thể chưa biết lúc
// mới đánh dấu đã đăng, chỉ điền link + ngày, rồi cập nhật số liệu sau khi có báo cáo thật.
export interface PostedVideo {
  id: string;
  workspaceId?: string;
  reviewId?: string; // ContentReview gốc đã Approve, nếu tạo từ nút "Đánh dấu đã đăng"
  creatorId: string;
  creatorName: string;
  creatorHandle: string;
  campaignId: string;
  campaignName: string;
  round?: string; // đợt (round) casting
  pricePerVideo?: number;
  paid?: boolean; // Paid / Non-Paid
  postedAt: string;
  videoUrl: string;
  videoId?: string;
  adCode?: string; // Spark Ads code
  roi?: number;
  totalRevenue?: number;
  totalOrders?: number;
  totalAdSpend?: number;
  isMock?: boolean;
}

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
  // operator as a warning in the review step, never sent silently; 'template' = operator
  // explicitly chose to mail-merge the saved template instead of using AI.
  source: 'ai' | 'template_fallback' | 'template';
  status:
    | 'pending'
    | 'skipped_no_email'
    | 'skipped_do_not_contact'
    | 'skipped_recent_duplicate'
    | 'draft'
    | 'sending'
    | 'sent'
    | 'failed';
  skipReason?: string;
  error?: string;
  sentAt?: string;
  outreachId?: string;
  // Set when status flips to 'sending' (server.ts sendNextBulkOutreachItem) — lets a stuck
  // item (persist step threw, or deliverOutreachEmail hung on an un-timeout'd DB call) be
  // detected and reclaimed as 'failed' instead of staying 'sending' forever.
  sendingSince?: string;
}

export interface BulkOutreachJob {
  id: string;
  workspaceId?: string;
  campaignId?: string;
  campaignName?: string;
  sequenceStage: 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3';
  // How drafts in this job were produced — kept so "Viết lại" (regenerate) on a single
  // item stays consistent with how the rest of the batch was generated.
  contentSource: 'ai' | 'template';
  cc?: string;
  // 'paused_cap' = the send loop stopped early because dailyCap was reached — distinct
  // from 'done' (which means every item was actually resolved) so the operator can raise
  // the cap and resume instead of the job silently getting stuck with unsent drafts.
  status: 'generating' | 'ready' | 'sending' | 'paused_cap' | 'done';
  pacingMinSeconds: number;
  pacingMaxSeconds: number;
  dailyCap: number;
  createdAt: string;
  items: BulkOutreachItem[];
  // When the next item is due to send — used by the resume-on-poll fallback (see
  // sendNextBulkOutreachItem in server.ts) to detect a job whose scheduled continuation
  // (QStash message or in-process setTimeout) never fired, e.g. a Vercel function that was
  // torn down between sends.
  nextSendAt?: string;
  // Short-lived claim so only one caller advances a given job at a time (the QStash
  // callback, the local setTimeout fallback, and the resume-on-poll check can all fire for
  // the same job around the same moment).
  sendLockUntil?: string;
}
