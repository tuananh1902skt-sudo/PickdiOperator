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
  DashboardKPIs
} from '../types';

export const INITIAL_WORKSPACES: Workspace[] = [
  {
    id: 'ws-pickdi',
    name: 'Pickdi Agency - Master Network',
    code: 'PICKDI',
    brandName: 'Pickdi MCN Agency',
    category: 'Multi-Brand Agency Network',
    color: 'purple',
    description: 'Master Agency Dashboard consolidating all brand affiliate rosters, commissions & lead pools',
    isAgency: true,
    memberCount: 12,
    creatorCount: 0,
    activeCampaignCount: 3
  },
  {
    id: 'ws-dalba',
    name: "d'Alba Vietnam Official",
    code: 'DALBA',
    brandName: "d'Alba Piedmont Vietnam",
    category: 'Skincare & K-Beauty',
    color: 'indigo',
    description: "Official TikTok Shop Affiliate Hub for d'Alba First Spray Serum & Tone-Up Sunscreens",
    memberCount: 6,
    creatorCount: 0,
    activeCampaignCount: 2
  },
  {
    id: 'ws-2an',
    name: '2aN Cosmetics Brand Store',
    code: '2AN',
    brandName: '2aN Cosmetics Vietnam',
    category: 'Makeup & Cosmetics',
    color: 'rose',
    description: 'Affiliate Recruitment & Content Approval Portal for 2aN Tension Cushions & Lip Tints',
    memberCount: 4,
    creatorCount: 0,
    activeCampaignCount: 1
  }
];

export const INITIAL_CREATORS: Creator[] = [];

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'cmp-1',
    workspaceId: 'ws-dalba',
    name: "d'Alba Waterfull Sunscreen Launch",
    brand: "d'Alba Piedmont",
    objective: 'Drive 10,000 TikTok Shop units for d\'Alba Waterfull Essence Sunscreen in Q3.',
    description: 'Focus on glass skin finish, white truffle ingredient story, non-greasy texture for summer.',
    budget: 15000,
    spent: 6800,
    currency: 'USD',
    status: 'Running',
    startDate: '2026-07-01',
    endDate: '2026-08-15',
    owner: 'Anh Tuan',
    creatorIds: ['cr-1', 'cr-3', 'cr-4'],
    targetCategories: ['Skincare', 'Sunscreen', 'K-Beauty'],
    products: [
      { id: 'p1', name: "d'Alba Waterfull Essence Sunscreen 50ml", sku: 'DALBA-SUN-50', price: 28 },
      { id: 'p2', name: "d'Alba First Spray Serum 100ml", sku: 'DALBA-SERUM-100', price: 32 }
    ]
  },
  {
    id: 'cmp-2',
    workspaceId: 'ws-2an',
    name: '2aN Gleaming Cushion Viral Campaign',
    brand: '2aN Cosmetics',
    objective: 'Position 2aN Gleaming Tension Cushion as #1 glowing foundation on TikTok Shop Vietnam.',
    description: 'Highlight long-lasting coverage, dewiness, GRWM lip/cushion combo.',
    budget: 8000,
    spent: 3200,
    currency: 'USD',
    status: 'Running',
    startDate: '2026-07-10',
    endDate: '2026-08-30',
    owner: 'Tu Quynh',
    creatorIds: ['cr-2', 'cr-5'],
    targetCategories: ['Makeup', 'Cushion', 'Gen Z Makeup'],
    products: [
      { id: 'p3', name: '2aN Gleaming Tension Cushion #21 Light Beige', sku: '2AN-CUSHION-21', price: 22 },
      { id: 'p4', name: '2aN Dual Cheek Blush Coral Glow', sku: '2AN-BLUSH-CORAL', price: 16 }
    ]
  },
  {
    id: 'cmp-3',
    name: 'Skincare Essentials Back-To-School',
    brand: 'Multi-Brand Select',
    objective: 'Student budget skincare routine bundles with exclusive TikTok discount codes.',
    description: 'Target university students preparing for new school year with gentle cleansers & sunscreens.',
    budget: 5000,
    spent: 0,
    currency: 'USD',
    status: 'Planning',
    startDate: '2026-08-10',
    endDate: '2026-09-15',
    owner: 'Anh Tuan',
    creatorIds: [],
    targetCategories: ['Student Routine', 'Gentle Skincare'],
    products: []
  }
];

