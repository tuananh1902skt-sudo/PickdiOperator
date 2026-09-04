// Service worker nền — hàng đợi "tự động lấy chi tiết từng creator" (session 8/9).
//
// Bản v2.0 từng có 1 flow "tự mở tab ẩn TCM + tự gọi fetch() phân trang" (giống hệt cách
// TikTok One's QueryCreatorSquare hoạt động), nhưng TCM (affiliate-us.tiktok.com/api/v1/oec/...)
// nằm dưới hệ thống risk-control của TikTok Shop — MỌI request đều bắt buộc có chữ ký
// msToken/X-Bogus/X-Gnarly do chính JS obfuscated của trang tự tính ra tại thời điểm gọi.
// fetch() gọi tay từ content script KHÔNG có các chữ ký này -> TCM trả lỗi
// "code=98001004: Invalid parameters" (thực chất là bị chặn vì thiếu chữ ký).
//
// Tự dựng lại thuật toán ký X-Bogus/X-Gnarly để giả mạo request = bypass cơ chế chống bot của
// TikTok -> KHÔNG làm việc này dù được yêu cầu.
//
// Session 8 xác nhận (recon DevTools thật): trang chi tiết creator có URL cố định
// (.../connection/creator/detail?cid=<creator_oecuid>&shop_region=..&shop_id=..) và CHỈ 1
// request marketplace/profile duy nhất khi trang load xong đã trả đủ hầu hết field (không cần
// click qua tab). Vì vậy có thể tự động hoá bước "mở từng trang chi tiết" bằng cách tự mở TAB
// ẨN thật cho từng creator — TCM vẫn tự ký request THẬT của chính trang đó (không phải fetch()
// giả lập), interceptor.js vẫn nghe lén y hệt khi user tự mở tay. Đây KHÔNG phải giả mạo chữ ký
// — chỉ là tự động hoá việc "mở tab, đợi, đóng tab" mà user vẫn có thể tự làm tay.
//
// Rủi ro thật (đã giải thích với user, được xác nhận triển khai với nhịp độ thận trọng): mở
// nhiều tab liên tiếp không có tương tác người dùng thật vẫn là hành vi rất giống bot, TCM có
// hệ thống chống gian lận riêng có thể phát hiện tần suất/pattern bất thường dù chữ ký hợp lệ,
// dẫn tới rate-limit hoặc hạn chế tài khoản seller. Giảm rủi ro bằng cách chạy TUẦN TỰ (không
// mở nhiều tab cùng lúc) + delay ngẫu nhiên giữa các creator + giới hạn số lượng/lần chạy.

importScripts('shared.js');

const STORAGE_KEY = 'autoDetailState';
const AUTO_CONTINUE_ALARM = 'autoDetailContinue';
const TAB_LOAD_TIMEOUT_MS = 20000;
// Trần tối đa chờ profile xuất hiện SAU khi tab báo 'complete' — không phải khoảng đợi cố định
// nữa (xem readProfileByCidInPageWithWait): trả về ngay khi có data, chỉ chờ tới hết mức này nếu
// tab bị Chrome throttle mạnh (background tab). 1.8s cũ quá ngắn khi chạy hàng đợi nhiều tab liên
// tiếp — nâng lên 8s để chịu được throttling thật, vẫn đủ nhanh cho ca bình thường vì poll xong
// là trả ngay, không đợi hết 8s.
const POST_LOAD_BUFFER_MS = 8000;

let isProcessing = false;

function randomDelay(minMs, maxMs) {
  return minMs + Math.floor(Math.random() * Math.max(0, maxMs - minMs));
}

async function getState() {
  const res = await chrome.storage.local.get([STORAGE_KEY]);
  return res[STORAGE_KEY] || null;
}

async function setState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

async function patchState(patch) {
  const state = (await getState()) || {};
  const next = { ...state, ...patch, updatedAt: Date.now() };
  await setState(next);
  return next;
}

// HÀM CHẠY BÊN TRONG TAB TCM ẨN — không được closure biến ngoài.
function readProfileByCidInPage(cid) {
  const store = window.__pickdi_tcm_profiles || {};
  return store[cid] || null;
}

