// Cầu nối webapp -> extension "Pickdi TCM Creator Scraper" qua chrome.runtime.sendMessage với
// externally_connectable (xem extension/manifest.json + extension/background.js). Webapp KHÔNG
// tự cào TCM được — server không có cookie đăng nhập TCM của user, và mọi request TCM bắt buộc
// chữ ký chống bot do chính JS trang TCM tự tính lúc user thao tác thật. Bridge này chỉ gửi lệnh
// "bắt đầu hàng đợi" sang extension; extension tự mở tab thật (request thật do TCM tự ký) và POST
// kết quả thẳng về /api/creators/batch-import, không đi qua server theo hướng ngược lại.
//
// Extension ID của bản unpacked (dev) không cố định theo publish — mỗi máy cài từ 1 thư mục sẽ
// có ID riêng, không đoán được từ code. User tự lấy ID ở chrome://extensions rồi dán vào 1 lần,
// lưu localStorage (theo trình duyệt, không phải theo tài khoản).
const EXTENSION_ID_STORAGE_KEY = 'pickdi_tcm_extension_id';

export function getStoredExtensionId(): string {
  try {
    return localStorage.getItem(EXTENSION_ID_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredExtensionId(id: string): void {
  try {
    localStorage.setItem(EXTENSION_ID_STORAGE_KEY, id.trim());
  } catch {
    // localStorage bị chặn (private mode nghiêm ngặt) — im lặng bỏ qua, không có gì để lưu lại.
  }
}

function getChromeRuntime(): any {
  const w = window as any;
  return w.chrome && w.chrome.runtime && typeof w.chrome.runtime.sendMessage === 'function'
    ? w.chrome.runtime
    : null;
}

function sendToExtension<T = any>(message: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    const runtime = getChromeRuntime();
    if (!runtime) {
      reject(new Error('Trình duyệt này không hỗ trợ chrome.runtime — cần dùng Chrome/Edge có cài extension Pickdi TCM Creator Scraper.'));
      return;
    }
    const extensionId = getStoredExtensionId();
    if (!extensionId) {
      reject(new Error('Chưa cấu hình Extension ID. Vào chrome://extensions, bật "Developer mode", copy ID của "Pickdi TCM Creator Scraper" rồi cấu hình trong Pickdi.'));
      return;
    }
    try {
      runtime.sendMessage(extensionId, message, (response: T) => {
        const err = runtime.lastError;
        if (err) {
          reject(new Error(err.message || 'Không kết nối được extension — kiểm tra extension đã cài, đang bật, và đúng ID.'));
          return;
        }
        resolve(response);
      });
    } catch (err: any) {
      reject(new Error(err?.message || String(err)));
    }
  });
}

export async function pingExtension(): Promise<boolean> {
  try {
    const res: any = await sendToExtension({ type: 'WEBAPP_PING' });
    return !!(res && res.ok);
  } catch {
    return false;
  }
}

export interface AutoDetailQueueItem {
  cid: string;
  handle: string;
}

export interface AutoDetailQueueResult {
  ok: boolean;
  handle: string;
  message?: string;
}

export interface AutoDetailQueueState {
  status: 'running' | 'done' | 'stopped';
  queue: AutoDetailQueueItem[];
  pending?: AutoDetailQueueItem[];
  totalCount?: number;
  processedCount?: number;
  failedCount?: number;
  currentHandle?: string | null;
  autoContinue?: boolean;
  cooldownMs?: number;
  results?: AutoDetailQueueResult[];
}

export async function startAutoDetailQueue(
  items: AutoDetailQueueItem[],
  opts?: { maxCount?: number; cooldownMs?: number }
): Promise<{ ok: boolean; message?: string; queued?: number; pending?: number; total?: number }> {
  return sendToExtension({
    type: 'WEBAPP_START_AUTO_DETAIL_QUEUE',
    items,
    webappUrl: window.location.origin,
    maxCount: opts?.maxCount,
    autoContinue: true,
    cooldownMs: opts?.cooldownMs,
  });
}

export async function getAutoDetailStatus(): Promise<AutoDetailQueueState | null> {
  return sendToExtension({ type: 'WEBAPP_GET_AUTO_DETAIL_STATUS' });
}

export async function stopAutoDetailQueue(): Promise<{ ok: boolean }> {
  return sendToExtension({ type: 'WEBAPP_STOP_AUTO_DETAIL_QUEUE' });
}

// Creator chỉ có TikTok handle (Kalodata/manual/file import) chưa có tcmCreatorOecuid — extension
// tự mở tab "Find creators", gõ handle vào ô search thật của TCM (request thật do TCM tự ký) rồi
// đọc kết quả khớp đúng handle để lấy cid + category/niche/GMV, sau đó tự POST batch-import.
export interface SearchCidQueueItem {
  handle: string;
}

export interface SearchCidQueueResult {
  ok: boolean;
  handle: string;
  message?: string;
  cid?: string;
}

export interface SearchCidQueueState {
  status: 'running' | 'done' | 'stopped';
  queue: SearchCidQueueItem[];
  pending?: SearchCidQueueItem[];
  totalCount?: number;
  processedCount?: number;
  failedCount?: number;
  currentHandle?: string | null;
  results?: SearchCidQueueResult[];
}

export async function startSearchCidQueue(
  handles: string[],
  opts?: { maxCount?: number }
): Promise<{ ok: boolean; message?: string; queued?: number; pending?: number; total?: number }> {
  return sendToExtension({
    type: 'WEBAPP_START_SEARCH_CID_QUEUE',
    items: handles.map(handle => ({ handle })),
    webappUrl: window.location.origin,
    maxCount: opts?.maxCount,
  });
}

export async function getSearchCidStatus(): Promise<SearchCidQueueState | null> {
  return sendToExtension({ type: 'WEBAPP_GET_SEARCH_CID_STATUS' });
}

export async function stopSearchCidQueue(): Promise<{ ok: boolean }> {
  return sendToExtension({ type: 'WEBAPP_STOP_SEARCH_CID_QUEUE' });
}
