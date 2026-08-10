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
  // Reminder bodies render as the hero's intro paragraph (replacing the fixed first-contact
  // pitch line — see introText in emailTemplate.ts), right below "Hi {creatorName},", so they
  // should NOT repeat the greeting themselves. Reminder 1/2 read as "didn't want this to get
  // buried/lost"; reminder 3 (final) leans into scarcity/FOMO instead.
  reminder_1: {
    subject: "Following Up: Paid Collaboration Opportunity | {{brandName}}",
    body:
      "Just want to make sure this doesn't get lost in your inbox — the paid collaboration opportunity " +
      "with {{brandName}} for {{productName}} is still open, and we'd genuinely love to hear from you.",
  },
  reminder_2: {
    subject: "Don't Miss This — Paid Collaboration | {{brandName}}",
    body:
      "Following up once more so this doesn't slip through the cracks — happy to be flexible on the " +
      "commission rate or send {{productName}} for you to try first, whatever makes it easier to say yes.",
  },
  reminder_3: {
    subject: 'Last Chance: Paid Collaboration Opportunity | {{brandName}}',
    body:
      "This will be our last note on this — we're closing out this round of paid collaborations soon and " +
      "didn't want you to miss out on {{productName}} with {{brandName}}. The door's always open if the timing works better later.",
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
