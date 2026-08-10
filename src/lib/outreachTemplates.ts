import { getAppConfig, setAppConfig } from '../db';
import type { Creator, Campaign } from '../types';

export type SequenceStage = 'first' | 'reminder_1' | 'reminder_2' | 'reminder_3';

export interface OutreachTemplate {
  subject: string;
  body: string;
}

export type OutreachTemplateSet = Record<SequenceStage, OutreachTemplate>;

const CONFIG_KEY = 'outreachTemplates';

// Last-resort fallback only — used when every configured AI provider has failed for a
// creator in a bulk-outreach batch (see server.ts /api/outreach/bulk/generate). Tokens are
// filled with real creator/campaign data so it's still somewhat personalized, but the
// operator always sees a "filled from template" warning before this can be sent.
const DEFAULT_TEMPLATES: OutreachTemplateSet = {
  first: {
    subject: 'Collaboration with {{brandName}} — {{campaignName}}',
    body:
      'Hi {{creatorName}} ({{handle}}),\n\n' +
      "This is a representative from {{brandName}}. We're running \"{{campaignName}}\" in the {{niche}} space " +
      "and your content looks like a great fit.\n\n" +
      "We'd love to have you join with a free product sample and a competitive commission rate. " +
      "Would you be interested in learning more?\n\nThank you!",
  },
  reminder_1: {
    subject: 'Re: Collaboration with {{brandName}} — {{campaignName}}',
    body:
      "Hi {{creatorName}}, just following up in case our last email got buried. " +
      "The {{campaignName}} collaboration offer is still open — we'd love to hear back from you.",
  },
  reminder_2: {
    subject: 'Re: Collaboration with {{brandName}} — {{campaignName}}',
    body:
      "Hi {{creatorName}}, we're happy to be flexible on the commission rate or send a product sample " +
      "for you to try first. If now isn't the right time, no worries — just let us know.",
  },
  reminder_3: {
    subject: 'Re: Collaboration with {{brandName}} — {{campaignName}}',
    body:
      "Hi {{creatorName}}, this will be our last follow-up for this round. " +
      "If you're interested down the line, feel free to reach out anytime — we'd love to work with you.",
  },
};

export async function getOutreachTemplates(): Promise<OutreachTemplateSet> {
  try {
    const data = await getAppConfig<Partial<OutreachTemplateSet> | null>(CONFIG_KEY, null);
    if (data) return { ...DEFAULT_TEMPLATES, ...data };
  } catch (err) {
    console.error('Error reading outreach templates:', err);
  }
  return DEFAULT_TEMPLATES;
}

export async function saveOutreachTemplates(templates: OutreachTemplateSet): Promise<OutreachTemplateSet> {
  await setAppConfig(CONFIG_KEY, templates);
  return templates;
}

function followerTier(followers?: number): string {
  if (!followers) return 'Creator';
  if (followers < 10_000) return 'Nano';
  if (followers < 100_000) return 'Micro';
  if (followers < 1_000_000) return 'Mid-tier';
  return 'Macro';
}

export async function fillOutreachTemplate(
  stage: SequenceStage,
  creator: Partial<Creator>,
  campaign?: Partial<Campaign>
): Promise<OutreachTemplate> {
  const template = (await getOutreachTemplates())[stage] || DEFAULT_TEMPLATES.first;
  const tokens: Record<string, string> = {
    creatorName: creator.displayName || 'Creator',
    handle: `@${creator.handle || 'handle'}`,
    niche: creator.niche?.join(', ') || creator.category || 'creative content',
    followerTier: followerTier(creator.followers),
    brandName: campaign?.brand || 'Pickdi Partner',
    campaignName: campaign?.name || 'General Campaign',
    productName: campaign?.products?.[0]?.name || 'our product',
  };

  const fill = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? '');

  return { subject: fill(template.subject), body: fill(template.body) };
}
