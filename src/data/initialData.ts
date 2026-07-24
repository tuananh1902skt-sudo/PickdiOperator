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
    creatorCount: 6,
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
    creatorCount: 4,
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
    creatorCount: 2,
    activeCampaignCount: 1
  }
];

export const INITIAL_CREATORS: Creator[] = [
  {
    id: 'cr-1',
    workspaceId: 'ws-dalba',
    handle: 'callme.duy',
    displayName: 'Call Me Duy',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    platform: 'TikTok',
    country: 'Vietnam',
    language: 'Vietnamese',
    bio: 'Skincare chemist & honest beauty reviews. 🌿 TikTok Shop Top Creator.',
    profileUrl: 'https://tiktok.com/@callme.duy',
    tiktokOneId: '6839848354256519173',
    followers: 650000,
    avgViews: 125000,
    engagementRate: 5.8,
    category: 'Beauty & Skincare',
    niche: ['K-Beauty', 'Skincare Routine', 'Ingredient Review', 'ACNE Care'],
    brandFitScore: 92,
    commercialScore: 88,
    riskScore: 15,
    status: 'Approved',
    owner: 'Anh Tuan',
    email: 'duy.callme.contact@gmail.com',
    phone: '+84901234567',
    rateCard: '$450 / TikTok Video + 12% Affiliate Commission',
    campaignId: 'cmp-1',
    campaignName: "d'Alba Sunscreen Viral Launch",
    lastContactAt: '2026-07-22T14:30:00Z',
    createdAt: '2026-07-10T08:00:00Z',
    tags: ['Top Performer', 'Skincare Expert', 'Verified Seller'],
    notes: [
      { id: 'n1', author: 'Anh Tuan', content: 'Responds best on Zalo/Email. Loves ingredient breakdowns. High conversion on d\'Alba Tone-up Sunscreen.', createdAt: '2026-07-12T10:00:00Z' }
    ],
    followerGrowthRate: '+2.45%',
    postingFrequency30d: 22,
    scores: {
      overall: 89.2,
      broadcasting: 92,
      diligence: 88,
      commercial: 85,
      creativity: 91
    },
    demographics: {
      genderFemale: 78,
      genderMale: 22,
      topAgeGroup: '18-24',
      topCountry: 'Vietnam'
    },
    recentVideos: [
      {
        id: 'v1',
        title: 'Review thành phần Kem chống nắng d\'Alba Waterfull Essence: Đáng tiền không?',
        views: '342.5K',
        thumb: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-20',
        isBranded: true,
        videoUrl: 'https://www.tiktok.com/@callme.duy/video/725891029381293'
      },
      {
        id: 'v2',
        title: 'Quy trình dưỡng da căng bóng Glass Skin ban đêm chuẩn Hàn Quốc',
        views: '189.2K',
        thumb: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-18',
        isBranded: false,
        videoUrl: 'https://www.tiktok.com/@callme.duy/video/725881029381294'
      },
      {
        id: 'v3',
        title: 'Top 3 Xịt khoáng Serum cấp ẩm tức thì cho dân văn phòng điều hòa',
        views: '215.8K',
        thumb: 'https://images.unsplash.com/photo-1608248597261-e4d990f30509?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-15',
        isBranded: true,
        videoUrl: 'https://www.tiktok.com/@callme.duy/video/725871029381295'
      },
      {
        id: 'v4',
        title: 'Sai lầm phổ biến khiến da lên mụn ẩn khi dùng kem chống nắng',
        views: '145.0K',
        thumb: 'https://images.unsplash.com/photo-1512290900676-26c2a6a095ae?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-11',
        isBranded: false,
        videoUrl: 'https://www.tiktok.com/@callme.duy/video/725861029381296'
      },
      {
        id: 'v5',
        title: 'Góc bóc phốt các loại Serum HA thần thánh trên TikTok Shop',
        views: '412.0K',
        thumb: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-08',
        isBranded: false,
        videoUrl: 'https://www.tiktok.com/@callme.duy/video/725851029381297'
      }
    ]
  },
  {
    id: 'cr-2',
    workspaceId: 'ws-2an',
    handle: 'goccuareview',
    displayName: 'Góc Của Review',
    avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=200',
    platform: 'TikTok',
    country: 'Vietnam',
    language: 'Vietnamese',
    bio: 'Review chân thật mỹ phẩm & makeup Hottrend | TikTok Shop Affiliate 🛍️',
    profileUrl: 'https://tiktok.com/@goccuareview',
    tiktokOneId: '7102938472918239012',
    followers: 420000,
    avgViews: 85000,
    engagementRate: 4.5,
    category: 'Makeup & Beauty',
    niche: ['Cushion Review', 'Lips Swatch', 'GRWM', '2aN Cosmetics'],
    brandFitScore: 88,
    commercialScore: 91,
    riskScore: 10,
    status: 'Draft Submitted',
    owner: 'Tu Quynh',
    email: 'goccuareview.booking@gmail.com',
    rateCard: '$300 / Video + 15% Commission',
    campaignId: 'cmp-2',
    campaignName: '2aN Gleaming Cushion Blast',
    lastContactAt: '2026-07-23T09:15:00Z',
    createdAt: '2026-07-11T09:00:00Z',
    tags: ['Makeup Specialist', 'High Conversion', 'Fast Turnaround'],
    notes: [
      { id: 'n2', author: 'Tu Quynh', content: 'Draft submitted today. Video quality is sharp with good swatch closeups.', createdAt: '2026-07-23T09:20:00Z' }
    ],
    followerGrowthRate: '+1.80%',
    postingFrequency30d: 18,
    scores: {
      overall: 84.5,
      broadcasting: 87,
      diligence: 90,
      commercial: 89,
      creativity: 82
    },
    demographics: {
      genderFemale: 85,
      genderMale: 15,
      topAgeGroup: '18-24',
      topCountry: 'Vietnam'
    },
    recentVideos: [
      {
        id: 'v21',
        title: 'Test Cushion 2aN Gleaming #21 Light Beige xem có bị xuống tone không?',
        views: '128.4K',
        thumb: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-22',
        isBranded: true,
        videoUrl: 'https://www.tiktok.com/@goccuareview/video/729102938102391'
      },
      {
        id: 'v22',
        title: 'Swatches trọn bộ Son Tint Bóng tone hồng đất cực sang cho nữ sinh',
        views: '95.6K',
        thumb: 'https://images.unsplash.com/photo-1586495777744-4413f21062fa?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-19',
        isBranded: false,
        videoUrl: 'https://www.tiktok.com/@goccuareview/video/729102938102392'
      },
      {
        id: 'v23',
        title: 'GRWM trang điểm đi học sương sương dưới 10 phút cực xinh',
        views: '164.0K',
        thumb: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-16',
        isBranded: true,
        videoUrl: 'https://www.tiktok.com/@goccuareview/video/729102938102393'
      }
    ]
  },
  {
    id: 'cr-3',
    workspaceId: 'ws-dalba',
    handle: 'trinhpham.beauty',
    displayName: 'Trinh Phạm',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=200',
    platform: 'TikTok',
    country: 'Vietnam',
    language: 'Vietnamese',
    bio: 'Beauty, Mom & Lifestyle tips! Sharing authentic daily favs.',
    profileUrl: 'https://tiktok.com/@trinhpham.beauty',
    tiktokOneId: '6982019382109283712',
    followers: 890000,
    avgViews: 210000,
    engagementRate: 6.1,
    category: 'Beauty & Lifestyle',
    niche: ['Mom Life', 'Daily Vlogs', 'Sunscreen Comparison', 'High-end Beauty'],
    brandFitScore: 95,
    commercialScore: 94,
    riskScore: 8,
    status: 'Negotiating',
    owner: 'Anh Tuan',
    email: 'trinhpham.partner@gmail.com',
    rateCard: '$800 / Video',
    campaignId: 'cmp-1',
    campaignName: "d'Alba Sunscreen Viral Launch",
    lastContactAt: '2026-07-23T11:00:00Z',
    createdAt: '2026-07-05T10:00:00Z',
    tags: ['Tier 1 Creator', 'High Trust', 'Brand Ambassador Candidate'],
    notes: [
      { id: 'n3', author: 'Anh Tuan', content: 'Requested fee $700 instead of $800 if we commit 3-video package.', createdAt: '2026-07-23T11:05:00Z' }
    ],
    followerGrowthRate: '+3.12%',
    postingFrequency30d: 25,
    scores: {
      overall: 94.0,
      broadcasting: 96,
      diligence: 92,
      commercial: 95,
      creativity: 93
    },
    demographics: {
      genderFemale: 88,
      genderMale: 12,
      topAgeGroup: '25-34',
      topCountry: 'Vietnam'
    },
    recentVideos: [
      {
        id: 'v31',
        title: 'Chăm sóc da mẹ bỉm cùng xịt khoáng d\'Alba First Spray Serum cao cấp',
        views: '482.0K',
        thumb: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=300',
        date: '2026-07-21',
        isBranded: true,
        videoUrl: 'https://www.tiktok.com/@trinhpham.beauty/video/730192837192831'
      }
    ]
  },
  {
    id: 'cr-4',
    workspaceId: 'ws-dalba',
    handle: 'glowskin_katie',
    displayName: 'Katie Glows',
    avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=200',
    platform: 'TikTok',
    country: 'United States',
    language: 'English',
    bio: 'Glass skin secrets & Korean Skincare routine obsessed ✨ US TikTok Shop Creator',
    profileUrl: 'https://tiktok.com/@glowskin_katie',
    tiktokOneId: '7029381920391823019',
    followers: 185000,
    avgViews: 45000,
    engagementRate: 4.8,
    category: 'Skincare',
    niche: ['Glass Skin', 'dAlba Serum', 'K-beauty US', 'Night Routine'],
    brandFitScore: 85,
    commercialScore: 82,
    riskScore: 12,
    status: 'Contacted',
    owner: 'Tu Quynh',
    email: 'katie.glowskin@yahoo.com',
    campaignId: 'cmp-1',
    campaignName: "d'Alba Sunscreen Viral Launch",
    lastContactAt: '2026-07-21T16:00:00Z',
    createdAt: '2026-07-15T12:00:00Z',
    tags: ['US Market', 'Micro-influencer', 'Glass Skin Aesthetic'],
    notes: [],
    followerGrowthRate: '+1.15%',
    postingFrequency30d: 14,
    scores: {
      overall: 82.0,
      broadcasting: 84,
      diligence: 80,
      commercial: 81,
      creativity: 83
    },
    demographics: {
      genderFemale: 81,
      genderMale: 19,
      topAgeGroup: '18-24',
      topCountry: 'United States'
    }
  },
  {
    id: 'cr-5',
    workspaceId: 'ws-2an',
    handle: 'haile_beauty',
    displayName: 'Hà Lê Beauty',
    avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?auto=format&fit=crop&q=80&w=200',
    platform: 'TikTok',
    country: 'Vietnam',
    language: 'Vietnamese',
    bio: 'Mẹo trang điểm tự nhiên | Son & Cushion Hàn Quốc hót hòn họt 🌸',
    profileUrl: 'https://tiktok.com/@haile_beauty',
    tiktokOneId: '6910293847281920391',
    followers: 310000,
    avgViews: 68000,
    engagementRate: 5.1,
    category: 'Makeup',
    niche: ['Natural Makeup', 'Korean Cushion', 'Student Budget'],
    brandFitScore: 89,
    commercialScore: 86,
    riskScore: 14,
    status: 'Qualified',
    owner: 'Anh Tuan',
    email: 'haile.makeup.booking@gmail.com',
    createdAt: '2026-07-18T14:00:00Z',
    tags: ['Gen Z', 'Affordable Beauty', 'K-beauty'],
    notes: []
  },
  {
    id: 'cr-6',
    workspaceId: 'ws-pickdi',
    handle: 'meoskin_review',
    displayName: 'Mèo Skincare',
    avatar: 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?auto=format&fit=crop&q=80&w=200',
    platform: 'TikTok',
    country: 'Vietnam',
    language: 'Vietnamese',
    bio: 'Chăm da chuẩn y khoa & test mỹ phẩm thực tế 🐈',
    profileUrl: 'https://tiktok.com/@meoskin_review',
    tiktokOneId: '6829103948291029381',
    followers: 120000,
    avgViews: 32000,
    engagementRate: 3.9,
    category: 'Beauty & Skincare',
    niche: ['Acne Routine', 'Sunscreen Test', 'Budget Beauty'],
    brandFitScore: 78,
    commercialScore: 72,
    riskScore: 20,
    status: 'New Lead',
    owner: 'Tu Quynh',
    email: 'meoskin.contact@gmail.com',
    createdAt: '2026-07-22T10:00:00Z',
    tags: ['New Creator', 'Dermatology Focus'],
    notes: []
  }
];

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
    status: 'PENDING',
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
    status: 'PENDING',
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
    status: 'PENDING',
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
    status: 'COMPLETED',
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