// Bản có chờ, thay cho readProfileByCidInPage + sleep(POST_LOAD_BUFFER_MS) cố định bên ngoài.
// Root cause thật của tỷ lệ lỗi cao khi chạy hàng đợi (nhiều tab ẩn liên tiếp): Chrome giảm ưu
// tiên CPU/network cho tab KHÔNG active (background tab throttling) — request marketplace/profile
// vẫn tự bắn khi trang mount như bình thường, nhưng có thể về CHẬM HƠN rõ rệt so với lúc user tự
// mở tay 1 tab active — nên buffer cố định 1.8s nhiều lúc đọc trước khi interceptor.js kịp merge
// response vào window.__pickdi_tcm_profiles. Hàm này chạy NGAY TRONG page (world MAIN), tự poll
// mỗi 300ms tới khi có data hoặc hết maxWaitMs, trả về ngay khi có thay vì luôn đợi hết buffer.
function readProfileByCidInPageWithWait(cid, maxWaitMs) {
  return new Promise((resolve) => {
    const start = Date.now();
    const check = () => {
      const store = window.__pickdi_tcm_profiles || {};
      if (store[cid]) return resolve(store[cid]);
      if (Date.now() - start >= maxWaitMs) return resolve(null);
      setTimeout(check, 300);
    };
    check();
  });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      resolve(result);
    };
    const listener = (updatedTabId, changeInfo) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') finish(true);
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(() => finish(false), TAB_LOAD_TIMEOUT_MS);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Mở tab ẨN vẫn bị Chrome dừng requestAnimationFrame -> trang client-render nặng (chi tiết
// creator, ô search TCM) không kịp mount xong nên đọc data hay bị rỗng. Tạo tab NGAY LÚC active
// (không phải create ẩn rồi update active sau — có khoảng hở) + ép cả cửa sổ chứa nó lên trước
// màn hình, để không có trường hợp nào tab vẫn coi là "ẩn" với mắt người dùng dù kỹ thuật active.
async function createForegroundTab(url) {
  const [prevActiveTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const previousActiveTabId = prevActiveTab && prevActiveTab.id;
  const previousWindowId = prevActiveTab && prevActiveTab.windowId;
  const tab = await chrome.tabs.create({ url, active: true });
  if (tab.windowId) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  return { tab, previousActiveTabId, previousWindowId };
}

async function restoreForegroundTab(previousActiveTabId, previousWindowId) {
  if (previousActiveTabId) await chrome.tabs.update(previousActiveTabId, { active: true }).catch(() => {});
  if (previousWindowId) await chrome.windows.update(previousWindowId, { focused: true }).catch(() => {});
}

async function processOneItem(state) {
  const item = state.queue[state.index];
  let tab;
  let previousActiveTabId, previousWindowId;
  try {
    const url = `https://affiliate-us.tiktok.com/connection/creator/detail?cid=${encodeURIComponent(item.cid)}&shop_region=${encodeURIComponent(state.shopRegion || 'US')}&shop_id=${encodeURIComponent(state.shopId || '')}`;
    ({ tab, previousActiveTabId, previousWindowId } = await createForegroundTab(url));
    await waitForTabComplete(tab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: readProfileByCidInPageWithWait,
      args: [String(item.cid), POST_LOAD_BUFFER_MS],
    });
    const profile = results && results[0] && results[0].result;
    if (!profile) {
      return { ok: false, handle: item.handle, message: 'Không bắt được data (trang có thể load chậm hoặc creator không còn khả dụng).' };
    }

    const detail = normalizeTcmProfileDetail(profile);
    if (!detail) {
      return { ok: false, handle: item.handle, message: 'Không đọc được handle từ data đã bắt.' };
    }

    const res = await fetch(`${state.webappUrl}/api/creators/batch-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'Pickdi TCM Extension (auto-queue)', metricsSource: 'tcm', creators: [detail] }),
    });
    const data = await res.json().catch(() => null);
    if (!data || !data.success) {
      return { ok: false, handle: item.handle, message: (data && data.message) || 'Webapp từ chối (HTTP ' + res.status + ').' };
    }
    return { ok: true, handle: item.handle };
  } catch (err) {
    return { ok: false, handle: item && item.handle, message: String((err && err.message) || err) };
  } finally {
    if (tab && tab.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
    await restoreForegroundTab(previousActiveTabId, previousWindowId);
  }
}

async function runLoop() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    for (;;) {
      const state = await getState();
      if (!state || state.status !== 'running') break;
      if (state.index >= state.queue.length) {
        // Hết chunk hiện tại — nếu còn creator dư (pending) và user đã bật auto-continue, đặt
        // 1 chrome.alarms (KHÔNG sleep() trong service worker — SW có thể bị Chrome tắt giữa
        // chừng lúc idle, sleep() sẽ chết theo và không bao giờ tự nạp tiếp) để nghỉ dài hơn
        // nhiều so với 4-8s giữa 2 creator (mặc định 45s) trước khi tự nạp chunk kế tiếp, giống
        // hành vi "nghỉ giải lao" của người dùng thật hơn là dừng hẳn rồi chạy lại ngay. Nếu
        // không bật auto-continue, dừng ở 'done' và giữ nguyên `pending` để user tự bấm
        // "Lấy tiếp" bất kỳ lúc nào (kể cả sau khi đóng popup).
        if (state.autoContinue && state.pending && state.pending.length > 0) {
          await patchState({ status: 'done', currentHandle: null });
          const cooldownMinutes = Math.max((state.cooldownMs || 45000) / 60000, 0.5);
          chrome.alarms.create(AUTO_CONTINUE_ALARM, { delayInMinutes: cooldownMinutes });
        } else {
          await patchState({ status: 'done' });
        }
        break;
      }

      const item = state.queue[state.index];
      await patchState({ currentHandle: item.handle });

      const result = await processOneItem(state);

      const fresh = (await getState()) || state;
      if (fresh.status !== 'running') break; // user bấm Dừng trong lúc đang xử lý item này

      const results = [...(fresh.results || []), result];
      await patchState({
        index: fresh.index + 1,
        results,
        processedCount: (fresh.processedCount || 0) + 1,
        failedCount: (fresh.failedCount || 0) + (result.ok ? 0 : 1),
        currentHandle: null,
      });

      const after = await getState();
      if (!after || after.status !== 'running') break;
      if (after.index >= after.queue.length) continue; // quay lại đầu vòng lặp để check auto-continue/pending

      await sleep(randomDelay(state.delayMinMs || 4000, state.delayMaxMs || 8000));
    }
  } finally {
    isProcessing = false;
  }
}

async function startAutoDetailQueueInternal(items, webappUrl, shopId, shopRegion, maxCount, autoContinue, cooldownMs) {
  const chunkSize = maxCount || items.length;
  const queued = items.slice(0, chunkSize);
  const pending = items.slice(chunkSize);
  await setState({
    status: queued.length > 0 ? 'running' : 'done',
    queue: queued,
    pending,
    chunkSize,
    totalCount: items.length,
    index: 0,
    webappUrl,
    shopId,
    shopRegion: shopRegion || 'US',
    delayMinMs: 4000,
    delayMaxMs: 8000,
    autoContinue: !!autoContinue,
    cooldownMs: cooldownMs || 45000,
    processedCount: 0,
    failedCount: 0,
    results: [],
    currentHandle: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
  runLoop();
  return { queued: queued.length, pending: pending.length, total: items.length };
}

// Nạp tiếp chunk kế tiếp từ `pending` sau khi chunk trước đã 'done' — dùng cho nút "Lấy tiếp"
// (user tự bấm) khi autoContinue tắt, hoặc khi user bật lại autoContinue giữa chừng.
// Cộng dồn processedCount/failedCount/results thay vì reset, vì đây vẫn là cùng 1 danh sách
// gốc đã import, chỉ tiếp tục phần chưa lấy — không phải một lượt chạy mới.
async function continueAutoDetailQueueInternal() {
  const state = await getState();
  if (!state || !state.pending || state.pending.length === 0) return { continued: false, pending: 0 };
  if (state.status === 'running') return { continued: false, pending: state.pending.length }; // đang chạy rồi, không cần nạp tay
  const chunkSize = state.chunkSize || state.pending.length;
  const nextQueue = state.pending.slice(0, chunkSize);
  const nextPending = state.pending.slice(chunkSize);
  await patchState({ status: 'running', queue: nextQueue, pending: nextPending, index: 0, currentHandle: null });
  runLoop();
  return { continued: true, queued: nextQueue.length, pending: nextPending.length };
}

// ================== HÀNG ĐỢI "TÌM CID TCM THEO HANDLE" (webapp bridge) ==================
// Creator chỉ có TikTok handle (Kalodata/manual/file import) chưa có tcmCreatorOecuid — không
// nằm trong bất kỳ danh sách TCM nào đã capture nên không thể mở thẳng trang chi tiết. Thay vào
// đó: tự mở tab "Find creators", gõ handle vào ô search thật của TCM (searchTcmByHandle ở
// shared.js — vẫn chỉ mô phỏng thao tác người dùng thật, TCM tự ký request), đọc kết quả khớp
// đúng handle để lấy cid + category/niche/GMV, rồi POST thẳng batch-import. Cùng nhịp độ thận
// trọng (tuần tự + delay ngẫu nhiên) như hàng đợi auto-detail ở trên.
const SEARCH_CID_STORAGE_KEY = 'searchCidState';
const SEARCH_TAB_POST_LOAD_BUFFER_MS = 1200;

let isSearchCidProcessing = false;

async function getSearchCidState() {
  const res = await chrome.storage.local.get([SEARCH_CID_STORAGE_KEY]);
  return res[SEARCH_CID_STORAGE_KEY] || null;
}

async function setSearchCidState(state) {
  await chrome.storage.local.set({ [SEARCH_CID_STORAGE_KEY]: state });
}

async function patchSearchCidState(patch) {
  const state = (await getSearchCidState()) || {};
  const next = { ...state, ...patch, updatedAt: Date.now() };
  await setSearchCidState(next);
  return next;
}

async function processOneSearchCidItem(state) {
  const item = state.queue[state.index];
  let tab;
  let previousActiveTabId, previousWindowId;
  try {
    const url = `https://affiliate-us.tiktok.com/connection/creator?shop_region=${encodeURIComponent(state.shopRegion || 'US')}&shop_id=${encodeURIComponent(state.shopId || '')}`;
    // Ô AI-search trên Find Creators là component client-render nặng — Chrome DỪNG HẲN
    // requestAnimationFrame cho tab nền/ẩn nên tab mở không active có thể không bao giờ mount
    // xong ô search trong lúc vẫn ẩn. Tạo tab active NGAY (createForegroundTab), không phải tạo
    // ẩn rồi bật sau — tránh khoảng hở khiến tab vẫn coi như ẩn với mắt người dùng.
    ({ tab, previousActiveTabId, previousWindowId } = await createForegroundTab(url));
    await waitForTabComplete(tab.id);
    await sleep(SEARCH_TAB_POST_LOAD_BUFFER_MS);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: searchTcmByHandle,
      args: [item.handle],
    });
    const outcome = results && results[0] && results[0].result;
    if (!outcome || outcome.error || !outcome.match) {
      const errorMessages = {
        no_match: 'Không tìm thấy creator này trên TCM.',
        search_box_not_found: 'Không tìm thấy ô search trên trang Find Creators (trang tải chậm hoặc giao diện TCM đã đổi).',
        search_button_not_found: 'Tìm thấy ô search nhưng không tìm thấy nút search (giao diện TCM có thể đã đổi).',
      };
      const message =
        (outcome && errorMessages[outcome.error]) ||
        'Không thao tác được ô search TCM (giao diện TCM có thể đã thay đổi).';
      // no_match = TCM đã trả kết quả search rõ ràng, không khớp handle nào (khác các lỗi khác
      // là do UI/giao diện) — báo về webapp để gắn nhãn cảnh báo persistent trên creator, tránh
      // lặp lại tìm kiếm vô ích ở lượt kế tiếp. Best-effort — lỗi report không nên chặn kết quả
      // trả về cho popup.
      if (outcome && outcome.error === 'no_match') {
        fetch(`${state.webappUrl}/api/creators/tcm-not-found`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handles: [item.handle] }),
        }).catch(() => {});
      }
      return { ok: false, handle: item.handle, message };
    }

    const normalized = normalizeCreator(outcome.match);
    if (!normalized.handle) {
      return { ok: false, handle: item.handle, message: 'Kết quả search thiếu handle hợp lệ.' };
    }

    const res = await fetch(`${state.webappUrl}/api/creators/batch-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'Pickdi TCM Extension (handle-search)', metricsSource: 'tcm', creators: [normalized] }),
    });
    const data = await res.json().catch(() => null);
    if (!data || !data.success) {
      return { ok: false, handle: item.handle, message: (data && data.message) || 'Webapp từ chối (HTTP ' + res.status + ').' };
    }
    return { ok: true, handle: item.handle, cid: normalized.tcmCreatorOecuid };
  } catch (err) {
    return { ok: false, handle: item && item.handle, message: String((err && err.message) || err) };
  } finally {
    if (tab && tab.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
    await restoreForegroundTab(previousActiveTabId, previousWindowId);
  }
}

async function runSearchCidLoop() {
  if (isSearchCidProcessing) return;
  isSearchCidProcessing = true;
  try {
    for (;;) {
      const state = await getSearchCidState();
      if (!state || state.status !== 'running') break;
      if (state.index >= state.queue.length) {
        await patchSearchCidState({ status: 'done', currentHandle: null });
        break;
      }

      const item = state.queue[state.index];
      await patchSearchCidState({ currentHandle: item.handle });

      const result = await processOneSearchCidItem(state);

      const fresh = (await getSearchCidState()) || state;
      if (fresh.status !== 'running') break;

      const results = [...(fresh.results || []), result];
      await patchSearchCidState({
        index: fresh.index + 1,
        results,
        processedCount: (fresh.processedCount || 0) + 1,
        failedCount: (fresh.failedCount || 0) + (result.ok ? 0 : 1),
        currentHandle: null,
      });

      const after = await getSearchCidState();
      if (!after || after.status !== 'running') break;
      if (after.index >= after.queue.length) continue;

      await sleep(randomDelay(4000, 8000));
    }
  } finally {
    isSearchCidProcessing = false;
  }
}

async function startSearchCidQueueInternal(items, webappUrl, shopId, shopRegion, maxCount) {
  const chunkSize = maxCount || items.length;
  const queued = items.slice(0, chunkSize);
  const pending = items.slice(chunkSize);
  await setSearchCidState({
    status: queued.length > 0 ? 'running' : 'done',
    queue: queued,
    pending,
    totalCount: items.length,
    index: 0,
    webappUrl,
    shopId,
    shopRegion: shopRegion || 'US',
    processedCount: 0,
    failedCount: 0,
    results: [],
    currentHandle: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
  runSearchCidLoop();
  return { queued: queued.length, pending: pending.length, total: items.length };
}

// ================== HÀNG ĐỢI JOB ĐƠN LẺ (session 10) ==================
// Trước đây các nút "Import creator đã bắt được"/"Lấy chi tiết trang này"/"Auto quét tab"/
// "Push Engagement" đọc tab + fetch() thẳng trong popup.js — nếu user chuyển tab (Chrome tự
// đóng popup) đúng lúc đang fetch, request bị huỷ giữa chừng, không lưu lại gì. Giờ cả bước đọc
// tab (chrome.scripting.executeScript) lẫn bước POST webapp đều chạy TRONG service worker này
// — độc lập hoàn toàn với vòng đời popup, y hệt cơ chế hàng đợi auto-detail ở trên. popup.js
// chỉ gửi 1 message "bắt đầu" rồi poll GET_EXT_JOBS để hiển thị lại, kể cả sau khi đóng/mở lại.
const EXT_JOBS_KEY = 'extJobsState';

// Các job này chỉ chạy 1-2 bước async (đọc tab, rồi POST) chứ không có vòng lặp như
// auto-detail-queue, nên không thể "ngắt" nửa chừng 1 request đang bay — best-effort: đánh dấu
// jobType vào set này, job tự kiểm tra sau mỗi bước await và dừng ngay trước bước kế tiếp
// (không POST nếu đã bị đánh dấu dừng).
const stoppedJobTypes = new Set();

async function stopIfRequested(jobType) {
  if (!stoppedJobTypes.has(jobType)) return false;
  await setJob(jobType, { status: 'stopped', message: '⏹ Đã dừng.' });
  return true;
}

async function getJobs() {
  const res = await chrome.storage.local.get([EXT_JOBS_KEY]);
  return res[EXT_JOBS_KEY] || {};
}

async function setJob(jobType, patch) {
  const jobs = await getJobs();
  jobs[jobType] = { ...(jobs[jobType] || {}), ...patch, updatedAt: Date.now() };
  await chrome.storage.local.set({ [EXT_JOBS_KEY]: jobs });
  return jobs[jobType];
}

async function postBatchImport(webappUrl, source, metricsSource, creators) {
  const res = await fetch(`${webappUrl}/api/creators/batch-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, metricsSource, creators }),
  });
  const data = await res.json().catch(() => null);
  if (!data) throw new Error(`Webapp trả về response không hợp lệ (HTTP ${res.status}).`);
  if (!data.success) throw new Error(data.message || 'Import thất bại.');
  return data;
}

