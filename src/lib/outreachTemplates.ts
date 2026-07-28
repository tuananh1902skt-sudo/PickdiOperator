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
    subject: 'Hợp tác cùng {{brandName}} — {{campaignName}}',
    body:
      'Xin chào {{creatorName}} ({{handle}}),\n\n' +
      'Mình là đại diện {{brandName}}. Team đang chạy chương trình "{{campaignName}}" trong ngành {{niche}} ' +
      'và thấy nội dung của bạn rất phù hợp.\n\n' +
      'Bên mình mời bạn tham gia với mẫu sản phẩm tặng kèm và mức hoa hồng hấp dẫn. ' +
      'Bạn có quan tâm tìm hiểu thêm không?\n\nCảm ơn bạn!',
  },
  reminder_1: {
    subject: 'Re: Hợp tác cùng {{brandName}} — {{campaignName}}',
    body:
      'Chào {{creatorName}}, mình nhắn lại xem bạn đã xem email trước chưa. ' +
      'Lời mời hợp tác {{campaignName}} vẫn còn hiệu lực, rất mong nhận được phản hồi từ bạn.',
  },
  reminder_2: {
    subject: 'Re: Hợp tác cùng {{brandName}} — {{campaignName}}',
    body:
      'Chào {{creatorName}}, bên mình có thể linh hoạt về mức hoa hồng hoặc gửi mẫu sản phẩm trước ' +
      'để bạn trải nghiệm. Nếu thời điểm này chưa phù hợp cũng không sao, cho mình biết nhé.',
  },
  reminder_3: {
    subject: 'Re: Hợp tác cùng {{brandName}} — {{campaignName}}',
    body:
      'Chào {{creatorName}}, đây là lần nhắn cuối của mình trong đợt này. ' +
      'Nếu sau này bạn quan tâm, cứ thoải mái liên hệ lại — bên mình luôn chào đón hợp tác cùng bạn.',
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
    niche: creator.niche?.join(', ') || creator.category || 'nội dung sáng tạo',
    followerTier: followerTier(creator.followers),
    brandName: campaign?.brand || 'Pickdi Partner',
    campaignName: campaign?.name || 'General Campaign',
    productName: campaign?.products?.[0]?.name || 'sản phẩm mẫu',
  };

  const fill = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key) => tokens[key] ?? '');

  return { subject: fill(template.subject), body: fill(template.body) };
}