export const INITIAL_OUTREACH: OutreachEmail[] = [
  {
    id: 'out-1',
    creatorId: 'cr-4',
    creatorName: 'Katie Glows',
    creatorHandle: '@glowskin_katie',
    campaignId: 'cmp-1',
    campaignName: "d'Alba Waterfull Sunscreen Launch",
    subject: "Collaboration Invitation: d'Alba Waterfull Sunscreen 🌿 (Paid + Commission)",
    body: "Hi Katie,\n\nWe love your glass skin routine videos on TikTok! We are launching d'Alba Waterfull Essence Sunscreen on TikTok Shop US and would love to partner with you.\n\nOffer:\n- Product gifted + $350 flat fee per TikTok video\n- 15% affiliate commission rate on all sales via your video link\n\nLet us know if you'd be interested in testing the sample!\n\nBest,\nTu Quynh | Pickdi Affiliate Team",
    status: 'Sent',
    sentAt: '2026-07-21T16:00:00Z',
    followUpCount: 1
  },
  {
    id: 'out-2',
    creatorId: 'cr-3',
    creatorName: 'Trinh Phạm',
    creatorHandle: '@trinhpham.beauty',
    campaignId: 'cmp-1',
    campaignName: "d'Alba Waterfull Sunscreen Launch",
    subject: "Hợp tác sản phẩm d'Alba Piedmont x Trinh Phạm ✨",
    body: "Chào chị Trinh,\n\nEm từ team Affiliate d'Alba Việt Nam. Tụi em đang chuẩn bị chiến dịch ra mắt Kem Chống Nắng d'Alba Waterfull Essence và rất mong muốn đồng hành cùng chị.\n\nBên em gửi gói tài trợ bao gồm sản phẩm dùng thử + Cát-xê $700/video + 12% Hoa hồng TikTok Shop.\n\nRất mong phản hồi từ chị!",
    status: 'Replied',
    sentAt: '2026-07-20T09:00:00Z',
    repliedAt: '2026-07-23T11:00:00Z',
    followUpCount: 0
  }
];

export const INITIAL_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-1',
    creatorId: 'cr-3',
    creatorName: 'Trinh Phạm',
    creatorHandle: '@trinhpham.beauty',
    creatorAvatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    campaignId: 'cmp-1',
    campaignName: "d'Alba Waterfull Sunscreen Launch",
    status: 'Negotiating',
    lastMessageAt: '2026-07-23T11:00:00Z',
    unread: true,
    messages: [
      {
        id: 'm1',
        senderType: 'USER',
        senderName: 'Anh Tuan',
        content: "Chào chị Trinh! Bên em gửi proposal mời chị hợp tác chiến dịch d'Alba Sunscreen với mức fee $700 + 12% Commission ạ.",
        createdAt: '2026-07-20T09:00:00Z'
      },
      {
        id: 'm2',
        senderType: 'CREATOR',
        senderName: 'Trinh Phạm',
        content: "Chào em, chị có dùng qua d'Alba xịt khoáng rồi rất thích. Với video review sunscreen chị nhận mức $800, hoặc nếu làm combo 2 video (Sunscreen + Spray Serum) chị tính $1,300 trọn gói nhé em.",
        createdAt: '2026-07-23T11:00:00Z'
      }
    ]
  },
  {
    id: 'conv-2',
    creatorId: 'cr-2',
    creatorName: 'Góc Của Review',
    creatorHandle: '@goccuareview',
    creatorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
    campaignId: 'cmp-2',
    campaignName: '2aN Gleaming Cushion Blast',
    status: 'Waiting Reply',
    lastMessageAt: '2026-07-23T09:15:00Z',
    unread: false,
    messages: [
      {
        id: 'm3',
        senderType: 'CREATOR',
        senderName: 'Góc Của Review',
        content: 'Hi Quỳnh, mình đã lên xong file nháp video test cushion 2aN tone #21 rồi nè. Mình vừa gửi link video trong hệ thống review nha!',
        createdAt: '2026-07-23T09:15:00Z'
      }
    ]
  }
];

export const INITIAL_REVIEWS: ContentReview[] = [
  {
    id: 'rev-1',
    creatorId: 'cr-2',
    creatorName: 'Góc Của Review',
    creatorHandle: '@goccuareview',
    creatorAvatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
    campaignId: 'cmp-2',
    campaignName: '2aN Gleaming Cushion Blast',
    videoTitle: 'Review Cushion 2aN Tension - Lớp nền căng bóng chuẩn Hàn',
    draftUrl: 'https://v.douyin.com/iR3x9aL/',
    videoThumbnail: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=300',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=300',
    durationSeconds: 42,
    status: 'Pending Review',
    dueAt: '2026-07-24T18:00:00Z',
    submittedAt: '2026-07-23T09:15:00Z',
    checklist: {
      productVisible: true,
      brandMentioned: true,
      ctaPresent: true,
      linkCorrect: true,
      compliance: true,
      hookQualityScore: 88
    },
    feedback: '',
    aiAnalysis: 'Hook strength is high (3s visual split-screen test). Product packaging clearly visible. Recommend approving with minor audio tweak at 0:15.'
  },
  {
    id: 'rev-2',
    creatorId: 'cr-1',
    creatorName: 'Call Me Duy',
    creatorHandle: '@callme.duy',
    creatorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    campaignId: 'cmp-1',
    campaignName: "d'Alba Waterfull Sunscreen Launch",
    videoTitle: 'So sánh KCN d\'Alba Essence vs KCN Vật Lý thông thường',
    draftUrl: 'https://v.douyin.com/iR89sPQ/',
    videoThumbnail: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=300',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=300',
    durationSeconds: 58,
    status: 'Approved',
    dueAt: '2026-07-22T18:00:00Z',
    submittedAt: '2026-07-21T14:00:00Z',
    checklist: {
      productVisible: true,
      brandMentioned: true,
      ctaPresent: true,
      linkCorrect: true,
      compliance: true,
      hookQualityScore: 94
    },
    feedback: 'Tuyệt vời! Lồng tiếng mượt mà, nhấn mạnh được thành phần nấm Truffle Trắng.',
    aiAnalysis: 'High commercial potential. Verified non-greasy texture test included.'
  }
];