// ================== BUFFER CSV OFFLINE (không đẩy webapp) ==================
// Dùng cho các nút "Lấy chi tiết trang này"/"Auto quét qua các tab"/"Lấy engagement" khi user
// thao tác trực tiếp trên TCM/TikTok (không qua webapp) và chỉ muốn có file CSV, không muốn
// creator bị ghi vào DB Pickdi. Gộp theo handle (lowercase) — chạy detail rồi engagement cho
// cùng 1 creator sẽ merge chung 1 dòng thay vì tạo 2 dòng riêng. KHÔNG đụng tới luồng webapp ->
// extension (WEBAPP_START_AUTO_DETAIL_QUEUE và các nút trong CreatorListView vẫn push thẳng vào
// DB như cũ — CRM cần data đó để export/outreach).
const CSV_BUFFER_KEY = 'csvBuffer';

async function mergeIntoCsvBuffer(item) {
  if (!item || !item.handle) return 0;
  const key = item.handle.toLowerCase();
  const res = await chrome.storage.local.get([CSV_BUFFER_KEY]);
  const buffer = res[CSV_BUFFER_KEY] || {};
  buffer[key] = { ...(buffer[key] || {}), ...item, handle: item.handle };
  await chrome.storage.local.set({ [CSV_BUFFER_KEY]: buffer });
  return Object.keys(buffer).length;
}

