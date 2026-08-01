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
const POST_LOAD_BUFFER_MS = 1800; // đợi thêm sau khi tab 'complete' để interceptor.js kịp merge response

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

async function processOneItem(state) {
  const item = state.queue[state.index];
  let tab;
  try {
    const url = `https://affiliate-us.tiktok.com/connection/creator/detail?cid=${encodeURIComponent(item.cid)}&shop_region=${encodeURIComponent(state.shopRegion || 'US')}&shop_id=${encodeURIComponent(state.shopId || '')}`;
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabComplete(tab.id);
    await sleep(POST_LOAD_BUFFER_MS);

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: readProfileByCidInPage,
      args: [String(item.cid)],
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
  let previousActiveTabId;
  try {
    const url = `https://affiliate-us.tiktok.com/connection/creator?shop_region=${encodeURIComponent(state.shopRegion || 'US')}&shop_id=${encodeURIComponent(state.shopId || '')}`;
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabComplete(tab.id);
    // Khác trang chi tiết creator (SSR gần đủ data ngay khi load) — ô AI-search trên Find
    // Creators là component client-render nặng, và Chrome DỪNG HẲN requestAnimationFrame cho tab
    // nền/ẩn (không chỉ giảm tần suất) nên tab mở active:false có thể không bao giờ mount xong ô
    // search trong lúc vẫn ẩn — đây là nguyên nhân thật gây lỗi "search_box_not_found" khi test
    // (xác nhận bằng cách so sánh với lần test tay trước đó luôn thành công vì tab đang active).
    // Đánh đổi: focus tạm sang tab này khi chạy script rồi trả lại tab đang active của user ngay
    // sau đó — có nháy tab qua lại mỗi creator, chấp nhận được để đổi lấy độ tin cậy.
    const [prevActiveTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    previousActiveTabId = prevActiveTab && prevActiveTab.id;
    await chrome.tabs.update(tab.id, { active: true });
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
    if (previousActiveTabId) {
      chrome.tabs.update(previousActiveTabId, { active: true }).catch(() => {});
    }
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

    await setJob(jobType, { status: 'running', message: `🔄 Đang đẩy ${normalized.length}/${rawList.length} creator về webapp...` });
    let data;
    try {
      data = await postBatchImport(message.webappUrl, 'Pickdi TCM Extension', 'tcm', normalized);
    } catch (err) {
      await setJob(jobType, { status: 'error', message: `❌ ${err.message}`, failedPayload: normalized });
      return;
    }
    if (await stopIfRequested(jobType)) return;
    await setJob(jobType, { status: 'done', message: `✅ +${data.importedCount} creator mới (${data.updatedCount} cập nhật) / ${rawList.length} đã bắt được` });

    if (message.autoDetail) {
      let shopId = '', shopRegion = 'US';
      try {
        const u = new URL(message.tabUrl);
        shopId = u.searchParams.get('shop_id') || '';
        shopRegion = u.searchParams.get('shop_region') || 'US';
      } catch (e) {}
      // Ghi nhớ shop_id/shop_region đọc được lần này — webapp (không có tab TCM đang mở) sẽ
      // dùng lại giá trị này làm fallback khi tự kích hoạt hàng đợi qua externally_connectable.
      if (shopId) await chrome.storage.local.set({ lastShopId: shopId, lastShopRegion: shopRegion });
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
  if (alarm.name !== AUTO_CONTINUE_ALARM) return;
  const state = await getState();
  if (!state || state.status !== 'done' || !state.autoContinue || !state.pending || state.pending.length === 0) return;
  await continueAutoDetailQueueInternal();
});

// Nếu service worker bị Chrome tắt giữa chừng rồi dựng lại (ví dụ do idle timeout), top-level
// này chạy lại mỗi lần wake — tự resume nếu còn hàng đợi 'running' dang dở, để "treo đó" thật sự
// nghĩa là tiếp tục dù đóng popup, không cần user tự bấm lại.
(async () => {
  const state = await getState();
  if (state && state.status === 'running') runLoop();
  const searchCidState = await getSearchCidState();
  if (searchCidState && searchCidState.status === 'running') runSearchCidLoop();
})();
