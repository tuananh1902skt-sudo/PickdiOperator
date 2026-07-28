import type { AgentDefinition } from './types';

export interface DailySummaryContext {
  todayEmailsSent: number;
  todayRepliesReceived: number;
  pendingReviewsCount: number;
  pendingTasksCount: number;
}

export const opsDailySummaryAgent: AgentDefinition<DailySummaryContext> = {
  id: 'ops.daily_summary',
  label: 'Ops — Daily Summary',
  defaultInstructions: `Keep the progress summary factual and the recommendation specific to outreach, not generic productivity advice.`,
  buildPrompt: (ctx, instructions) => `Summarize today's TikTok Shop Affiliate Operations digest:
Emails Sent: ${ctx.todayEmailsSent}
Replies Received: ${ctx.todayRepliesReceived}
Pending Reviews: ${ctx.pendingReviewsCount}
Pending Tasks: ${ctx.pendingTasksCount}

${instructions}
Generate an executive daily summary in JSON:
{
  "progressSummary": "2 sentence summary of today's key wins",
  "urgentPriorities": ["Urgent task 1", "Urgent task 2"],
  "aiRecommendation": "Strategic recommendation for tomorrow's outreach focus"
}`,
};

export interface PrioritySuggesterContext {
  openCampaigns: { name: string; status: string; creatorCount: number }[];
  staleConversations: { creatorName: string; status: string; daysSinceLastMessage: number }[];
  pendingReviews: { creatorName: string; videoTitle: string; dueAt: string }[];
  overdueTasks: { title: string; priority: string; dueDate: string }[];
}

// Replaces the previously-hardcoded dashboard banner (which just printed a canned string
// around recentReplies[0]) with a real judgment call over everything currently open.
export const opsPrioritySuggesterAgent: AgentDefinition<PrioritySuggesterContext> = {
  id: 'ops.priority_suggester',
  label: 'Ops — Priority Suggester',
  defaultInstructions: `1. Pick the SINGLE most urgent item across all four lists and explain why in one sentence (not a generic "review your inbox" answer).
2. If everything above is empty, say there is genuinely nothing urgent — do not invent a task.`,
  cacheKey: (ctx) =>
    `ops.priority_suggester:${ctx.openCampaigns.length}:${ctx.staleConversations.length}:${ctx.pendingReviews.length}:${ctx.overdueTasks.length}`,
  cacheTtlMs: 15 * 60 * 1000,
  buildPrompt: (ctx, instructions) => `You are an Affiliate Operations Lead. Look at everything currently open across campaigns, conversations, reviews, and tasks, and decide what the operator should do FIRST today.

Open Campaigns:
${ctx.openCampaigns.map((c) => `- ${c.name} (${c.status}, ${c.creatorCount} creators)`).join('\n') || '(none)'}

Conversations Waiting on a Reply (creator side quiet):
${ctx.staleConversations.map((c) => `- ${c.creatorName} — ${c.status}, ${c.daysSinceLastMessage} days since last message`).join('\n') || '(none)'}

Pending Content Reviews:
${ctx.pendingReviews.map((r) => `- ${r.creatorName}: "${r.videoTitle}" due ${r.dueAt}`).join('\n') || '(none)'}

Overdue/Pending Tasks:
${ctx.overdueTasks.map((t) => `- [${t.priority}] ${t.title} (due ${t.dueDate})`).join('\n') || '(none)'}

Instructions:
${instructions}
Output strict JSON:
{
  "priorityAction": "One sentence: what to do right now and for which creator/campaign",
  "reasoning": "Why this is the most urgent item, referencing the specific data above",
  "secondaryActions": ["Next most important thing 1", "Next most important thing 2"]
}`,
};