async function getCsvBufferArray() {
  const res = await chrome.storage.local.get([CSV_BUFFER_KEY]);
  const buffer = res[CSV_BUFFER_KEY] || {};
  return Object.values(buffer);
}

async function clearCsvBuffer() {
  await chrome.storage.local.set({ [CSV_BUFFER_KEY]: {} });
}

// ================== HÀNG ĐỢI "TỰ ĐỘNG LẤY CHI TIẾT CSV" (không đẩy webapp) ==================
// Y hệt cơ chế auto-detail-queue ở đầu file (mở tab ẩn tuần tự tới trang chi tiết từng creator,
// TCM tự ký request thật, interceptor.js nghe lén) — chỉ khác bước cuối: gộp vào csvBuffer thay
// vì postBatchImport lên webapp. State/alarm riêng (không dùng chung STORAGE_KEY/AUTO_CONTINUE_ALARM
// ở trên) để 2 hàng đợi có thể tồn tại độc lập, không đè trạng thái của nhau.
const CSV_QUEUE_STORAGE_KEY = 'csvDetailQueueState';
const CSV_QUEUE_AUTO_CONTINUE_ALARM = 'csvDetailQueueContinue';

let isCsvQueueProcessing = false;

async function getCsvQueueState() {
  const res = await chrome.storage.local.get([CSV_QUEUE_STORAGE_KEY]);
  return res[CSV_QUEUE_STORAGE_KEY] || null;
}

async function setCsvQueueState(state) {
  await chrome.storage.local.set({ [CSV_QUEUE_STORAGE_KEY]: state });
}

async function patchCsvQueueState(patch) {
  const state = (await getCsvQueueState()) || {};
  const next = { ...state, ...patch, updatedAt: Date.now() };
  await setCsvQueueState(next);
  return next;
}

async function processOneCsvQueueItem(state) {
  const item = state.queue[state.index];
  let tab;
  let previousActiveTabId, previousWindowId;
  try {
    const url = `https://affiliate-us.tiktok.com/connection/creator/detail?cid=${encodeURIComponent(item.cid)}&shop_region=${encodeURIComponent(state.shopRegion || 'US')}&shop_id=${encodeURIComponent(state.shopId || '')}`;
    ({ tab, previousActiveTabId, previousWindowId } = await createForegroundTab(url));
    await waitForTabComplete(tab.id);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: readProfileByCidInPageWithWait,
      args: [String(item.cid), POST_LOAD_BUFFER_MS],
    });
    const profile = results && results[0] && results[0].result;
    if (!profile) {
      return { ok: false, handle: item.handle, message: 'Không bắt được data (trang có thể load chậm hoặc creator không còn khả dụng).' };
    }

    const detail = normalizeTcmProfileDetail(profile);
    if (!detail) {
      return { ok: false, handle: item.handle, message: 'Không đọc được handle từ data đã bắt.' };
    }

    await mergeIntoCsvBuffer(detail);
    return { ok: true, handle: item.handle };
  } catch (err) {
    return { ok: false, handle: item && item.handle, message: String((err && err.message) || err) };
  } finally {
    if (tab && tab.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
    await restoreForegroundTab(previousActiveTabId, previousWindowId);
  }
}

async function runCsvQueueLoop() {
  if (isCsvQueueProcessing) return;
  isCsvQueueProcessing = true;
  try {
    for (;;) {
      const state = await getCsvQueueState();
      if (!state || state.status !== 'running') break;
      if (state.index >= state.queue.length) {
        if (state.autoContinue && state.pending && state.pending.length > 0) {
          await patchCsvQueueState({ status: 'done', currentHandle: null });
          const cooldownMinutes = Math.max((state.cooldownMs || 45000) / 60000, 0.5);
          chrome.alarms.create(CSV_QUEUE_AUTO_CONTINUE_ALARM, { delayInMinutes: cooldownMinutes });
        } else {
          await patchCsvQueueState({ status: 'done' });
        }
        break;
      }

      const item = state.queue[state.index];
      await patchCsvQueueState({ currentHandle: item.handle });

      const result = await processOneCsvQueueItem(state);

      const fresh = (await getCsvQueueState()) || state;
      if (fresh.status !== 'running') break;

      const results = [...(fresh.results || []), result];
      await patchCsvQueueState({
        index: fresh.index + 1,
        results,
        processedCount: (fresh.processedCount || 0) + 1,
        failedCount: (fresh.failedCount || 0) + (result.ok ? 0 : 1),
        currentHandle: null,
      });

      const after = await getCsvQueueState();
      if (!after || after.status !== 'running') break;
      if (after.index >= after.queue.length) continue;

      await sleep(randomDelay(state.delayMinMs || 4000, state.delayMaxMs || 8000));
    }
  } finally {
    isCsvQueueProcessing = false;
  }
}

