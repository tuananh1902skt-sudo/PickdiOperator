// Fixed marketing-style HTML shell for outreach emails — the "Piedmont Ethereal"
// product/CTA/checklist version, same for every campaign/creator and every sequence stage
// (first contact and reminders alike, see introText below); only the text content changes.
//
// Pure string building, no Node-only APIs or external CSS/JS (Tailwind CDN, web fonts,
// <script>) — those get stripped or silently fail in real email clients, so everything
// here is inline style + table layout, the only combination that renders consistently
// across Gmail/Outlook/Naver Works Mail etc. Georgia stands in for the brand's Bodoni
// Moda serif (closest system font, since Google Fonts links get stripped by most email
// clients). Safe to import from both server.ts (the email actually sent) and outreach
// UI components (live preview).

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
  // Overrides the fixed "We'd love to propose a paid collaboration..." pitch paragraph in
  // the hero block — used by reminder emails to say something contextually appropriate
  // ("didn't want this to get buried", "last chance") instead of literally re-pitching,
  // while still reusing the same product/offer/CTA layout as the first-contact email.
  introText?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

const GOLD_PRIMARY_COLOR = '#735c00'; // Piedmont Ethereal "primary" — shared by both templates
const GOLD_ACCENT_COLOR = '#d4af37'; // Piedmont Ethereal "primary-container", gradient end
const DEFAULT_CTA_LABEL = 'Reply to this email to collaborate';
const DEFAULT_PRODUCT_CTA_LABEL = 'View on TikTok Shop';
export const DEFAULT_SENDER_TITLE = 'TikTok Shop Manager';

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
    .map(p => `<p style="margin:0 0 16px;word-wrap:break-word;overflow-wrap:break-word;">${p}</p>`)
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
      <td align="center" class="pd-pad-lg" style="padding:8px 24px 28px;">
        <a href="${escapeHtml(href)}" class="pd-cta-link"
           style="display:inline-block;background:${gradientFrom};background:linear-gradient(90deg, ${gradientFrom}, ${gradientTo});
                  color:#ffffff;text-decoration:none;font-size:12px;font-weight:600;letter-spacing:0.1em;
                  text-transform:uppercase;padding:16px 32px;border-radius:12px;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>`;
}

// Product-image/text is stacked (image centered on top, text below) unconditionally rather
// than only under a mobile @media query — many mobile and webmail clients (Naver Works Mail,
// most in-app browsers, corporate mail gateways) strip <style> blocks entirely, which used to
// fall back to a fixed 130px-image + squeezed-text side-by-side row that wrapped into an
// unreadably narrow column on any phone-width screen. Stacking unconditionally means the card
// renders correctly with zero dependency on media-query support, at the cost of the same
// layout on desktop too (an acceptable trade — still reads fine at 560px).
//
// The remaining @media rules below are pure enhancement (padding/font-size on genuinely
// mobile-only clients that DO honor <style>) — safe to ignore if stripped, never required for
// correctness.
const MOBILE_STYLE = `
  <style>
    @media only screen and (max-width: 600px) {
      .pd-outer { padding: 16px 8px !important; }
      .pd-pad-lg { padding-left: 20px !important; padding-right: 20px !important; }
      .pd-hero-title { font-size: 24px !important; }
      .pd-hero-text { text-align: left !important; }
      .pd-cta-link { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>`;

function shell(headerHtml: string, middleHtml: string, footerHtml: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    ${MOBILE_STYLE}
  </head>
  <body style="margin:0;padding:0;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="pd-outer" style="background:#f4f5f7;padding:32px 12px;">
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
      <td align="center" class="pd-pad-lg" style="background:#ffffff;padding:28px 32px;border-bottom:1px solid rgba(26,26,26,0.08);">
        ${logoBlockHtml(brandName, data.logoUrl, '#1a1c1c')}
      </td>
    </tr>`;

  const hero = `
    <tr>
      <td align="center" class="pd-pad-lg" style="padding:40px 32px 8px;">
        <div class="pd-hero-title" style="font-family:Georgia,'Times New Roman',serif;font-size:30px;color:${primaryColor};margin-bottom:12px;">
          Hi ${creatorName},
        </div>
        <p class="pd-hero-text" style="margin:0;font-size:15px;line-height:1.6;color:#4d4635;word-wrap:break-word;overflow-wrap:break-word;">
          ${data.introText ? escapeHtml(data.introText) : `This is ${senderName}, ${senderTitle} at ${brandName}. We'd love to propose a paid collaboration
          for our top-selling product on TikTok Shop.`}
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
    <span style="display:block;text-align:center;font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:${primaryColor};margin-bottom:8px;">Signature Collection</span>
    <span style="display:block;text-align:center;font-size:17px;line-height:1.4;font-weight:500;color:#1a1c1c;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(data.productName || '')}</span>
    ${ratingLine ? `<span style="display:block;text-align:center;margin-top:10px;font-size:13px;line-height:1.4;color:#8a7f30;">${ratingLine}</span>` : ''}
    ${highlightsHtml ? `<div style="margin-top:16px;text-align:left;width:100%;font-size:14px;line-height:1.85;color:#4d4635;">${highlightsHtml}</div>` : ''}`;

  // Image always centered on top, text always below — never side-by-side — so the card
  // renders correctly with zero dependency on @media support (see MOBILE_STYLE comment).
  const productBlock = data.productName
    ? `
    <tr>
      <td class="pd-pad-lg" style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid rgba(26,26,26,0.1);">
          <tr>
            <td align="center" style="padding:24px;">
              ${data.productImageUrl ? `
              <img src="${escapeHtml(data.productImageUrl)}" alt="${escapeHtml(data.productName)}" width="180" style="display:block;width:180px;max-width:60%;height:auto;border:0;object-fit:contain;margin:0 auto 20px;">
              ` : ''}
              ${productInfoHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  const offer = `
    <tr>
      <td class="pd-pad-lg" style="padding:24px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6E9;border:1px solid #e6d8a8;border-radius:12px;">
          <tr>
            <td align="left" style="padding:22px 24px 24px;">
              <div style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:${primaryColor};margin-bottom:14px;">Collaboration Offer</div>
              <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#1a1c1c;font-weight:bold;">&#128176; Flat Fee + Affiliate Commission</p>
              ${data.compensationOffer ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#4d4635;word-wrap:break-word;overflow-wrap:break-word;">&#127909; Starting Offer: ${escapeHtml(data.compensationOffer)}</p>` : ''}
              <p style="margin:0;font-size:15px;line-height:1.6;color:#4d4635;">&#129309; We're happy to discuss based on your rate.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    ${data.bodyText ? `
    <tr>
      <td align="center" class="pd-pad-lg" style="padding:16px 32px 0;color:#4d4635;font-size:15px;line-height:1.6;">
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
      <td class="pd-pad-lg" style="padding:32px 32px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FBF6E9;border:1px solid #e6d8a8;border-radius:12px;">
          <tr>
            <td style="padding:20px 24px 22px;">
              <div style="font-size:11px;font-weight:600;letter-spacing:0.15em;text-transform:uppercase;color:${primaryColor};margin-bottom:12px;">Next Steps</div>
              <div style="font-size:14px;color:#4d4635;margin-bottom:14px;">If you're interested, please share:</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                ${nextStepItem(1, 'Your flat fee rate')}
                ${nextStepItem(2, 'Your shipping address')}
                ${nextStepItem(3, 'Your WhatsApp number, for quick coordination')}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;

  const signOff = `
    <tr>
      <td class="pd-pad-lg" style="padding:28px 32px 8px;border-top:1px solid rgba(26,26,26,0.08);margin-top:20px;">
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
      <td class="pd-pad-lg" style="padding:20px 32px 28px;color:#7f7663;font-size:11px;line-height:1.5;">
        &copy; ${brandName}
      </td>
    </tr>`;

  return shell(header, middle, footer);
}
