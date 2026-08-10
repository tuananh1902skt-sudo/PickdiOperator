import type { Creator, Campaign, Conversation, OutreachEmail } from '../../types';
import type { AgentDefinition } from './types';

export interface OutreachEmailContext {
  creator?: Partial<Creator>;
  campaign?: Partial<Campaign>;
  tone?: string;
  // Opening lines / phrasings already used by other drafts generated earlier in the same
  // bulk-outreach batch (see server.ts /api/outreach/bulk/generate) — passed so the model
  // avoids producing N emails that all open the same way ("Hi {name}, hope this finds
  // you well..."). Omitted entirely for single-send callers (no behavior change there).
  avoidPhrasings?: string[];
}

function followerTier(followers?: number): string {
  if (!followers) return 'unknown';
  if (followers < 10_000) return 'Nano (<10K)';
  if (followers < 100_000) return 'Micro (10K-100K)';
  if (followers < 1_000_000) return 'Mid-tier (100K-1M)';
  return 'Macro (1M+)';
}

function recentContentLine(creator?: Partial<Creator>) {
  const titles = (creator?.recentVideos || []).slice(0, 2).map(v => v.title).filter(Boolean);
  return titles.length ? titles.join(' | ') : 'No recent video data available';
}

function creatorLine(creator?: Partial<Creator>) {
  return `Creator Name: ${creator?.displayName || 'Creator'} (@${creator?.handle || 'handle'})
Category/Niche: ${creator?.category || 'General'}${creator?.niche?.length ? ` (${creator.niche.join(', ')})` : ''}
Country/Language: ${creator?.country || 'Unknown'}
Follower Tier: ${followerTier(creator?.followers)}
Engagement Rate: ${creator?.engagementRate ? `${creator.engagementRate}%` : 'unknown'}
Recent Content Topics: ${recentContentLine(creator)}`;
}

function avoidPhrasingsBlock(avoidPhrasings?: string[]) {
  if (!avoidPhrasings || avoidPhrasings.length === 0) return '';
  return `\nDo NOT reuse these opening lines / phrasings already used in this batch — write a genuinely different opening and structure:\n${avoidPhrasings.map(p => `- ${p}`).join('\n')}\n`;
}

function campaignLine(campaign?: Partial<Campaign>) {
  return `Campaign: ${campaign?.name || 'General Campaign'}
Brand: ${campaign?.brand || 'Pickdi Partner'}
Objective: ${campaign?.objective || 'Promote product on TikTok Shop'}
Product: ${campaign?.products?.[0]?.name || 'Gifted Sample & Commission'}`;
}

// Language matching is NOT part of the editable instructions — it's derived from live
// creator data and always applies, regardless of what the operator customizes.
function languageRule(creator?: Partial<Creator>) {
  return `Language: Match creator country (${creator?.country === 'Vietnam' ? 'Vietnamese' : 'English'}).`;
}

const EMAIL_JSON_CONTRACT = `Output strict JSON:
{
  "subject": "Subject line string",
  "body": "Full email text formatted with line breaks",
  "cta": "Single clear call to action statement",
  "followUpSuggestion": "Suggested follow-up reminder note in 3 days"
}`;

// Stage 1 — first outreach email to a brand-new lead. Leads with the offer, no history to
// reference yet.
export const outreachFirstContactAgent: AgentDefinition<OutreachEmailContext> = {
  id: 'outreach.first_contact',
  label: 'Outreach — First Contact',
  defaultInstructions: `1. ALWAYS lead with the commission structure and gifted product offer clearly ("Lead with commission" rule).
2. Keep the tone warm, authentic, and concise.
3. This is the FIRST message — introduce the brand briefly, no assumption of prior contact.`,
  cacheKey: (ctx) => `outreach.first_contact:${ctx.creator?.id || ctx.creator?.handle}:${ctx.campaign?.id || 'general'}:${ctx.tone || 'default'}:${ctx.avoidPhrasings?.length ?? 0}`,
  buildPrompt: (ctx, instructions) => `Generate a high-converting TikTok Shop Affiliate FIRST-CONTACT outreach email — this creator has never been contacted before.

${creatorLine(ctx.creator)}
${campaignLine(ctx.campaign)}

RULES & CONVENTIONS:
${instructions}
${ctx.tone ? `Requested tone override: ${ctx.tone}.` : ''}
${languageRule(ctx.creator)}
${avoidPhrasingsBlock(ctx.avoidPhrasings)}
${EMAIL_JSON_CONTRACT}`,
};

export interface ReminderContext extends OutreachEmailContext {
  originalOutreach?: Partial<OutreachEmail>;
  daysSinceLastContact?: number;
}

function reminderCacheKey(stage: string) {
  return (ctx: ReminderContext) =>
    `outreach.${stage}:${ctx.originalOutreach?.id || ctx.creator?.id}:${ctx.daysSinceLastContact ?? 0}:${ctx.avoidPhrasings?.length ?? 0}`;
}

function reminderPreamble(ctx: ReminderContext) {
  return `${creatorLine(ctx.creator)}
${campaignLine(ctx.campaign)}
Original message subject: ${ctx.originalOutreach?.subject || '(unknown)'}
Days since last contact: ${ctx.daysSinceLastContact ?? 'unknown'}`;
}