async function startCsvDetailQueueInternal(items, shopId, shopRegion, maxCount, autoContinue, cooldownMs) {
  const chunkSize = maxCount || items.length;
  const queued = items.slice(0, chunkSize);
  const pending = items.slice(chunkSize);
  await setCsvQueueState({
    status: queued.length > 0 ? 'running' : 'done',
    queue: queued,
    pending,
    chunkSize,
    totalCount: items.length,
    index: 0,
    shopId,
    shopRegion: shopRegion || 'US',
    delayMinMs: 4000,
    delayMaxMs: 8000,
    autoContinue: !!autoContinue,
    cooldownMs: cooldownMs || 45000,
    processedCount: 0,
    failedCount: 0,
    results: [],
    currentHandle: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
  runCsvQueueLoop();
  return { queued: queued.length, pending: pending.length, total: items.length };
}

async function continueCsvDetailQueueInternal() {
  const state = await getCsvQueueState();
  if (!state || !state.pending || state.pending.length === 0) return { continued: false, pending: 0 };
  if (state.status === 'running') return { continued: false, pending: state.pending.length };
  const chunkSize = state.chunkSize || state.pending.length;
  const nextQueue = state.pending.slice(0, chunkSize);
  const nextPending = state.pending.slice(chunkSize);
  await patchCsvQueueState({ status: 'running', queue: nextQueue, pending: nextPending, index: 0, currentHandle: null });
  runCsvQueueLoop();
  return { continued: true, queued: nextQueue.length, pending: nextPending.length };
}

// ================== HÀNG ĐỢI "TÌM CID RỒI LẤY CHI TIẾT CSV" (Kalodata/handle-only, không đẩy webapp) ==================
// Creator chỉ có TikTok handle (Kalodata/manual/file import), chưa từng xuất hiện trong bất kỳ
// danh sách TCM nào đã capture nên không có cid -> không mở thẳng được trang chi tiết như hàng
// đợi CSV_QUEUE ở trên. Mỗi item ở đây làm 2 bước nối tiếp trong CÙNG 1 tab: (1) mở "Find
// Creators", gõ handle vào ô search thật của TCM (searchTcmByHandle, shared.js) để lấy cid — kỹ
// thuật giống hệt processOneSearchCidItem/hàng đợi WEBAPP_START_SEARCH_CID_QUEUE ở trên, chỉ
// khác bước cuối; (2) có cid rồi thì điều hướng NGAY tab đó sang trang chi tiết
// (.../creator/detail?cid=...) để đọc đủ field như hàng đợi CSV_QUEUE (demographics/beauty%/
// email...) thay vì chỉ có data rút gọn ở list. KHÔNG gọi webapp ở bất kỳ bước nào (kể cả
// /api/creators/tcm-not-found mà bản webapp-push có báo — bỏ qua vì đây là luồng offline thuần).
const CSV_SEARCH_QUEUE_STORAGE_KEY = 'csvSearchCidQueueState';

let isCsvSearchQueueProcessing = false;

async function getCsvSearchQueueState() {
  const res = await chrome.storage.local.get([CSV_SEARCH_QUEUE_STORAGE_KEY]);
  return res[CSV_SEARCH_QUEUE_STORAGE_KEY] || null;
}

async function setCsvSearchQueueState(state) {
  await chrome.storage.local.set({ [CSV_SEARCH_QUEUE_STORAGE_KEY]: state });
}

async function patchCsvSearchQueueState(patch) {
  const state = (await getCsvSearchQueueState()) || {};
  const next = { ...state, ...patch, updatedAt: Date.now() };
  await setCsvSearchQueueState(next);
  return next;
}

async function processOneCsvSearchQueueItem(state) {
  const item = state.queue[state.index];
  let tab;
  let previousActiveTabId, previousWindowId;
  try {
    const url = `https://affiliate-us.tiktok.com/connection/creator?shop_region=${encodeURIComponent(state.shopRegion || 'US')}&shop_id=${encodeURIComponent(state.shopId || '')}`;
    // Ô AI-search là component client-render nặng, Chrome dừng requestAnimationFrame ở tab nền
    // -> tạo tab active NGAY (createForegroundTab, ép cả cửa sổ chứa nó lên trước) thay vì tạo
    // ẩn rồi bật active sau — không còn khoảng hở nào khiến tab bị coi là "ẩn" trên màn hình.
    ({ tab, previousActiveTabId, previousWindowId } = await createForegroundTab(url));
    await waitForTabComplete(tab.id);
    await sleep(SEARCH_TAB_POST_LOAD_BUFFER_MS);

    const searchResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: searchTcmByHandle,
      args: [item.handle],
    });
    const outcome = searchResults && searchResults[0] && searchResults[0].result;
    if (!outcome || outcome.error || !outcome.match) {
      const errorMessages = {
        no_match: 'Không tìm thấy creator này trên TCM.',
        search_box_not_found: 'Không tìm thấy ô search trên trang Find Creators (trang tải chậm hoặc giao diện TCM đã đổi).',
        search_button_not_found: 'Tìm thấy ô search nhưng không tìm thấy nút search (giao diện TCM có thể đã đổi).',
      };
      const message = (outcome && errorMessages[outcome.error]) || 'Không thao tác được ô search TCM (giao diện TCM có thể đã thay đổi).';
      return { ok: false, handle: item.handle, message };
    }

    const listShape = normalizeCreator(outcome.match);
    const cid = listShape.tcmCreatorOecuid;
    if (!cid) {
      // Không có cid thì không mở được trang chi tiết — vẫn còn hơn không, lưu tạm data rút gọn
      // từ kết quả search vào buffer thay vì bỏ hẳn.
      if (listShape.handle) await mergeIntoCsvBuffer(listShape);
      return { ok: false, handle: item.handle, message: 'Tìm thấy creator nhưng không đọc được cid — đã lưu tạm data rút gọn từ kết quả search.' };
    }

    // Đã có cid, chuyển NGAY tab này (vẫn đang active) sang trang chi tiết để lấy đủ field
    // (giống processOneCsvQueueItem) — không cần trả focus giữa 2 bước, chỉ trả 1 lần ở finally.
    const detailUrl = `https://affiliate-us.tiktok.com/connection/creator/detail?cid=${encodeURIComponent(cid)}&shop_region=${encodeURIComponent(state.shopRegion || 'US')}&shop_id=${encodeURIComponent(state.shopId || '')}`;
    await chrome.tabs.update(tab.id, { url: detailUrl });
    await waitForTabComplete(tab.id);

    const detailResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: readProfileByCidInPageWithWait,
      args: [String(cid), POST_LOAD_BUFFER_MS],
    });
    const profile = detailResults && detailResults[0] && detailResults[0].result;
    const detail = profile ? normalizeTcmProfileDetail(profile) : null;

    if (detail) {
      await mergeIntoCsvBuffer(detail);
      return { ok: true, handle: item.handle, cid };
    }
    // Trang chi tiết chưa kịp trả data (load chậm) — vẫn lưu data rút gọn từ list-search thay vì mất trắng.
    await mergeIntoCsvBuffer(listShape);
    return { ok: false, handle: item.handle, message: 'Tìm thấy cid nhưng chưa đọc được trang chi tiết (có thể load chậm) — đã lưu tạm data rút gọn từ kết quả search.' };
  } catch (err) {
    return { ok: false, handle: item && item.handle, message: String((err && err.message) || err) };
  } finally {
    if (tab && tab.id) {
      chrome.tabs.remove(tab.id).catch(() => {});
    }
    await restoreForegroundTab(previousActiveTabId, previousWindowId);
  }
}

async function runCsvSearchQueueLoop() {
  if (isCsvSearchQueueProcessing) return;
  isCsvSearchQueueProcessing = true;
  try {
    for (;;) {
      const state = await getCsvSearchQueueState();
      if (!state || state.status !== 'running') break;
      if (state.index >= state.queue.length) {
        await patchCsvSearchQueueState({ status: 'done', currentHandle: null });
        break;
      }

      const item = state.queue[state.index];
      await patchCsvSearchQueueState({ currentHandle: item.handle });

      const result = await processOneCsvSearchQueueItem(state);

      const fresh = (await getCsvSearchQueueState()) || state;
      if (fresh.status !== 'running') break;

      const results = [...(fresh.results || []), result];
      await patchCsvSearchQueueState({
        index: fresh.index + 1,
        results,
        processedCount: (fresh.processedCount || 0) + 1,
        failedCount: (fresh.failedCount || 0) + (result.ok ? 0 : 1),
        currentHandle: null,
      });

      const after = await getCsvSearchQueueState();
      if (!after || after.status !== 'running') break;
      if (after.index >= after.queue.length) continue;

      await sleep(randomDelay(4000, 8000));
    }
  } finally {
    isCsvSearchQueueProcessing = false;
  }
}

async function startCsvSearchCidQueueInternal(items, shopId, shopRegion, maxCount) {
  const chunkSize = maxCount || items.length;
  const queued = items.slice(0, chunkSize);
  const pending = items.slice(chunkSize);
  await setCsvSearchQueueState({
    status: queued.length > 0 ? 'running' : 'done',
    queue: queued,
    pending,
    chunkSize,
    totalCount: items.length,
    index: 0,
    shopId,
    shopRegion: shopRegion || 'US',
    processedCount: 0,
    failedCount: 0,
    results: [],
    currentHandle: null,
    startedAt: Date.now(),
    updatedAt: Date.now(),
  });
  runCsvSearchQueueLoop();
  return { queued: queued.length, pending: pending.length, total: items.length };
}

async function continueCsvSearchCidQueueInternal() {
  const state = await getCsvSearchQueueState();
  if (!state || !state.pending || state.pending.length === 0) return { continued: false, pending: 0 };
  if (state.status === 'running') return { continued: false, pending: state.pending.length };
  const chunkSize = state.chunkSize || state.pending.length;
  const nextQueue = state.pending.slice(0, chunkSize);
  const nextPending = state.pending.slice(chunkSize);
  await patchCsvSearchQueueState({ status: 'running', queue: nextQueue, pending: nextPending, index: 0, currentHandle: null });
  runCsvSearchQueueLoop();
  return { continued: true, queued: nextQueue.length, pending: nextPending.length };
}

