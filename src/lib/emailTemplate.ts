// Fixed marketing-style HTML shells for outreach emails — one layout per sequence stage
// (first-contact gets the rich "Piedmont Ethereal" product/CTA/checklist version,
// reminders get the plain version), same for every campaign/creator; only the text
// content changes.
//
// Pure string building, no Node-only APIs or external CSS/JS (Tailwind CDN, web fonts,
// <script>) — those get stripped or silently fail in real email clients, so everything
// here is inline style + table layout, the only combination that renders consistently
// across Gmail/Outlook/Naver Works Mail etc. Georgia stands in for the brand's Bodoni
// Moda serif (closest system font, since Google Fonts links get stripped by most email
// clients). Safe to import from both server.ts (the email actually sent) and outreach
// UI components (live preview).

export interface OutreachEmailTemplateData {
  bodyText: string;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  ctaLabel?: string;
  ctaHref?: string;
  signatureName?: string;
}

export interface FirstContactEmailTemplateData {
  creatorName?: string;
  senderName?: string;
  senderTitle?: string;
  brandName?: string;
  logoUrl?: string;
  primaryColor?: string;
  productName?: string;
  productImageUrl?: string;
  // Direct link to the product on TikTok Shop — when set, the CTA points here instead
  // of the mailto "reply to this email" fallback.
  productUrl?: string;
  // Social-proof + USP line items for the product card — all optional, card drops the
  // rating line / checklist cleanly when unset.
  productRating?: number;
  productReviewCount?: number;
  productSoldCount?: string;
  productHighlights?: string[];
  // Free-text starting compensation pitch, e.g. "$100 for a package of 10 videos (open
  // to discussion based on your rate)" — a negotiation opener, not a fixed rate.
  compensationOffer?: string;
  // Optional extra paragraph(s) the operator/AI adds on top of the fixed pitch copy.
  bodyText?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

const DEFAULT_PRIMARY_COLOR = '#4f46e5'; // indigo-600 — used by the plain reminder template
const GOLD_PRIMARY_COLOR = '#735c00'; // Piedmont Ethereal "primary" — first-contact template
const GOLD_ACCENT_COLOR = '#d4af37'; // Piedmont Ethereal "primary-container", gradient end
const DEFAULT_CTA_LABEL = 'Trả lời email này để hợp tác';
const DEFAULT_PRODUCT_CTA_LABEL = 'View on TikTok Shop';
const DEFAULT_SENDER_TITLE = 'TikTok Shop Manager';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Plain-text body → paragraphs, one per blank-line-separated block, preserving single
// line breaks within a paragraph as <br>. Escapes first so creator/AI-authored text can
// never inject markup into the outgoing email.
function bodyTextToHtml(bodyText: string): string {
  return bodyText
    .split(/\n{2,}/)
    .map(block => escapeHtml(block.trim()).replace(/\n/g, '<br>'))
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 16px;">${p}</p>`)
    .join('\n');
}

function logoBlockHtml(brandName: string, logoUrl: string | undefined, textColor: string): string {
  return logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="${brandName}" width="120" style="display:block;max-width:120px;height:auto;border:0;">`
    : `<span style="font-size:18px;font-weight:700;color:${textColor};letter-spacing:0.04em;">${brandName}</span>`;
}

function ctaButtonHtml(href: string, label: string, gradientFrom: string, gradientTo: string): string {
  return `
    <tr>
      <td align="center" style="padding:8px 0 28px;">
        <a href="${escapeHtml(href)}"
           style="display:inline-block;background:${gradientFrom};background:linear-gradient(90deg, ${gradientFrom}, ${gradientTo});
                  color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.1em;
                  text-transform:uppercase;padding:16px 32px;border-radius:12px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>`;
}

function shell(headerHtml: string, middleHtml: string, footerHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
            ${headerHtml}
            ${middleHtml}
            ${footerHtml}
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Reminder sequence (stage 2-4) and generic fallback — plain body + optional CTA, no
// product highlight or checklist since the pitch was already made in the first email.
export function renderOutreachEmailHtml(data: OutreachEmailTemplateData): string {
  const brandName = escapeHtml(data.brandName || 'Pickdi Partner');
  const primaryColor = data.primaryColor || DEFAULT_PRIMARY_COLOR;
  const signatureName = escapeHtml(data.signatureName || data.brandName || 'Pickdi Partner');

  const header = `
    <tr>
      <td style="background:${primaryColor};padding:24px 32px;">
        ${logoBlockHtml(brandName, data.logoUrl, '#ffffff')}
      </td>
    </tr>`;

  const middle = `
    <tr>
      <td style="padding:32px 32px 8px;color:#1e293b;font-size:15px;line-height:1.6;">
        ${bodyTextToHtml(data.bodyText || '')}
      </td>
    </tr>
    ${data.ctaHref ? ctaButtonHtml(data.ctaHref, data.ctaLabel || DEFAULT_CTA_LABEL, primaryColor, primaryColor) : ''}`;

  const footer = `
    <tr>
      <td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;line-height:1.5;">
        ${signatureName}
      </td>
    </tr>`;

  return shell(header, middle, footer);
}

// First-contact email — "Piedmont Ethereal" template: serif hero greeting, product
// highlight card, fixed compensation pitch copy, gold gradient CTA, numbered next-steps,
// and a signed sign-off. Structured fields instead of one freeform body because the
// wording itself (not just the layout) is fixed per the approved copy — bodyText is
// only an optional extra paragraph the operator/AI can tack on.
export function renderFirstContactEmailHtml(data: FirstContactEmailTemplateData): string {
  const brandName = escapeHtml(data.brandName || 'Pickdi Partner');
  const creatorName = escapeHtml(data.creatorName || 'Creator');
  const senderName = escapeHtml(data.senderName || 'Juan');
  const senderTitle = escapeHtml(data.senderTitle || DEFAULT_SENDER_TITLE);
  const primaryColor = data.primaryColor || GOLD_PRIMARY_COLOR;
  const accentColor = data.primaryColor ? data.primaryColor : GOLD_ACCENT_COLOR;

  const header = `
    <tr>
      <td align="center" style="background:#ffffff;padding:28px 32px;border-bottom:1px solid rgba(26,26,26,0.08);">
        ${logoBlockHtml(brandName, data.logoUrl, '#1a1c1c')}
      </td>
    </tr>`;

  const hero = `
    <tr>
      <td align="center" style="padding:40px 32px 8px;">
        <div style="font-family:Georgia,'Times New Roman',serif;font-size:30px;color:${primaryColor};margin-bottom:12px;">
          Hi ${creatorName},
        </div>
        <p style="margin:0;font-size:15px;line-height:1.6;color:#4d4635;">
          This is ${senderName}, ${senderTitle} at ${brandName}. We'd love to propose a paid collaboration
          for our top-selling product on TikTok Shop.
        </p>
      </td>
    </tr>`;

  const ratingLine = (data.productRating != null || data.productReviewCount != null || data.productSoldCount)
    ? [
        data.productRating != null ? `&#11088; ${data.productRating} Rating` : '',
        data.productReviewCount != null ? `${data.productReviewCount} Reviews` : '',
        data.productSoldCount ? `${escapeHtml(data.productSoldCount)} Sold` : '',
      ].filter(Boolean).join(' &nbsp;|&nbsp; ')
    : '';

