// Chấm điểm brand-fit xác định (deterministic) cho creator, thay thế hoàn toàn cho việc
// dùng Gemini đoán điểm theo cảm tính. Toàn bộ input đều là field thật đã có trên Creator/
// Campaign — không có field nào bị bịa ra để công thức "trông đầy đủ".
//
// Nguyên tắc thiếu dữ liệu: mỗi dòng con (item) không có data thì bị loại khỏi nhóm của nó,
// trọng số dồn cho các dòng con còn lại TRONG CÙNG NHÓM. Nếu cả nhóm không có dòng con nào
// khả dụng (vd chưa truyền campaign nên không chấm được Audience Fit), trọng số của cả nhóm
// dồn sang các nhóm khác — không tự ý gán điểm trung tính giả cho một nhóm rỗng.
import { Creator, Campaign, CreatorScoreBreakdown, CreatorGmvTier, WorkspaceScoringCriteria } from './types';

// Dùng khi workspace chưa tự cấu hình Sourcing Criteria trong Settings — đúng số trong file
// d'Alba Onboarding.xlsx (Workflow!D22) tại thời điểm viết nhóm này.
// gpmFloor/gpmIdeal: file nguồn không cho mốc cụ thể — đây là ước lượng đặt tạm (GPM = GMV/
// 1000 views, đơn vị USD) để nhóm GMV Performance không bị bỏ trống hoàn toàn; SỬA lại trong
// Settings > Sourcing Scoring Criteria ngay khi có số benchmark gpm thật từ Kalodata.
const DEFAULT_SCORING_CRITERIA: WorkspaceScoringCriteria = {
  gmvTierTarget: 'L3',
  gpmFloor: 5,
  gpmIdeal: 15,
  genderFemaleFloor: 60,
  genderFemaleIdeal: 80,
  beautyCategoryRatioFloor: 70,
  beautyCategoryRatioIdeal: 80,
  avgViewsFloor: 800,
  avgViewsIdeal: 900,
  preferredAgeGroup: '35-44',
  highFollowerNoAffiliateThreshold: 100000,
};

interface ScoreItem {
  key: string;
  label: string;
  weightPct: number;
  value: number | null; // fraction 0..1, null = không đủ dữ liệu
}

interface ScoreGroup {
  key: string;
  label: string;
  weightPct: number;
  items: ScoreItem[];
}

