import type { AgentDefinition } from './types';

export interface ReviewComplianceContext {
  videoTitle?: string;
  campaignName?: string;
  draftUrl?: string;
}

// Metadata-only compliance review (no video/frame analysis yet — that would need a real
// ingest pipeline). This agent now also fills the ContentReview.checklist fields directly
// instead of leaving them for a human to infer from free-text feedback.
export const reviewComplianceChecklistAgent: AgentDefinition<ReviewComplianceContext> = {
  id: 'review.compliance_checklist',
  label: 'Review — Compliance Checklist',
  defaultInstructions: `Do NOT make up numerical quality or visibility scores you cannot justify from the title/campaign context — when uncertain, set the boolean to false and say so in keyObservations.`,
  buildPrompt: (ctx, instructions) => `Analyze this draft video submission for TikTok Shop compliance based ONLY on metadata.
NOTE: The actual video file/content is NOT available for visual analysis. ${instructions}

Title: ${ctx.videoTitle || 'Chưa cung cấp tiêu đề video'}
Campaign: ${ctx.campaignName || 'N/A'}
Draft URL: ${ctx.draftUrl || 'N/A'}

Generate qualitative metadata evaluation in JSON format:
{
  "keyObservations": ["Observation 1 based on title and campaign context", "Observation 2"],
  "improvementSuggestions": "Actionable feedback for creator based on metadata",
  "recommendation": "APPROVED" | "REVISION_REQUIRED" | "REJECTED",
  "checklist": {
    "productVisible": false,
    "brandMentioned": false,
    "ctaPresent": false,
    "linkCorrect": false,
    "compliance": false,
    "hookQualityScore": 0
  },
  "analysisScope": "metadata-only"
}`,
};