// Stage 2 — reminder #1: a light, low-pressure nudge. Most creators just missed the email;
// don't act like they said no.
export const outreachReminder1Agent: AgentDefinition<ReminderContext> = {
  id: 'outreach.reminder_1',
  label: 'Outreach — Reminder #1',
  defaultInstructions: `1. Tone: light, friendly, brief — assume they simply missed the first email, not that they declined. Lean on "didn't want this to get buried in your inbox" as the framing.
2. Reference the original offer in one short line, don't repeat the full pitch — this email reuses the same product card/offer layout as the first email, your body text only replaces the opening line.
3. Do NOT start with "Hi {name}," — that greeting is already rendered separately above your text. Start directly with the follow-up line.
4. Subject must NOT be a literal "Re: ..." — write a fresh standalone subject that itself signals this is a follow-up (e.g. "Following Up: ..."), and must contain the word "Paid".
5. Keep it under 60 words in the body.`,
  cacheKey: reminderCacheKey('reminder_1'),
  buildPrompt: (ctx, instructions) => `Generate a REMINDER #1 follow-up email for a creator who has not replied to our first outreach message yet.

${reminderPreamble(ctx)}

RULES:
${instructions}
${languageRule(ctx.creator)}
${avoidPhrasingsBlock(ctx.avoidPhrasings)}
${EMAIL_JSON_CONTRACT}`,
};

// Stage 3 — reminder #2: add extra value/incentive since a light nudge alone didn't work.
export const outreachReminder2Agent: AgentDefinition<ReminderContext> = {
  id: 'outreach.reminder_2',
  label: 'Outreach — Reminder #2',
  defaultInstructions: `1. Tone: still warm, but add a concrete extra incentive or flexibility (e.g. "happy to send a sample first", "commission rate is negotiable", "no pressure, just checking if timing works better now"). Keep the "don't want this to slip through the cracks / get lost" framing since two emails have gone unanswered.
2. Do NOT sound pushy or guilt-trip the creator.
3. Do NOT start with "Hi {name}," — that greeting is already rendered separately above your text. Start directly with the follow-up line.
4. Subject must NOT be a literal "Re: ..." — write a fresh standalone subject that itself signals this is a follow-up, and must contain the word "Paid".
5. Keep it under 80 words in the body.`,
  cacheKey: reminderCacheKey('reminder_2'),
  buildPrompt: (ctx, instructions) => `Generate a REMINDER #2 follow-up email — this creator has not responded to the first outreach or the first reminder.

${reminderPreamble(ctx)}

RULES:
${instructions}
${languageRule(ctx.creator)}
${avoidPhrasingsBlock(ctx.avoidPhrasings)}
${EMAIL_JSON_CONTRACT}`,
};

// Stage 4 — reminder #3 / close-out: last attempt, politely close the loop so the creator
// doesn't feel spammed and the door stays open for the future.
export const outreachReminder3Agent: AgentDefinition<ReminderContext> = {
  id: 'outreach.reminder_3',
  label: 'Outreach — Reminder #3 (Close-out)',
  defaultInstructions: `1. Tone: respectful, no pressure — this is the last message in this sequence. Frame it as a final/limited-time opportunity (scarcity, not guilt) — e.g. "closing out this round of collaborations soon".
2. Explicitly leave the door open ("feel free to reach out anytime if interested later"), don't demand a response.
3. Do NOT start with "Hi {name}," — that greeting is already rendered separately above your text. Start directly with the follow-up line.
4. Subject must convey scarcity/last-chance framing (e.g. "Last Chance: ...") and must contain the word "Paid" — not a literal "Re: ...".
5. Keep it under 60 words in the body.
6. followUpSuggestion should say "Move to closed / re-approach in 60 days" rather than suggest another immediate follow-up.`,
  cacheKey: reminderCacheKey('reminder_3'),
  buildPrompt: (ctx, instructions) => `Generate a FINAL follow-up / polite close-out email — this creator has not responded to two prior messages.

${reminderPreamble(ctx)}

RULES:
${instructions}
${languageRule(ctx.creator)}
${avoidPhrasingsBlock(ctx.avoidPhrasings)}
${EMAIL_JSON_CONTRACT}`,
};

export const OUTREACH_SEQUENCE_AGENTS: Record<string, AgentDefinition<ReminderContext>> = {
  first: outreachFirstContactAgent,
  reminder_1: outreachReminder1Agent,
  reminder_2: outreachReminder2Agent,
  reminder_3: outreachReminder3Agent,
};

export interface NegotiationReplyContext {
  conversation?: Partial<Conversation>;
  creator?: Partial<Creator>;
  campaign?: Partial<Campaign>;
}

export const negotiationReplyAgent: AgentDefinition<NegotiationReplyContext> = {
  id: 'negotiation.reply',
  label: 'Negotiation — Reply Suggestion',
  defaultInstructions: `1. Analyze rate asks or conditions if present.
2. If no prior message thread exists, suggest a professional initial follow-up or negotiation opener.`,
  cacheKey: (ctx) => `negotiation.reply:${ctx.conversation?.id || ctx.creator?.id}:${ctx.conversation?.messages?.length || 0}`,
  buildPrompt: (ctx, instructions) => {
    const messagesText = ctx.conversation?.messages?.length
      ? ctx.conversation.messages
          .map((m: any) => `${m.senderName} (${m.senderType}): ${m.content}`)
          .join('\n')
      : 'No prior message history between Brand and Creator yet.';

    return `You are an Affiliate Negotiation Specialist. Suggest an optimal reply to this creator's conversation thread.

Creator: ${ctx.creator?.displayName || 'Creator'} (@${ctx.creator?.handle || 'handle'})
Campaign Budget: $${ctx.campaign?.budget || 0}
Latest Thread:
${messagesText}

Instructions:
${instructions}
Output strict JSON:
{
  "suggestedReply": "The text reply ready to send",
  "negotiationStrategy": "Short explanation of the negotiation rationale",
  "suggestedNextAction": "Assign Campaign" | "Counter Offer" | "Request Shipping Address" | "Close Deal"
}`;
  },
};