function toNumber(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function followerTierScore(followers: number | undefined): number | null {
  if (followers === undefined) return null;
  if (followers < 1000) return 0.3;
  if (followers < 10000) return 0.6;
  if (followers < 100000) return 0.8;
  if (followers < 500000) return 1.0;
  if (followers < 1000000) return 0.9;
  return 0.75;
}

function niceOverlapScore(list: string[] | undefined, targets: string[]): number | null {
  if (!list || list.length === 0 || targets.length === 0) return null;
  const normTargets = targets.map(t => t.toLowerCase());
  const matched = list.filter(v => normTargets.includes(v.toLowerCase())).length;
  return clamp01(matched / targets.length);
}

// Tiêu chí d'Alba viết theo kiểu "đạt/không đạt ngưỡng" (toàn các mốc %), không phải so
// liên tục với benchmark ngành — 0 dưới floor, 100% (1.0) từ ideal trở lên, tuyến tính ở giữa.
function bandScore(value: number, floor: number, ideal: number): number {
  if (ideal === floor) return value >= ideal ? 1 : 0;
  if (value < floor) return 0;
  if (value >= ideal) return 1;
  return (value - floor) / (ideal - floor);
}

const GMV_TIER_ORDER: CreatorGmvTier[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

// Không phải "càng cao càng tốt" — d'Alba nhắm đúng tier mục tiêu (mặc định L3), tier càng
// xa mục tiêu (theo cả 2 hướng) thì điểm càng thấp.
function gmvTierFitScore(tier: CreatorGmvTier | undefined, target: CreatorGmvTier | undefined): number | null {
  if (!tier || !target) return null;
  const idx = GMV_TIER_ORDER.indexOf(tier);
  const targetIdx = GMV_TIER_ORDER.indexOf(target);
  if (idx === -1 || targetIdx === -1) return null;
  const distance = Math.abs(idx - targetIdx);
  if (distance === 0) return 1;
  if (distance === 1) return 0.65;
  return 0.3;
}

// Content Performance/Ops Reliability (dựa TikTok One benchmark) đã bị xóa; thay bằng 3
// nhóm dưới đây theo đúng tiêu chí sourcing thật của d'Alba (Workflow!D22): GMV Performance,
// Audience Profile Fit, Reach Consistency. Follower Tier vẫn dùng field followers chung,
// không phụ thuộc nguồn nào.
function buildGroups(creator: Creator, campaign?: Campaign, criteria: WorkspaceScoringCriteria = DEFAULT_SCORING_CRITERIA): ScoreGroup[] {
  const followers = toNumber(creator.followers);
  const targetAudience = campaign?.targetAudience;

  const groups: ScoreGroup[] = [
    {
      key: 'followerTier',
      label: 'Follower Tier',
      weightPct: 10,
      items: [
        { key: 'tier', label: 'Follower tier', weightPct: 10, value: followerTierScore(followers) },
      ],
    },
  ];

  // GMV Performance — có so target GMV tier + gpm theo band, cả 2 lấy từ Kalodata import,
  // không phụ thuộc campaign nào.
  const gmvItems: ScoreItem[] = [
    { key: 'gmvTier', label: `GMV tier so target ${criteria.gmvTierTarget || 'L3'}`, weightPct: 20, value: gmvTierFitScore(creator.gmvTier, criteria.gmvTierTarget) },
  ];
  const gpm = toNumber(creator.gpm);
  if (gpm !== undefined && criteria.gpmFloor != null && criteria.gpmIdeal != null) {
    gmvItems.push({ key: 'gpm', label: 'GPM (GMV/1000 views, USD)', weightPct: 15, value: bandScore(gpm, criteria.gpmFloor, criteria.gpmIdeal) });
  }
  groups.push({ key: 'gmvPerformance', label: 'GMV Performance', weightPct: 35, items: gmvItems });

  // Audience Profile Fit — đối chiếu demographics thật của creator với chân dung audience
  // d'Alba nhắm tới (nữ, beauty/personal care, ưu tiên 35-44), KHÔNG phải Audience Fit theo
  // targetAudience của 1 campaign cụ thể (nhóm 'audience' phía dưới vẫn giữ nguyên riêng).
  const audienceProfileItems: ScoreItem[] = [];
  const genderFemale = toNumber(creator.demographics?.genderFemale);
  if (genderFemale !== undefined && criteria.genderFemaleFloor != null && criteria.genderFemaleIdeal != null) {
    audienceProfileItems.push({ key: 'genderFemale', label: '% nữ trong audience', weightPct: 12, value: bandScore(genderFemale, criteria.genderFemaleFloor, criteria.genderFemaleIdeal) });
  }
  const beautyRatio = toNumber(creator.beautyCategoryRatio);
  if (beautyRatio !== undefined && criteria.beautyCategoryRatioFloor != null && criteria.beautyCategoryRatioIdeal != null) {
    audienceProfileItems.push({ key: 'beautyCategoryRatio', label: '% nội dung beauty/personal care', weightPct: 12, value: bandScore(beautyRatio, criteria.beautyCategoryRatioFloor, criteria.beautyCategoryRatioIdeal) });
  }
  const preferredAgePct = criteria.preferredAgeGroup
    ? creator.demographics?.ageDistribution?.find(a => a.name === criteria.preferredAgeGroup)?.value
    : undefined;
  if (preferredAgePct !== undefined) {
    // d'Alba chỉ nói "ưu tiên" tuổi 35-44, không phải ngưỡng loại cứng — chấm như điểm
    // thưởng liên tục (% càng cao trong nhóm tuổi này càng tốt), không dùng bandScore floor/ideal.
    audienceProfileItems.push({ key: 'preferredAge', label: `% audience ở nhóm tuổi ưu tiên (${criteria.preferredAgeGroup})`, weightPct: 6, value: clamp01(preferredAgePct / 100) });
  }
  if (audienceProfileItems.length > 0) {
    groups.push({ key: 'audienceProfileFit', label: 'Audience Profile Fit', weightPct: 30, items: audienceProfileItems });
  }

  // Reach Consistency — avgViews theo band mốc d'Alba muốn (800-900+ view/video).
  const avgViews = toNumber(creator.avgViews);
  if (avgViews !== undefined && criteria.avgViewsFloor != null && criteria.avgViewsIdeal != null) {
    groups.push({
      key: 'reachConsistency',
      label: 'Reach Consistency',
      weightPct: 20,
      items: [
        { key: 'avgViews', label: 'Avg views/video', weightPct: 20, value: bandScore(avgViews, criteria.avgViewsFloor, criteria.avgViewsIdeal) },
      ],
    });
  }

  // Niche Fit và Audience Fit (theo campaign) chỉ chấm được khi có campaign để so khớp —
  // không có campaign thì bỏ hẳn 2 nhóm này, KHÔNG gán điểm trung tính giả, trọng số dồn
  // sang nhóm khác.
  if (campaign) {
    groups.push({
      key: 'niche',
      label: 'Niche Fit',
      weightPct: 20,
      items: [
        { key: 'categoryOverlap', label: '% overlap niche/category', weightPct: 12, value: niceOverlapScore(creator.niche && creator.niche.length ? creator.niche : (creator.category ? [creator.category] : undefined), campaign.targetCategories) },
        { key: 'objectiveMatch', label: 'Category matches campaign objective', weightPct: 8, value: creator.category ? ((campaign.targetCategories.some(c => c.toLowerCase() === creator.category!.toLowerCase()) ? 1 : (campaign.objective || '').toLowerCase().includes(creator.category.toLowerCase()) ? 0.6 : 0.2)) : null },
      ],
    });
  }

  if (targetAudience && creator.demographics) {
    const d = creator.demographics;
    const items: ScoreItem[] = [];

    if (targetAudience.gender && targetAudience.gender !== 'Any') {
      let genderValue: number | null = null;
      if (d.topGender) {
        genderValue = d.topGender.toLowerCase() === targetAudience.gender.toLowerCase() ? 1 : 0.2;
      } else {
        const pct = targetAudience.gender === 'Female' ? d.genderFemale : d.genderMale;
        genderValue = pct != null ? clamp01(pct / 100) : null;
      }
      items.push({ key: 'gender', label: 'Gender match', weightPct: 7, value: genderValue });
    }

    if (targetAudience.ageGroups && targetAudience.ageGroups.length > 0) {
      let ageValue: number | null = null;
      if (d.topAgeGroup) {
        ageValue = targetAudience.ageGroups.includes(d.topAgeGroup) ? 1 : 0.2;
      } else if (d.ageDistribution && d.ageDistribution.length > 0) {
        const matched = d.ageDistribution.filter(a => targetAudience.ageGroups!.includes(a.name)).reduce((s, a) => s + a.value, 0);
        ageValue = clamp01(matched / 100);
      }
      items.push({ key: 'age', label: 'Age group match', weightPct: 7, value: ageValue });
    }

    if (targetAudience.countries && targetAudience.countries.length > 0) {
      const countryValue = d.topCountry ? (targetAudience.countries.includes(d.topCountry) ? 1 : 0.2) : null;
      items.push({ key: 'country', label: 'Country match', weightPct: 6, value: countryValue });
    }

    if (items.length > 0) {
      groups.push({ key: 'audience', label: 'Audience Fit', weightPct: 20, items });
    }
  }

  return groups;
}

function computeRiskFlags(creator: Creator, criteria: WorkspaceScoringCriteria = DEFAULT_SCORING_CRITERIA): { flags: string[]; penalty: number } {
  const flags: string[] = [];
  const maxMinRatio = toNumber(creator.maxMinRatio);
  const followers = toNumber(creator.followers);

  if (creator.lastVideoDate) {
    const daysSince = (Date.parse(new Date().toISOString()) - Date.parse(creator.lastVideoDate)) / 86400000;
    if (Number.isFinite(daysSince) && daysSince > 90) flags.push('No new video in the last 90 days');
  }
  if (maxMinRatio !== undefined && maxMinRatio > 15) flags.push('View performance depends heavily on a single viral video');
  if ((!creator.niche || creator.niche.length === 0) && !creator.category) flags.push('No niche/category recorded');
  // Eligibility gate d'Alba: follower cao nhưng chưa từng chứng minh được GMV affiliate —
  // rủi ro sourcing (nổi tiếng nhưng chưa chắc bán được hàng affiliate), không loại hẳn khỏi
  // list, chỉ đánh dấu risk flag như các flag khác trong hàm này.
  if (creator.hasAffiliateGmv === false && followers !== undefined && criteria.highFollowerNoAffiliateThreshold != null && followers >= criteria.highFollowerNoAffiliateThreshold) {
    flags.push('High follower count but no proven affiliate GMV yet');
  }

  return { flags, penalty: Math.min(15, flags.length * 5) };
}

export function scoreCreator(creator: Creator, campaign?: Campaign, criteria: WorkspaceScoringCriteria = DEFAULT_SCORING_CRITERIA): CreatorScoreBreakdown {
  const groups = buildGroups(creator, campaign, criteria);

  const groupResults = groups.map(g => {
    const available = g.items.filter(i => i.value !== null);
    const availableWeight = available.reduce((s, i) => s + i.weightPct, 0);
    const scorePct = available.length === 0
      ? null
      : (available.reduce((s, i) => s + (i.value as number) * i.weightPct, 0) / availableWeight) * 100;
    return { ...g, available: available.length > 0, scorePct, items: g.items };
  });

  const usableGroups = groupResults.filter(g => g.scorePct !== null);
  const usableWeight = usableGroups.reduce((s, g) => s + g.weightPct, 0);
  const weightedScore = usableWeight > 0
    ? usableGroups.reduce((s, g) => s + (g.scorePct as number) * g.weightPct, 0) / usableWeight
    : 0;

  const { flags, penalty } = computeRiskFlags(creator, criteria);
  const totalScore = Math.round(clamp01((weightedScore - penalty) / 100) * 100);

  // A creator with zero scorable fields (not yet scraped/enriched) must not read the same
  // as one that scored poorly on every available metric — those are very different states.
  const recommendation =
    usableWeight === 0 ? 'Insufficient Data - Not Yet Scraped'
    : totalScore >= 85 ? 'Priority A - Immediate Outreach'
    : totalScore >= 70 ? 'Priority B - Recommended'
    : totalScore >= 50 ? 'Priority C - Optional'
    : 'Not Recommended';

  const allItems = groupResults.flatMap(g => g.items.filter(i => i.value !== null).map(i => ({ ...i, groupLabel: g.label })));
  const strengths = allItems.filter(i => i.value! >= 0.75).sort((a, b) => b.value! - a.value!).slice(0, 3).map(i => `${i.label} (${i.groupLabel})`);
  const weaknesses = allItems.filter(i => i.value! <= 0.4).sort((a, b) => a.value! - b.value!).slice(0, 3).map(i => `${i.label} (${i.groupLabel})`);

  return {
    totalScore,
    recommendation,
    groups: groupResults.map(g => ({ key: g.key, label: g.label, weightPct: g.weightPct, available: g.available, scorePct: g.scorePct !== null ? Math.round(g.scorePct) : null, items: g.items })),
    riskFlags: flags,
    strengths,
    weaknesses,
    scoredAt: new Date().toISOString(),
  };
}
