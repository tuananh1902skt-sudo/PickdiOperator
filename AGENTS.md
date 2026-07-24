# Project Rules & Memory Log for Pickdi TikTok Extension & CRM

## Core Rules & Memory Log

1. **Userscript Metadata Format**:
   - Always end Tampermonkey metadata blocks with `// ==/UserScript==` (MUST include the closing slash `/`). Missing slashes break Tampermonkey's parser with `eslint: userscripts/no-invalid-metadata`.

2. **Tampermonkey / Violentmonkey Extension Logic**:
   - **XHR / Fetch Interception**: Intercept TikTok API endpoints (`/api/creator/`, `/api/v1/`, `/search/`, `/marketplace/`).
   - **DOM & MutationObserver Harvester**: Use `MutationObserver` and container query selectors targeting follower counts, median views, engagement rates, and handle profile links on TikTok One, TikTok Creator Marketplace, and TikTok Shop Affiliate.
   - **Manual Scan & Copy Controls**: Provide both `🔍 Quét Trang`, `📋 Copy Data`, and `Sync về CRM` buttons directly on the floating extension bar on TikTok.

3. **Network & CORS Fallback**:
   - When direct POST sync from Userscript to CRM endpoint returns non-JSON or CORS network errors, gracefully fallback to `GM_setClipboard` and notify the user to click `📋 Dán dữ liệu từ Extension (Clipboard)` in the CRM Import modal.