  const highlightsHtml = data.productHighlights && data.productHighlights.length > 0
    ? data.productHighlights.map(h => `<span style="color:${primaryColor};font-weight:bold;">&#10004;</span> ${escapeHtml(h)}`).join('<br>')
    : '';

  const productInfoHtml = `
    <span style="display:block;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:${primaryColor};margin-bottom:6px;">Signature Collection</span>
    <span style="display:block;font-size:18px;line-height:1.3;font-weight:500;color:#1a1c1c;">${escapeHtml(data.productName || '')}</span>
    ${ratingLine ? `<span style="display:block;margin-top:8px;font-size:13px;line-height:1.4;color:#8a7f30;">${ratingLine}</span>` : ''}
    ${highlightsHtml ? `<div style="margin-top:12px;font-size:14px;line-height:1.85;color:#4d4635;">${highlightsHtml}</div>` : ''}`;

  const productBlock = data.productName
    ? `
    <tr>
      <td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(26,26,26,0.1);">
          <tr>
            <td style="padding:24px;">
              ${data.productImageUrl ? `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="130" valign="middle" style="padding-right:20px;">
                    <img src="${escapeHtml(data.productImageUrl)}" alt="${escapeHtml(data.productName)}" width="130" style="display:block;width:130px;max-width:100%;height:auto;border:0;object-fit:contain;">
                  </td>
                  <td valign="middle">
                    ${productInfoHtml}
                  </td>
                </tr>
              </table>` : `
              <div style="text-align:center;">
                ${productInfoHtml}
              </div>`}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  const offer = `
    <tr>
      <td style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6E9;border:1px solid #e6d8a8;border-radius:12px;">
          <tr>
            <td align="center" style="padding:22px 24px 24px;">
              <div style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:${primaryColor};margin-bottom:14px;">Collaboration Offer</div>
              <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1c1c;font-weight:bold;">&#128176; Flat Fee + Affiliate Commission</p>
              ${data.compensationOffer ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#4d4635;">&#127909; Starting Offer: ${escapeHtml(data.compensationOffer)}</p>` : ''}
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4d4635;">&#129309; We're happy to discuss based on your rate.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${data.bodyText ? `
    <tr>
      <td align="center" style="padding:16px 32px 0;color:#4d4635;font-size:15px;line-height:1.6;">
        ${bodyTextToHtml(data.bodyText)}
      </td>
    </tr>` : ''}`;

  const ctaHref = data.productUrl || data.ctaHref;
  const ctaLabel = data.ctaLabel || (data.productUrl ? DEFAULT_PRODUCT_CTA_LABEL : DEFAULT_CTA_LABEL);

  const nextStepItem = (n: number, label: string) => `
    <tr>
      <td width="26" valign="top" style="width:26px;padding-bottom:10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="20" height="20" style="width:20px;height:20px;background:${primaryColor};border-radius:50%;">
          <tr><td align="center" valign="middle" style="font-size:11px;font-weight:bold;color:#ffffff;line-height:20px;height:20px;">${n}</td></tr>
        </table>
      </td>
      <td valign="top" style="font-size:14px;font-weight:bold;color:#1a1c1c;padding-bottom:10px;padding-left:4px;">${label}</td>
    </tr>`;

  const nextSteps = `
    <tr>
      <td style="padding:32px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6E9;border:1px solid #e6d8a8;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px 22px;">
              <div style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:${primaryColor};margin-bottom:12px;">Next Steps</div>
              <div style="font-size:14px;color:#4d4635;margin-bottom:14px;">If you're interested, please share:</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${nextStepItem(1, 'Your flat fee rate')}
                ${nextStepItem(2, 'Your shipping address')}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const signOff = `
    <tr>
      <td style="padding:28px 32px 8px;border-top:1px solid rgba(26,26,26,0.08);margin-top:20px;">
        <p style="margin:20px 0 0;font-size:14px;line-height:1.6;color:#4d4635;">
          Best regards,<br>
          <strong style="color:#1a1c1c;">${senderName}</strong><br>
          <span style="font-size:13px;">${senderTitle} | ${brandName}</span>
        </p>
      </td>
    </tr>`;

  const middle = `
    ${hero}
    ${productBlock}
    ${ctaHref ? ctaButtonHtml(ctaHref, ctaLabel, primaryColor, accentColor) : ''}
    ${offer}
    ${nextSteps}
    ${signOff}`;

  const footer = `
    <tr>
      <td style="padding:20px 32px 28px;color:#7f7663;font-size:11px;line-height:1.5;">
        &copy; ${brandName}
      </td>
    </tr>`;

  return shell(header, middle, footer);
}