async function runListImportJob(message) {
  const jobType = 'list-import';
  stoppedJobTypes.delete(jobType);
  try {
    await setJob(jobType, { status: 'running', message: '⏳ Đang đọc data đã bắt được...' });

    const results = await chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      func: readTcmCapturedList,
    });
    if (await stopIfRequested(jobType)) return;
    const scraped = results && results[0] && results[0].result;
    const rawList = (scraped && scraped.list) || [];
    if (rawList.length === 0) {
      await setJob(jobType, { status: 'error', message: '⚠️ Chưa bắt được creator nào — hãy mở trang Find Creators trên affiliate-us.tiktok.com rồi tự cuộn/chuyển trang qua danh sách trước khi bấm nút này.' });
      return;
    }

    const matched = rawList.filter((flat) => matchesClientFilters(flat, message.filters || {}));
    const normalized = matched.map(normalizeCreator).filter((c) => c.handle);
    if (normalized.length === 0) {
      await setJob(jobType, { status: 'error', message: `⚠️ Bắt được ${rawList.length} creator nhưng không nhận diện được field handle nào (hoặc bị filter loại hết).` });
      return;
    }

    // Nút này KHÔNG còn tự đẩy lên webapp Pickdi nữa — chỉ đọc/đếm lại data đã bắt được để
    // operator xem trước, dùng nút "⬇️ Xuất CSV" nếu cần lấy ra file, hoặc tick "tự mở tab ẩn
    // lấy chi tiết" bên dưới nếu muốn đẩy thẳng creator (kèm chi tiết) lên Pickdi.
    if (await stopIfRequested(jobType)) return;
    await setJob(jobType, { status: 'done', message: `✅ Đã đọc được ${normalized.length}/${rawList.length} creator (chưa đẩy lên webapp — dùng nút Xuất CSV hoặc tick auto-detail nếu cần đẩy lên Pickdi).` });

    // Ghi nhớ shop_id/shop_region đọc được từ tab TCM thật lần này — LUÔN làm, không phụ
    // thuộc checkbox "auto-detail" bên dưới. Trước đây việc lưu này nằm trong nhánh
    // `if (message.autoDetail)`, nên bấm "Đọc data đã bắt được" mà không tick checkbox thì
    // Shop ID không bao giờ được lưu — khiến "Tìm & lấy chi tiết CSV" luôn báo thiếu Shop ID
    // dù operator đã làm đúng như thông báo lỗi yêu cầu.
    let shopId = '', shopRegion = 'US';
    try {
      const u = new URL(message.tabUrl);
      shopId = u.searchParams.get('shop_id') || '';
      shopRegion = u.searchParams.get('shop_region') || 'US';
    } catch (e) {}
    if (shopId) await chrome.storage.local.set({ lastShopId: shopId, lastShopRegion: shopRegion });

    if (message.autoDetail) {
      if (!shopId) {
        await setJob('auto-detail-kickoff', { status: 'error', message: '⚠️ Không đọc được shop_id từ tab hiện tại — hàng đợi tự động lấy chi tiết chưa chạy.' });
        return;
      }
      const items = normalized
        .filter((c) => c.handle && c.tcmCreatorOecuid)
        .map((c) => ({ cid: c.tcmCreatorOecuid, handle: c.handle }));
      if (items.length > 0) {
        await startAutoDetailQueueInternal(items, message.webappUrl, shopId, shopRegion, message.autoDetailMax, message.autoDetailContinue, message.autoDetailCooldownMs);
      }
    }
  } catch (err) {
    await setJob(jobType, { status: 'error', message: `❌ ${String((err && err.message) || err)}` });
  }
}

async function runDetailJob(message) {
  const jobType = message.mode === 'scan' ? 'auto-scan' : 'detail-single';
  stoppedJobTypes.delete(jobType);
  try {
    await setJob(jobType, { status: 'running', message: message.mode === 'scan' ? '⏳ Đang tự động click qua các tab (~10s)...' : '⏳ Đang đọc data đã bắt được...' });

    const results = await chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      func: message.mode === 'scan' ? autoScanAndReadTcmProfile : readTcmLastProfile,
    });
    if (await stopIfRequested(jobType)) return;
    const scraped = results && results[0] && results[0].result;
    if (!scraped) {
      await setJob(jobType, { status: 'error', message: '❌ Không đọc được trang.' });
      return;
    }
    const tabReport = message.mode === 'scan'
      ? `Đã bấm: ${(scraped.clicked || []).join(', ') || '(không có)'}.`
        + `${scraped.notFound && scraped.notFound.length > 0 ? ` Không tìm thấy tab: ${scraped.notFound.join(', ')}.` : ''}`
        + `${scraped.clickedButNoData && scraped.clickedButNoData.length > 0 ? ` Click được nhưng chưa thấy data: ${scraped.clickedButNoData.join(', ')}.` : ''}`
      : '';
    if (scraped.error) {
      await setJob(jobType, { status: 'error', message: `⚠️ ${scraped.error} ${tabReport}` });
      return;
    }

    const detail = normalizeTcmProfileDetail(scraped.profile);
    if (!detail) {
      await setJob(jobType, { status: 'error', message: `❌ Không đọc được handle của creator này từ data đã bắt. ${tabReport}` });
      return;
    }

    await setJob(jobType, { status: 'running', message: '🔄 Đang đẩy chi tiết về webapp...' });
    const source = message.mode === 'scan' ? 'Pickdi TCM Extension (auto-scan)' : 'Pickdi TCM Extension (detail)';
    let data;
    try {
      data = await postBatchImport(message.webappUrl, source, 'tcm', [detail]);
    } catch (err) {
      await setJob(jobType, { status: 'error', message: `❌ ${err.message}`, failedPayload: detail });
      return;
    }
    if (await stopIfRequested(jobType)) return;
    const summary = summarizeCapturedGroups(detail);
    await setJob(jobType, { status: 'done', message: `✅ Đã cập nhật chi tiết cho @${detail.handle}. ${summary} ${tabReport}` });
  } catch (err) {
    await setJob(jobType, { status: 'error', message: `❌ ${String((err && err.message) || err)}` });
  }
}

async function runDetailExportJob(message) {
  const jobType = message.mode === 'scan' ? 'auto-scan-export' : 'detail-single-export';
  stoppedJobTypes.delete(jobType);
  try {
    await setJob(jobType, { status: 'running', message: message.mode === 'scan' ? '⏳ Đang tự động click qua các tab (~10s)...' : '⏳ Đang đọc data đã bắt được...' });

    const results = await chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      func: message.mode === 'scan' ? autoScanAndReadTcmProfile : readTcmLastProfile,
    });
    if (await stopIfRequested(jobType)) return;
    const scraped = results && results[0] && results[0].result;
    if (!scraped) {
      await setJob(jobType, { status: 'error', message: '❌ Không đọc được trang.' });
      return;
    }
    const tabReport = message.mode === 'scan'
      ? `Đã bấm: ${(scraped.clicked || []).join(', ') || '(không có)'}.`
        + `${scraped.notFound && scraped.notFound.length > 0 ? ` Không tìm thấy tab: ${scraped.notFound.join(', ')}.` : ''}`
        + `${scraped.clickedButNoData && scraped.clickedButNoData.length > 0 ? ` Click được nhưng chưa thấy data: ${scraped.clickedButNoData.join(', ')}.` : ''}`
      : '';
    if (scraped.error) {
      await setJob(jobType, { status: 'error', message: `⚠️ ${scraped.error} ${tabReport}` });
      return;
    }

    const detail = normalizeTcmProfileDetail(scraped.profile);
    if (!detail) {
      await setJob(jobType, { status: 'error', message: `❌ Không đọc được handle của creator này từ data đã bắt. ${tabReport}` });
      return;
    }

    if (await stopIfRequested(jobType)) return;
    const count = await mergeIntoCsvBuffer(detail);
    const summary = summarizeCapturedGroups(detail);
    await setJob(jobType, { status: 'done', message: `✅ Đã lưu @${detail.handle} vào CSV buffer (${count} creator). ${summary} ${tabReport}` });
  } catch (err) {
    await setJob(jobType, { status: 'error', message: `❌ ${String((err && err.message) || err)}` });
  }
}

