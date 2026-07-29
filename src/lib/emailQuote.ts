import EmailReplyParser from 'email-reply-parser';

const HTML_ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

/**
 * Chuyển HTML email body thành plain text sạch để hiển thị trong Inbox.
 * Loại bỏ hẳn <style>/<script> (không chỉ tag mà cả nội dung bên trong),
 * chèn newline ở các block-level tag, decode HTML entities phổ biến,
 * rồi gộp bớt khoảng trắng/dòng trống thừa.
 */
export function htmlToPlainText(html: string): string {
  if (!html || typeof html !== 'string') return '';

  let text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, '');

  text = text.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  text = text.replace(/&nbsp;|&amp;|&lt;|&gt;|&quot;|&#39;|&apos;/g, (m) => HTML_ENTITIES[m] || m);

  return normalizeWhitespace(text);
}

function normalizeWhitespace(text: string): string {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Token liên hệ (URL, email, số điện thoại) — nhiều signature email lặp lại cùng 1 giá
// trị nhiều lần liền nhau (icon + text cùng trỏ tới 1 tel:/mailto: href được convert
// riêng rẽ từ HTML) khiến nội dung dồn cục, khó đọc.
const CONTACT_TOKEN_RE = /<?(https?:\/\/[^\s<>]+|[\w.+-]+@[\w-]+\.[\w.-]{2,}|\+?\d[\d\s().-]{6,}\d)>?/g;

const normalizeContactToken = (token: string): string =>
  token.replace(/^[<(]+|[>)]+$/g, '').replace(/[\s().-]/g, '').toLowerCase();

/**
 * Gộp các token liên hệ (SĐT/email/URL) lặp lại liên tiếp — thường do HTML signature
 * render cùng 1 giá trị 2-3 lần dưới các dạng khác nhau (plain text, <tel:...>, <https:...>)
 * — về 1 lần duy nhất, đồng thời tách mỗi token ra dòng riêng và bỏ dấu <> thừa để phần
 * chữ ký (tên, công ty, email, SĐT, website) dễ đọc thay vì dồn thành 1 dòng dài.
 */
function collapseRepeatedContactTokens(text: string): string {
  const matches = [...text.matchAll(CONTACT_TOKEN_RE)];
  if (matches.length === 0) return text;

  let result = '';
  let cursor = 0;
  let lastNormalized: string | null = null;

  for (const match of matches) {
    const start = match.index!;
    const bare = match[1];
    const normalized = normalizeContactToken(bare);
    const between = text.slice(cursor, start);

    if (normalized === lastNormalized && /^[\s\-–—,;]*$/.test(between)) {
      // Cùng giá trị với token ngay trước, chỉ cách nhau bởi khoảng trắng/dấu gạch nối
      // -> bỏ qua bản lặp và phần nối giữa hai token.
    } else {
      const separator = between.replace(/[ \t]*$/, between.trim() ? '\n' : (cursor === 0 ? '' : '\n'));
      result += separator + bare;
      lastNormalized = normalized;
    }
    cursor = start + match[0].length;
  }
  result += text.slice(cursor);
  return result;
}

// Chữ ký/quote hay gặp mà email-reply-parser (thư viện EN-first, không có locale
// tiếng Việt) không nhận diện được — chạy TRƯỚC khi đưa vào thư viện.
const PRE_LIB_PATTERNS: RegExp[] = [
  // "On Mon, Jan 1, 2026 at 10:00 AM, Name <email@example.com> wrote:" — phòng khi
  // dồn chung 1 dòng, không có \n để thư viện dựa vào regex neo theo dòng bắt được.
  /[\r\n\s]*On\s+[\s\S]+?wrote:[\s\S]*/i,
  // "Vào 10:00 Th 2, 1 thg 1, 2026, Name đã viết:"
  /[\r\n\s]*Vào\s+[\s\S]+?đã viết:[\s\S]*/i,
  // "Trân trọng," — chữ ký tiếng Việt phổ biến, thư viện không có locale này.
  // Cũng chấp nhận biến thể "*Thanks & Best regards*" (markdown bold, nối bằng "&"
  // thay vì dấu phẩy, không xuống dòng) hay gặp ở email-to-SMS gateway trên di động.
  /\*{0,2}\s*(Thanks\s*(?:,|&|and)\s*Best regards|Trân trọng,|Sent from my iPhone|Sent from my iPad|Sent from Outlook)\s*,?\*{0,2}[\s\S]*/i,
];

/**
 * Cắt phần quote/signature khỏi email inbound để chỉ còn nội dung trả lời chính.
 *
 * Kết hợp 2 lớp:
 * 1. `email-reply-parser` — thư viện chuyên dụng (dùng ở Crisp, ~1 triệu email/ngày),
 *    nhận diện tốt hầu hết layout phổ biến: nhiều mức quote lồng nhau, ~10 locale,
 *    hàng chục kiểu chữ ký ("Best regards", "Cheers", "Sent from...", dòng phân
 *    cách "--", v.v.) — thay vì tự duy trì danh sách regex thủ công cho từng layout.
 * 2. Heuristic bổ sung ở trên/dưới cho các case thư viện không cover: chữ ký tiếng
 *    Việt ("Trân trọng,") và kiểu dồn hết nội dung + chữ ký vào chung 1 dòng
 *    (thường gặp ở email-to-SMS gateway trên di động, không có \n để thư viện dựa vào).
 */
export function stripQuotedReply(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text;
  for (const pattern of PRE_LIB_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  try {
    cleaned = new EmailReplyParser().read(cleaned).getVisibleText();
  } catch {
    // Thư viện lỗi (input bất thường) — giữ nguyên bản đã lọc ở bước heuristic trên.
  }

  cleaned = normalizeWhitespace(cleaned);
  cleaned = collapseRepeatedContactTokens(cleaned);
  cleaned = normalizeWhitespace(cleaned);

  // Giới hạn kết quả tối đa 5000 ký tự
  if (cleaned.length > 5000) {
    cleaned = cleaned.slice(0, 5000);
  }

  return cleaned;
}
