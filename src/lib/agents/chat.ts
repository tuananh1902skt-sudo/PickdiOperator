import type { Creator, Campaign } from '../../types';
import type { AgentDefinition } from './types';

export interface CopilotChatContext {
  prompt: string;
  messages?: { role: string; text: string }[];
  creator?: Creator | null;
  campaign?: Campaign | null;
  totalCreators: number;
  totalCampaigns: number;
}

// General copilot — free-form text agent (not JSON), reused as-is from the original
// /api/ai/chat route, just moved into the registry.
export const copilotChatAgent: AgentDefinition<CopilotChatContext> = {
  id: 'ops.copilot_chat',
  label: 'Ops — Copilot Chat',
  defaultInstructions: `5. Keep responses structured, professional, friendly, and in Vietnamese (or match the user's query language).`,
  buildPrompt: (ctx, instructions) => {
    const { creator, campaign } = ctx;

    const cContext = creator ? `
Current Selected Creator in CRM:
- Handle: @${creator.handle}
- Display Name: ${creator.displayName}
- Category: ${creator.category || 'N/A'}
- Followers: ${creator.followers !== undefined ? creator.followers.toLocaleString() : 'Chưa cào dữ liệu (Missing)'}
- Avg Views: ${creator.avgViews !== undefined ? creator.avgViews.toLocaleString() : 'Chưa cào dữ liệu (Missing)'}
- Engagement Rate: ${creator.engagementRate !== undefined ? creator.engagementRate + '%' : 'Chưa cào dữ liệu (Missing)'}
- Status in CRM: ${creator.status}
- Bio: ${creator.bio || 'N/A'}
` : 'No creator selected.';

    const cmpContext = campaign ? `
Current Selected Campaign:
- Name: ${campaign.name}
- Brand: ${campaign.brand}
- Objective: ${campaign.objective}
- Budget: $${campaign.budget}
` : 'No campaign selected.';

    const systemInstruction = `You are Pickdi AI Affiliate Operator Copilot, powered by Gemini 3.6.
You assist TikTok Shop managers with affiliate creator operations, outreach, negotiations, and video reviews.

Context from CRM:
${cContext}
${cmpContext}

Total Creators in CRM: ${ctx.totalCreators}
Total Campaigns in CRM: ${ctx.totalCampaigns}

RESPONSE FORMATTING & LAYOUT INSTRUCTIONS:
1. Format your response using clean Markdown with headers (e.g. ### 📌 Header), bullet points (- ), bold key terms (**...**), and callout blocks (> ...).
2. Avoid dense, unformatted walls of text. Ensure generous, clean paragraph breaks between sections.
3. If providing instructions or action steps:
   - Use bold step titles (e.g., **Bước 1: Mở Extension**).
   - Use bullet points or numbered lists for sub-items.
   - Highlight important notes or warnings using callouts (e.g., > 💡 **Lưu ý:** ...).
4. IF DATA IS MISSING OR NOT SCRAPED YET (e.g., follower count or average views is missing/undefined), EXPLICITLY TELL THE USER in a clean callout box that the creator hasn't been scraped via the Pickdi TikTok Extension yet, rather than guessing or making up numbers.
${instructions}`;

    const chatHistoryText = Array.isArray(ctx.messages)
      ? ctx.messages.slice(-6).map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.text}`).join('\n')
      : '';

    return `${systemInstruction}\n\nRecent Chat History:\n${chatHistoryText}\n\nUser Message: ${ctx.prompt}`;
  },
};