async function runEngagementJob(message) {
  const jobType = 'push-engagement';
  stoppedJobTypes.delete(jobType);
  try {
    await setJob(jobType, { status: 'running', message: '⏳ Đang đọc trang...' });

    const results = await chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      func: scrapeTikTokEngagementPage,
    });
    if (await stopIfRequested(jobType)) return;
    const scraped = results && results[0] && results[0].result;
    if (!scraped) {
      await setJob(jobType, { status: 'error', message: '❌ Không đọc được trang.' });
      return;
    }
    if (scraped.error) {
      await setJob(jobType, { status: 'error', message: `⚠️ ${scraped.error}` });
      return;
    }

    const creatorItem = {
      handle: scraped.handle,
      avatar: scraped.avatarUrl || undefined,
      bio: scraped.bio || undefined,
      email: scraped.email || undefined,
      instagram: scraped.instagram || undefined,
      avgViews: scraped.engagement.avgViews,
      engagementRate: scraped.engagement.erView ?? undefined,
      erFollower: scraped.engagement.erFollower ?? undefined,
      maxMinRatio: scraped.engagement.maxMinRatio ?? undefined,
      postingFrequency30d: scraped.engagement.postingFrequency ?? undefined,
      lastVideoDate: scraped.engagement.lastVideoDate || undefined,
    };

    await setJob(jobType, { status: 'running', message: '🔄 Đang đẩy engagement metrics về webapp...' });
    try {
      await postBatchImport(message.webappUrl, 'Pickdi Engagement Extension', 'manual', [creatorItem]);
    } catch (err) {
      await setJob(jobType, { status: 'error', message: `❌ ${err.message}`, failedPayload: creatorItem });
      return;
    }
    if (await stopIfRequested(jobType)) return;
    await setJob(jobType, { status: 'done', message: `✅ Đã cập nhật engagement cho @${creatorItem.handle}` });
  } catch (err) {
    await setJob(jobType, { status: 'error', message: `❌ ${String((err && err.message) || err)}` });
  }
}

