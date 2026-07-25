// Chấm điểm brand-fit xác định (deterministic) cho creator, thay thế hoàn toàn cho việc
// dùng Gemini đoán điểm theo cảm tính. Toàn bộ input đều là field thật đã có trên Creator/
// Campaign — không có field nào bị bịa ra để công thức "trông đầy đủ".
//
// Nguyên tắc thiếu dữ liệu: mỗi dòng con (item) không có data thì bị loại khỏi nhóm của nó,
// trọng số dồn cho các dòng con còn lại TRONG CÙNG NHÓM. Nếu cả nhóm không có dòng con nào
// khả dụng (vd chưa truyền campaign nên không chấm được Audience Fit), trọng số của cả nhóm
// dồn sang các nhóm khác — không tự ý gán điểm trung tính giả cho một nhóm rỗng.
import { Creator, Campaign, CreatorScoreBreakdown } from './types';

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

// So creator với benchmark chính chủ TikTok trả về — value >= 1.5x benchmark thì full điểm.
function benchmarkRatioScore(value: unknown, benchmark: unknown): number | undefined {
  const v = toNumber(value);
  const b = toNumber(benchmark);
  if (v === undefined || b === undefined || b <= 0) return undefined;
  return clamp01(v / (b * 1.5));
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

function postingConsistencyScore(freq30d: number | undefined): number | null {
  if (freq30d === undefined) return null;
  if (freq30d < 2) return 0.1;
  if (freq30d < 8) return 0.1 + ((freq30d - 2) / 6) * 0.9;
  if (freq30d <= 30) return 1.0;
  if (freq30d <= 60) return 1.0 - ((freq30d - 30) / 30) * 0.5;
  return 0.3;
}

function viewStabilityScore(maxMinRatio: number | undefined): number | null {
  if (maxMinRatio === undefined) return null;
  if (maxMinRatio <= 3) return 1.0;
  if (maxMinRatio >= 20) return 0;
  return clamp01(1 - (maxMinRatio - 3) / 17);
}

function niceOverlapScore(list: string[] | undefined, targets: string[]): number | null {
  if (!list || list.length === 0 || targets.length === 0) return null;
  const normTargets = targets.map(t => t.toLowerCase());
  const matched = list.filter(v => normTargets.includes(v.toLowerCase())).length;
  return clamp01(matched / targets.length);
}

function buildGroups(creator: Creator, campaign?: Campaign): ScoreGroup[] {
  const followers = toNumber(creator.followers);
  const maxMinRatio = toNumber(creator.maxMinRatio);
  const targetAudience = campaign?.targetAudience;

  const groups: ScoreGroup[] = [
    {
      key: 'content',
      label: 'Content Performance',
      weightPct: 30,
      items: [
        { key: 'engagementRate', label: 'Engagement rate vs benchmark', weightPct: 12, value: benchmarkRatioScore(creator.engagementRate, creator.engagementRateBenchmark) ?? null },
        { key: 'sixSecondViewRate', label: '6s view rate vs benchmark', weightPct: 9, value: benchmarkRatioScore(creator.sixSecondViewRate, creator.sixSecondViewRateBenchmark) ?? null },
        { key: 'medianViews', label: 'Median views vs benchmark', weightPct: 9, value: benchmarkRatioScore(creator.medianViews, creator.medianViewsBenchmark) ?? null },
      ],
    },
    {
      key: 'followerTier',
      label: 'Follower Tier',
      weightPct: 10,
      items: [
        { key: 'tier', label: 'Follower tier', weightPct: 10, value: followerTierScore(followers) },
      ],
    },
    {
      key: 'ops',
      label: 'Ops Reliability',
      weightPct: 20,
      items: [
        { key: 'postingConsistency', label: 'Posting frequency consistency', weightPct: 10, value: postingConsistencyScore(toNumber(creator.postingFrequency30d)) },
        { key: 'viewStability', label: 'View stability (not one-hit-wonder)', weightPct: 10, value: viewStabilityScore(maxMinRatio) },
      ],
    },
  ];

  // Niche Fit và Audience Fit chỉ chấm được khi có campaign để so khớp — không có campaign
  // thì bỏ hẳn 2 nhóm này, KHÔNG gán điểm trung tính giả, trọng số dồn sang nhóm khác.
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

function computeRiskFlags(creator: Creator): { flags: string[]; penalty: number } {
  const flags: string[] = [];
  const maxMinRatio = toNumber(creator.maxMinRatio);

  if (creator.lastVideoDate) {
    const daysSince = (Date.parse(new Date().toISOString()) - Date.parse(creator.lastVideoDate)) / 86400000;
    if (Number.isFinite(daysSince) && daysSince > 90) flags.push('No new video in the last 90 days');
  }
  if (maxMinRatio !== undefined && maxMinRatio > 15) flags.push('View performance depends heavily on a single viral video');
  if ((!creator.niche || creator.niche.length === 0) && !creator.category) flags.push('No niche/category recorded');

  return { flags, penalty: Math.min(15, flags.length * 5) };
}

export function scoreCreator(creator: Creator, campaign?: Campaign): CreatorScoreBreakdown {
  const groups = buildGroups(creator, campaign);

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

  const { flags, penalty } = computeRiskFlags(creator);
  const totalScore = Math.round(clamp01((weightedScore - penalty) / 100) * 100);

  const recommendation =
    totalScore >= 85 ? 'Priority A - Immediate Outreach'
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