export const INITIAL_TASKS: Task[] = [
  {
    id: 'tsk-1',
    title: 'Review draft video from Góc Của Review (2aN Cushion)',
    description: 'Check product closeups, TikTok Shop product tag link, and verbal CTA.',
    priority: 'HIGH',
    status: 'Pending',
    dueDate: '2026-07-24',
    owner: 'Tu Quynh',
    relatedCreatorId: 'cr-2',
    relatedCreatorName: 'Góc Của Review',
    relatedCampaignId: 'cmp-2',
    relatedCampaignName: '2aN Gleaming Cushion Blast',
    createdAt: '2026-07-23T09:20:00Z'
  },
  {
    id: 'tsk-2',
    title: 'Follow-up with Trinh Phạm regarding 2-video package price',
    description: 'Counter offer $1,200 for 2 videos or confirm $750 for 1 video + 15% commission.',
    priority: 'CRITICAL',
    status: 'Pending',
    dueDate: '2026-07-24',
    owner: 'Anh Tuan',
    relatedCreatorId: 'cr-3',
    relatedCreatorName: 'Trinh Phạm',
    relatedCampaignId: 'cmp-1',
    relatedCampaignName: "d'Alba Waterfull Sunscreen Launch",
    createdAt: '2026-07-23T11:10:00Z'
  },
  {
    id: 'tsk-3',
    title: 'Send follow-up email #2 to Katie Glows (US)',
    description: 'Offer free sample shipment tracking via DHL.',
    priority: 'MEDIUM',
    status: 'Pending',
    dueDate: '2026-07-25',
    owner: 'Tu Quynh',
    relatedCreatorId: 'cr-4',
    relatedCreatorName: 'Katie Glows',
    createdAt: '2026-07-21T16:00:00Z'
  },
  {
    id: 'tsk-4',
    title: 'Prepare sample shipment for Hà Lê Beauty',
    description: 'Pack 2aN Tension Cushion tone #21 + Dual Cheek Blush.',
    priority: 'LOW',
    status: 'Completed',
    dueDate: '2026-07-22',
    owner: 'Anh Tuan',
    relatedCreatorId: 'cr-5',
    relatedCreatorName: 'Hà Lê Beauty',
    createdAt: '2026-07-20T10:00:00Z'
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'New Video Draft Submitted',
    description: 'Góc Của Review submitted a new draft for 2aN Gleaming Cushion Blast.',
    priority: 'HIGH',
    category: 'Review',
    isRead: false,
    createdAt: '2026-07-23T09:15:00Z',
    link: '/reviews'
  },
  {
    id: 'notif-2',
    title: 'New Creator Message',
    description: 'Trinh Phạm replied to your d\'Alba Sunscreen outreach with counter-offer.',
    priority: 'CRITICAL',
    category: 'Outreach',
    isRead: false,
    createdAt: '2026-07-23T11:00:00Z',
    link: '/outreach'
  },
  {
    id: 'notif-3',
    title: 'Campaign Milestone Reached',
    description: "d'Alba Waterfull Sunscreen Launch crossed 50% budget utilization.",
    priority: 'MEDIUM',
    category: 'Campaign',
    isRead: true,
    createdAt: '2026-07-22T17:00:00Z',
    link: '/campaigns'
  }
];

export const INITIAL_ACTIVITIES: ActivityItem[] = [
  {
    id: 'act-1',
    actor: 'Góc Của Review',
    action: 'submitted draft video',
    target: '2aN Gleaming Cushion Blast',
    entityType: 'review',
    entityId: 'rev-1',
    timestamp: '2026-07-23T09:15:00Z'
  },
  {
    id: 'act-2',
    actor: 'Trinh Phạm',
    action: 'replied to negotiation message',
    target: "d'Alba Waterfull Sunscreen Launch",
    entityType: 'creator',
    entityId: 'cr-3',
    timestamp: '2026-07-23T11:00:00Z'
  },
  {
    id: 'act-3',
    actor: 'Anh Tuan',
    action: 'approved content draft',
    target: 'Call Me Duy - d\'Alba Sunscreen Video',
    entityType: 'review',
    entityId: 'rev-2',
    timestamp: '2026-07-22T14:30:00Z'
  },
  {
    id: 'act-4',
    actor: 'Tu Quynh',
    action: 'sent outreach email',
    target: 'Katie Glows (@glowskin_katie)',
    entityType: 'email',
    entityId: 'out-1',
    timestamp: '2026-07-21T16:00:00Z'
  }
];

export const INITIAL_KPIS: DashboardKPIs = {
  todayEmailsSent: 18,
  todayRepliesReceived: 7,
  pendingReviewsCount: 1,
  overdueTasksCount: 0,
  activeCampaignsCount: 2,
  creatorsAddedThisWeek: 6,
  conversionRate: 19.4
};