async function runEngagementExportJob(message) {
  const jobType = 'push-engagement-export';
  stoppedJobTypes.delete(jobType);
  try {
    await setJob(jobType, { status: 'running', message: '⏳ Đang đọc trang...' });

    const results = await chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      world: 'MAIN',
      func: scrapeTikTokEngagementPage,
    });
    if (await stopIfRequested(jobType)) return;
    const scraped = results && results[0] && results[0].result;
    if (!scraped) {
      await setJob(jobType, { status: 'error', message: '❌ Không đọc được trang.' });
      return;
    }
    if (scraped.error) {
      await setJob(jobType, { status: 'error', message: `⚠️ ${scraped.error}` });
      return;
    }

    const creatorItem = {
      handle: scraped.handle,
      avatar: scraped.avatarUrl || undefined,
      bio: scraped.bio || undefined,
      email: scraped.email || undefined,
      instagram: scraped.instagram || undefined,
      avgViews: scraped.engagement.avgViews,
      engagementRate: scraped.engagement.erView ?? undefined,
      erFollower: scraped.engagement.erFollower ?? undefined,
      maxMinRatio: scraped.engagement.maxMinRatio ?? undefined,
      postingFrequency30d: scraped.engagement.postingFrequency ?? undefined,
      lastVideoDate: scraped.engagement.lastVideoDate || undefined,
    };

    if (await stopIfRequested(jobType)) return;
    const count = await mergeIntoCsvBuffer(creatorItem);
    await setJob(jobType, { status: 'done', message: `✅ Đã lưu @${creatorItem.handle} vào CSV buffer (${count} creator).` });
  } catch (err) {
    await setJob(jobType, { status: 'error', message: `❌ ${String((err && err.message) || err)}` });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'START_AUTO_DETAIL_QUEUE') {
    (async () => {
      const items = Array.isArray(message.items) ? message.items : [];
      const result = await startAutoDetailQueueInternal(items, message.webappUrl, message.shopId, message.shopRegion, message.maxCount, message.autoContinue, message.cooldownMs);
      sendResponse({ ok: true, ...result });
    })();
    return true; // async sendResponse
  }

  if (message.type === 'CONTINUE_AUTO_DETAIL_QUEUE') {
    (async () => {
      const result = await continueAutoDetailQueueInternal();
      sendResponse({ ok: true, ...result });
    })();
    return true;
  }

  if (message.type === 'STOP_AUTO_DETAIL_QUEUE') {
    (async () => {
      chrome.alarms.clear(AUTO_CONTINUE_ALARM);
      await patchState({ status: 'stopped', autoContinue: false });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'GET_AUTO_DETAIL_STATUS') {
    (async () => {
      const state = await getState();
      sendResponse(state);
    })();
    return true;
  }

  if (message.type === 'RUN_LIST_IMPORT') {
    runListImportJob(message);
    sendResponse({ ok: true, started: true });
    return false; // job chạy nền độc lập, popup không cần đợi — poll GET_EXT_JOBS để xem tiến độ
  }

  // Đọc + normalize lại đúng data đã bắt được (giống RUN_LIST_IMPORT) nhưng KHÔNG đẩy lên webapp —
  // trả thẳng mảng creator về popup để popup tự dựng CSV và tải xuống máy, dùng khi chỉ cần file
  // Excel/CSV để làm việc offline chứ chưa cần import vào Pickdi.
  if (message.type === 'RUN_LIST_EXPORT') {
    (async () => {
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: message.tabId },
          world: 'MAIN',
          func: readTcmCapturedList,
        });
        const scraped = results && results[0] && results[0].result;
        const rawList = (scraped && scraped.list) || [];
        const matched = rawList.filter((flat) => matchesClientFilters(flat, message.filters || {}));
        const normalized = matched.map(normalizeCreator).filter((c) => c.handle);
        sendResponse({ ok: true, creators: normalized, totalCaptured: rawList.length });
      } catch (err) {
        sendResponse({ ok: false, error: String((err && err.message) || err) });
      }
    })();
    return true; // async sendResponse
  }

  if (message.type === 'RUN_DETAIL_JOB') {
    runDetailJob(message);
    sendResponse({ ok: true, started: true });
    return false;
  }

  if (message.type === 'RUN_ENGAGEMENT_PUSH') {
    runEngagementJob(message);
    sendResponse({ ok: true, started: true });
    return false;
  }

  if (message.type === 'RUN_DETAIL_EXPORT_JOB') {
    runDetailExportJob(message);
    sendResponse({ ok: true, started: true });
    return false;
  }

  if (message.type === 'RUN_ENGAGEMENT_EXPORT_JOB') {
    runEngagementExportJob(message);
    sendResponse({ ok: true, started: true });
    return false;
  }

  if (message.type === 'GET_CSV_BUFFER') {
    (async () => {
      const creators = await getCsvBufferArray();
      sendResponse({ ok: true, creators });
    })();
    return true;
  }

  if (message.type === 'CLEAR_CSV_BUFFER') {
    (async () => {
      await clearCsvBuffer();
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'START_CSV_DETAIL_QUEUE') {
    (async () => {
      const items = Array.isArray(message.items) ? message.items : [];
      const result = await startCsvDetailQueueInternal(items, message.shopId, message.shopRegion, message.maxCount, message.autoContinue, message.cooldownMs);
      sendResponse({ ok: true, ...result });
    })();
    return true;
  }

  if (message.type === 'CONTINUE_CSV_DETAIL_QUEUE') {
    (async () => {
      const result = await continueCsvDetailQueueInternal();
      sendResponse({ ok: true, ...result });
    })();
    return true;
  }

  if (message.type === 'STOP_CSV_DETAIL_QUEUE') {
    (async () => {
      chrome.alarms.clear(CSV_QUEUE_AUTO_CONTINUE_ALARM);
      await patchCsvQueueState({ status: 'stopped', autoContinue: false });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'GET_CSV_DETAIL_QUEUE_STATUS') {
    (async () => {
      const state = await getCsvQueueState();
      sendResponse(state);
    })();
    return true;
  }

  if (message.type === 'START_CSV_SEARCH_CID_QUEUE') {
    (async () => {
      const items = Array.isArray(message.items) ? message.items : [];
      const result = await startCsvSearchCidQueueInternal(items, message.shopId, message.shopRegion, message.maxCount);
      sendResponse({ ok: true, ...result });
    })();
    return true;
  }

  if (message.type === 'CONTINUE_CSV_SEARCH_CID_QUEUE') {
    (async () => {
      const result = await continueCsvSearchCidQueueInternal();
      sendResponse({ ok: true, ...result });
    })();
    return true;
  }

  if (message.type === 'STOP_CSV_SEARCH_CID_QUEUE') {
    (async () => {
      await patchCsvSearchQueueState({ status: 'stopped' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'GET_CSV_SEARCH_CID_QUEUE_STATUS') {
    (async () => {
      const state = await getCsvSearchQueueState();
      sendResponse(state);
    })();
    return true;
  }

  if (message.type === 'GET_EXT_JOBS') {
    (async () => {
      const jobs = await getJobs();
      sendResponse(jobs);
    })();
    return true;
  }

  if (message.type === 'STOP_EXT_JOB') {
    (async () => {
      const jobType = message.jobType;
      stoppedJobTypes.add(jobType);
      const jobs = await getJobs();
      if (jobs[jobType] && jobs[jobType].status === 'running') {
        await setJob(jobType, { status: 'stopped', message: '⏹ Đã dừng.' });
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  return false;
});

// ================== TRIGGER TỪ WEBAPP (externally_connectable) ==================
// Webapp (Creator CRM) không có tab TCM đang mở nên không tự đọc được shop_id/shop_region từ
// URL như luồng "Import creator đã bắt được" — dùng lại shop_id/shop_region đã ghi nhớ từ lần
// gần nhất user tự chạy 1 trong 2 luồng đó trên chính máy này (xem runListImportJob ở trên).
// Không tự fetch()/ký request gì mới — vẫn chỉ là mở tab thật + đọc data TCM tự trả về, y hệt
// cơ chế đã có, chỉ khác nguồn kích hoạt.
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  if (!message || typeof message !== 'object') return false;

  if (message.type === 'WEBAPP_PING') {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return false;
  }

  if (message.type === 'WEBAPP_START_AUTO_DETAIL_QUEUE') {
    (async () => {
      const items = Array.isArray(message.items) ? message.items : [];
      if (items.length === 0) {
        sendResponse({ ok: false, message: 'Không có creator nào để cào (thiếu tcmCreatorOecuid).' });
        return;
      }
      let shopId = message.shopId, shopRegion = message.shopRegion;
      if (!shopId) {
        const stored = await chrome.storage.local.get(['lastShopId', 'lastShopRegion']);
        shopId = stored.lastShopId;
        shopRegion = stored.lastShopRegion || 'US';
      }
      if (!shopId) {
        sendResponse({
          ok: false,
          message: 'Chưa có Shop ID. Hãy mở popup extension, bấm "Import creator đã bắt được" ít nhất 1 lần từ tab TCM thật trước (extension tự ghi nhớ Shop ID từ đó) rồi thử lại.',
        });
        return;
      }
      const result = await startAutoDetailQueueInternal(
        items,
        message.webappUrl,
        shopId,
        shopRegion,
        message.maxCount,
        message.autoContinue !== false,
        message.cooldownMs
      );
      sendResponse({ ok: true, ...result });
    })();
    return true; // async sendResponse
  }

  if (message.type === 'WEBAPP_CONTINUE_AUTO_DETAIL_QUEUE') {
    (async () => {
      const result = await continueAutoDetailQueueInternal();
      sendResponse({ ok: true, ...result });
    })();
    return true;
  }

  if (message.type === 'WEBAPP_STOP_AUTO_DETAIL_QUEUE') {
    (async () => {
      chrome.alarms.clear(AUTO_CONTINUE_ALARM);
      await patchState({ status: 'stopped', autoContinue: false });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'WEBAPP_GET_AUTO_DETAIL_STATUS') {
    (async () => {
      const state = await getState();
      sendResponse(state);
    })();
    return true;
  }

  if (message.type === 'WEBAPP_START_SEARCH_CID_QUEUE') {
    (async () => {
      const items = Array.isArray(message.items) ? message.items : [];
      if (items.length === 0) {
        sendResponse({ ok: false, message: 'Không có creator nào để tìm (thiếu handle).' });
        return;
      }
      let shopId = message.shopId, shopRegion = message.shopRegion;
      if (!shopId) {
        const stored = await chrome.storage.local.get(['lastShopId', 'lastShopRegion']);
        shopId = stored.lastShopId;
        shopRegion = stored.lastShopRegion || 'US';
      }
      if (!shopId) {
        sendResponse({
          ok: false,
          message: 'Chưa có Shop ID. Hãy mở popup extension, bấm "Import creator đã bắt được" ít nhất 1 lần từ tab TCM thật trước rồi thử lại.',
        });
        return;
      }
      const result = await startSearchCidQueueInternal(items, message.webappUrl, shopId, shopRegion, message.maxCount);
      sendResponse({ ok: true, ...result });
    })();
    return true;
  }

  if (message.type === 'WEBAPP_STOP_SEARCH_CID_QUEUE') {
    (async () => {
      await patchSearchCidState({ status: 'stopped' });
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (message.type === 'WEBAPP_GET_SEARCH_CID_STATUS') {
    (async () => {
      const state = await getSearchCidState();
      sendResponse(state);
    })();
    return true;
  }

  return false;
});

// Cooldown giữa 2 chunk auto-continue dùng chrome.alarms (không sleep() trong service worker)
// vì SW có thể bị Chrome tắt giữa chừng lúc idle (vài chục giây) — alarms vẫn kích hoạt lại SW
// đúng giờ dù nó đã bị tắt hẳn, còn 1 Promise sleep() đang treo thì chết theo SW luôn.
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === AUTO_CONTINUE_ALARM) {
    const state = await getState();
    if (!state || state.status !== 'done' || !state.autoContinue || !state.pending || state.pending.length === 0) return;
    await continueAutoDetailQueueInternal();
    return;
  }
  if (alarm.name === CSV_QUEUE_AUTO_CONTINUE_ALARM) {
    const state = await getCsvQueueState();
    if (!state || state.status !== 'done' || !state.autoContinue || !state.pending || state.pending.length === 0) return;
    await continueCsvDetailQueueInternal();
  }
});

// Nếu service worker bị Chrome tắt giữa chừng rồi dựng lại (ví dụ do idle timeout), top-level
// này chạy lại mỗi lần wake — tự resume nếu còn hàng đợi 'running' dang dở, để "treo đó" thật sự
// nghĩa là tiếp tục dù đóng popup, không cần user tự bấm lại.
(async () => {
  const state = await getState();
  if (state && state.status === 'running') runLoop();
  const searchCidState = await getSearchCidState();
  if (searchCidState && searchCidState.status === 'running') runSearchCidLoop();
  const csvQueueState = await getCsvQueueState();
  if (csvQueueState && csvQueueState.status === 'running') runCsvQueueLoop();
  const csvSearchQueueState = await getCsvSearchQueueState();
  if (csvSearchQueueState && csvSearchQueueState.status === 'running') runCsvSearchQueueLoop();
})();
