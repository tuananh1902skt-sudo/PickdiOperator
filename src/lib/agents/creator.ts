import type { Creator, Campaign, CreatorScoreBreakdown } from '../../types';
import type { AgentDefinition } from './types';

export interface CreatorResearchContext {
  creator: Partial<Creator>;
  campaign?: Partial<Campaign>;
  breakdown: CreatorScoreBreakdown;
}

// Reasons over the deterministic score breakdown + bio/tags/notes to produce an actual
// LLM judgment call — distinct from scoreCreator() itself, which stays deterministic.
export const creatorDeepResearchAgent: AgentDefinition<CreatorResearchContext> = {
  id: 'creator.deep_research',
  label: 'Creator — Deep Research',
  defaultInstructions: `1. Explain WHY the score groups landed where they did in plain language, referencing the bio/niche/notes when relevant.
2. Call out any mismatch between the note history and the current status/score that a human should double-check.
3. Give a clear final recommendation, not just a restatement of the deterministic one.`,
  cacheKey: (ctx) => `creator.deep_research:${ctx.creator?.id}:${ctx.campaign?.id || 'baseline'}:${ctx.breakdown?.scoredAt}`,
  buildPrompt: (ctx, instructions) => {
    const { creator, campaign, breakdown } = ctx;
    const groupLines = breakdown.groups
      .filter((g) => g.available)
      .map((g) => `- ${g.label}: ${g.scorePct}/100`)
      .join('\n') || '(Không đủ dữ liệu để chấm nhóm nào)';

    const notesText = (creator.notes || [])
      .slice(-5)
      .map((n) => `- ${n.createdAt}: ${n.content}`)
      .join('\n') || '(Chưa có ghi chú nào)';

    return `You are an Affiliate Creator Research Analyst. Read the data below and give a genuine, reasoned judgment — do not just restate the numbers.

Creator: ${creator.displayName || creator.handle} (@${creator.handle})
Category: ${creator.category || 'N/A'} | Niche: ${(creator.niche || []).join(', ') || 'N/A'}
Bio: ${creator.bio || '(trống)'}
Tags: ${(creator.tags || []).join(', ') || '(không có)'}
Followers: ${creator.followers ?? 'N/A'} | Avg Views: ${creator.avgViews ?? 'N/A'} | Engagement: ${creator.engagementRate ?? 'N/A'}%

Deterministic Score Breakdown (already computed, do not recompute — reason ABOUT it):
Total Score: ${breakdown.totalScore}/100 — ${breakdown.recommendation}
${groupLines}
Risk Flags: ${breakdown.riskFlags.join('; ') || 'None'}

Recent Notes History:
${notesText}

${campaign ? `Evaluating for Campaign: ${campaign.name} (${campaign.brand}) — Objective: ${campaign.objective}` : 'No specific campaign selected — general fit assessment.'}

Instructions:
${instructions}
Output strict JSON:
{
  "reasoning": "2-4 sentence analysis explaining the score in context of bio/niche/notes",
  "opportunities": ["Concrete opportunity 1", "Concrete opportunity 2"],
  "risks": ["Concrete risk or thing to verify 1"],
  "recommendation": "Your own recommendation sentence, informed by but not identical to the deterministic one"
}`;
  },
};
