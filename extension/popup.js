// Tự động lưu và load Webapp URL + filter đã nhập gần nhất
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['webappUrl', 'lastFilters'], (res) => {
    document.getElementById('webappUrl').value = res.webappUrl || 'http://localhost:3000';
    const f = res.lastFilters || {};
    if (f.follower_min) document.getElementById('followerMin').value = f.follower_min;
    if (f.follower_max) document.getElementById('followerMax').value = f.follower_max;
    if (f.query_keyword) document.getElementById('keyword').value = f.query_keyword;
  });
});

function getWebappUrl() {
  return (document.getElementById('webappUrl').value.trim() || 'http://localhost:3000').replace(/\/$/, '');
}

// host_permissions only covers affiliate-us.tiktok.com/tiktok.com/localhost/127.0.0.1 out of
// the box — a custom (e.g. staging/production) webappUrl needs its origin granted at runtime
// via the optional_host_permissions declared in manifest.json, or fetches to it hit plain CORS
// failures with no recovery path.
async function ensureWebappHostPermission(webappUrl) {
  let origin;
  try {
    origin = new URL(webappUrl).origin + '/*';
  } catch {
    return false;
  }
  const hasPermission = await chrome.permissions.contains({ origins: [origin] });
  if (hasPermission) return true;
  return chrome.permissions.request({ origins: [origin] });
}

// Renders plain text safely (no innerHTML) — several status strings here embed data
// scraped from TikTok (handle/bio/nickname), which the creator themselves controls, so
// building HTML via string interpolation would let an attacker-crafted profile execute
// script inside this extension's popup (chrome.storage/chrome.tabs/chrome.scripting access).
function setStatusText(el, text, color) {
  el.textContent = text;
  el.style.color = color || '';
}

// AGENTS.md network/CORS-fallback rule: khi POST sync tới CRM lỗi, data KHÔNG được mất — giờ
// job chạy trong background.js (không có clipboard/DOM) nên lưu payload lỗi vào chrome.storage
// (job.failedPayload) rồi copy vào clipboard ngay khi popup mở lại và render thấy job đó lỗi
// (xem renderJob) thay vì copy thẳng lúc lỗi xảy ra như bản cũ.
async function copyToClipboardFallback(payload, statusEl) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    const prevColor = statusEl.style.color;
    const prevText = statusEl.textContent;
    setStatusText(statusEl, `${prevText} — 📋 Đã copy data vào clipboard, dán thủ công vào CRM Import.`, prevColor);
  } catch (err) {
    console.error('Clipboard fallback failed:', err);
  }
}

// parseMoney/extractMoneyLikeValue/toNum/asString/DEMO_LABELS/extractHandle/
// normalizeTcmProfileDetail/normalizeCreator/readTcmCapturedList/readTcmLastProfile/
// autoScanAndReadTcmProfile/scrapeTikTokEngagementPage/summarizeCapturedGroups giờ nằm ở
// shared.js (nạp trước popup.js trong popup.html) — dùng chung với background.js, tránh trùng
// định nghĩa (2 <script> cùng khai báo trùng tên sẽ vỡ ngay khi popup.html load).

// ================== JOB CHẠY NỀN TRONG background.js (session 10) ==================
// Mọi flow bấm nút (import list/lấy chi tiết/auto-scan/push engagement) trước đây đọc tab +
// fetch() thẳng trong popup.js — nếu user chuyển tab (Chrome tự đóng popup) đúng lúc đang
// fetch, request bị huỷ giữa chừng, không có gì được lưu. Giờ popup.js chỉ gửi 1 message "bắt
// đầu job" cho background.js rồi poll GET_EXT_JOBS để hiển thị lại tiến độ — job tự chạy tới
// khi xong dù popup đóng/mở lại bao nhiêu lần, y hệt cơ chế hàng đợi auto-detail-queue.
const JOB_STATUS_DIVS = {
  'list-import': 'findStatus',
  'detail-single': 'detailStatus',
  'auto-scan': 'autoScanStatus',
  'push-engagement': 'engagementStatus',
};

const JOB_STOP_BUTTONS = {
  'list-import': 'stopListImportBtn',
  'detail-single': 'stopDetailSingleBtn',
  'auto-scan': 'stopAutoScanBtn',
  'push-engagement': 'stopEngagementBtn',
};

for (const [jobType, btnId] of Object.entries(JOB_STOP_BUTTONS)) {
  const btn = document.getElementById(btnId);
  if (!btn) continue;
  btn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_EXT_JOB', jobType });
  });
}

const copiedFailedPayloadAt = {};
function renderJob(jobType, job) {
  const divId = JOB_STATUS_DIVS[jobType];
  if (!divId || !job) return;
  const div = document.getElementById(divId);
  if (!div) return;
  const color = job.status === 'error' ? 'red' : job.status === 'running' ? 'orange' : 'green';
  setStatusText(div, job.message || '', color);
  if (job.status === 'error' && job.failedPayload && copiedFailedPayloadAt[jobType] !== job.updatedAt) {
    copiedFailedPayloadAt[jobType] = job.updatedAt;
    copyToClipboardFallback(job.failedPayload, div);
  }
  const stopBtn = document.getElementById(JOB_STOP_BUTTONS[jobType]);
  if (stopBtn) stopBtn.style.display = job.status === 'running' ? 'block' : 'none';
}

let jobsPollTimer = null;
function startJobsPolling() {
  if (jobsPollTimer) return;
  const tick = async () => {
    const jobs = await chrome.runtime.sendMessage({ type: 'GET_EXT_JOBS' }).catch(() => null);
    if (!jobs) return;
    let anyRunning = false;
    for (const jobType of Object.keys(JOB_STATUS_DIVS)) {
      if (jobs[jobType]) renderJob(jobType, jobs[jobType]);
      if (jobs[jobType] && jobs[jobType].status === 'running') anyRunning = true;
    }
    if (!anyRunning) {
      clearInterval(jobsPollTimer);
      jobsPollTimer = null;
    }
  };
  tick();
  jobsPollTimer = setInterval(tick, 1500);
}

// Popup có thể bị đóng/mở lại nhiều lần trong lúc job vẫn chạy nền (kể cả auto-detail-queue) —
// mỗi lần popup mở lại phải tự đọc trạng thái hiện tại thay vì coi như chưa có gì chạy.
document.addEventListener('DOMContentLoaded', async () => {
  const jobs = await chrome.runtime.sendMessage({ type: 'GET_EXT_JOBS' }).catch(() => null);
  if (jobs) {
    let anyRunning = false;
    for (const jobType of Object.keys(JOB_STATUS_DIVS)) {
      if (jobs[jobType]) renderJob(jobType, jobs[jobType]);
      if (jobs[jobType] && jobs[jobType].status === 'running') anyRunning = true;
    }
    if (anyRunning) startJobsPolling();
  }

  const autoDetailState = await chrome.runtime.sendMessage({ type: 'GET_AUTO_DETAIL_STATUS' }).catch(() => null);
  if (autoDetailState && autoDetailState.queue && autoDetailState.queue.length > 0) {
    renderAutoDetailStatus(autoDetailState);
    // Poll cả khi 'done' nhưng autoContinue bật + còn pending, để popup tự cập nhật UI ngay khi
    // alarm nạp chunk kế tiếp và chuyển lại 'running' (không cần user tự mở/đóng popup để thấy).
    if (autoDetailState.status === 'running' || (autoDetailState.status === 'done' && autoDetailState.autoContinue && autoDetailState.pending && autoDetailState.pending.length > 0)) {
      startAutoDetailPolling();
    }
  }
});

// ================== IMPORT CREATOR ĐÃ BẮT ĐƯỢC TỪ TCM (passive-capture) ==================
// TCM (affiliate-us.tiktok.com/api/v1/oec/...) bắt buộc mọi request phải có chữ ký chống bot
// msToken/X-Bogus/X-Gnarly do chính JS của trang tự tính khi user thao tác thật — nên KHÔNG
// tự mở tab/tự gọi fetch() hộ user được nữa (test thật cho lỗi "code=98001004: Invalid
// parameters" vì thiếu các chữ ký này). Thay vào đó: user tự cuộn/chuyển trang danh sách
// creator trên TCM như bình thường, interceptor.js (world MAIN) âm thầm đọc response thật đổ
// vào window.__pickdi_tcm_list — nút này chỉ báo background.js đọc lại tab đang active và đẩy
// TOÀN BỘ những gì đã tích luỹ được lên webapp, chạy hoàn toàn trong service worker.
document.getElementById('findCreatorsBtn').addEventListener('click', async () => {
  const findStatusDiv = document.getElementById('findStatus');
  const webappUrl = getWebappUrl();
  chrome.storage.local.set({ webappUrl });

  if (!(await ensureWebappHostPermission(webappUrl))) {
    setStatusText(findStatusDiv, '❌ Cần cấp quyền truy cập webapp URL này trước.', 'red');
    return;
  }

  const filters = {
    follower_min: Number(document.getElementById('followerMin').value) || undefined,
    follower_max: Number(document.getElementById('followerMax').value) || undefined,
    query_keyword: document.getElementById('keyword').value.trim() || undefined,
  };
  if (filters.follower_min && filters.follower_max && filters.follower_min > filters.follower_max) {
    [filters.follower_min, filters.follower_max] = [filters.follower_max, filters.follower_min];
  }
  chrome.storage.local.set({ lastFilters: filters });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const autoDetail = document.getElementById('autoDetailCheckbox').checked;
  const autoDetailMax = Number(document.getElementById('autoDetailMax').value) || 20;
  const autoDetailContinue = document.getElementById('autoDetailContinueCheckbox').checked;
  const autoDetailCooldownMs = (Number(document.getElementById('autoDetailCooldownMin').value) || 1) * 60000;

  setStatusText(findStatusDiv, '⏳ Đang đọc data đã bắt được...', 'orange');
  await chrome.runtime.sendMessage({
    type: 'RUN_LIST_IMPORT',
    tabId: tab.id,
    tabUrl: tab.url,
    webappUrl,
    filters,
    autoDetail,
    autoDetailMax,
    autoDetailContinue,
    autoDetailCooldownMs,
  });
  startJobsPolling();
  if (autoDetail) {
    // job list-import tự kích hoạt auto-detail-queue khi xong (trong background.js) — bắt đầu
    // poll trạng thái hàng đợi đó luôn để hiển thị ngay khi nó chuyển sang 'running'.
    setTimeout(startAutoDetailPolling, 2000);
  }
});

let autoDetailPollTimer = null;
function startAutoDetailPolling() {
  if (autoDetailPollTimer) return;
  const tick = async () => {
    const state = await chrome.runtime.sendMessage({ type: 'GET_AUTO_DETAIL_STATUS' });
    renderAutoDetailStatus(state);
    const waitingForAutoContinue = state && state.status === 'done' && state.autoContinue && state.pending && state.pending.length > 0;
    if (!state || (state.status !== 'running' && !waitingForAutoContinue)) {
      clearInterval(autoDetailPollTimer);
      autoDetailPollTimer = null;
    }
  };
  tick();
  autoDetailPollTimer = setInterval(tick, 2000);
}

function renderAutoDetailStatus(state) {
  const div = document.getElementById('autoDetailQueueStatus');
  const stopBtn = document.getElementById('stopAutoDetailBtn');
  const continueBtn = document.getElementById('continueAutoDetailBtn');
  if (!state || !state.queue || state.queue.length === 0) {
    stopBtn.style.display = 'none';
    continueBtn.style.display = 'none';
    return;
  }
  // `queue` chỉ là đợt (chunk) hiện tại — total/done phải tính trên totalCount (toàn bộ danh
  // sách đã import) để không bị reset về đợt nhỏ mỗi lần "Lấy tiếp" nạp chunk kế.
  const total = state.totalCount || state.queue.length;
  const done = state.processedCount || 0;
  const failed = state.failedCount || 0;
  const pending = (state.pending && state.pending.length) || 0;
  if (state.status === 'running') {
    stopBtn.style.display = 'block';
    continueBtn.style.display = 'none';
    setStatusText(div, `🤖 Đang chạy nền: ${done}/${total} xong (${failed} lỗi)${state.currentHandle ? ` — đang mở @${state.currentHandle}` : ''}...`, 'orange');
  } else {
    stopBtn.style.display = 'none';
    const color = failed > 0 ? 'orange' : 'green';
    const label = state.status === 'stopped' ? 'Đã dừng' : 'Hoàn tất';
    if (state.status === 'done' && pending > 0 && state.autoContinue) {
      continueBtn.style.display = 'none';
      setStatusText(div, `${label} đợt này: ${done}/${total} xong (${failed} lỗi). ⏳ Còn ${pending} creator chưa lấy — sẽ tự lấy tiếp sau ${Math.round((state.cooldownMs || 45000) / 60000 * 10) / 10} phút.`, color);
    } else if (state.status === 'done' && pending > 0) {
      continueBtn.style.display = 'block';
      setStatusText(div, `${label} đợt này: ${done}/${total} xong (${failed} lỗi). Còn ${pending} creator chưa lấy — bấm "Lấy tiếp" khi sẵn sàng.`, color);
    } else {
      continueBtn.style.display = 'none';
      setStatusText(div, `${state.status === 'stopped' ? '⏹' : '✅'} ${label}: ${done}/${total} xong (${failed} lỗi).`, color);
    }
  }
}

document.getElementById('stopAutoDetailBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'STOP_AUTO_DETAIL_QUEUE' });
});

document.getElementById('continueAutoDetailBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CONTINUE_AUTO_DETAIL_QUEUE' });
  startAutoDetailPolling();
});

// ================== LẤY CHI TIẾT TRANG CREATOR TCM ==================
// Nút này không mở tab mới — user tự mở & xem chi tiết 1 creator trên TCM trước (đợi vài giây
// cho các tab con Sales/Video/Audience tự load). Đọc tab + POST webapp chạy trong
// background.js (RUN_DETAIL_JOB) nên popup đóng giữa chừng không làm mất tiến độ.
document.getElementById('pushDetailBtn').addEventListener('click', async () => {
  const detailStatusDiv = document.getElementById('detailStatus');
  const webappUrl = getWebappUrl();
  chrome.storage.local.set({ webappUrl });

  if (!(await ensureWebappHostPermission(webappUrl))) {
    setStatusText(detailStatusDiv, '❌ Cần cấp quyền truy cập webapp URL này trước.', 'red');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(detailStatusDiv, '⏳ Đang đọc data đã bắt được...', 'orange');
  await chrome.runtime.sendMessage({ type: 'RUN_DETAIL_JOB', mode: 'read', tabId: tab.id, webappUrl });
  startJobsPolling();
});

// ================== AUTO QUÉT QUA CÁC TAB CON (thay bạn tự click tay) ==================
// TCM ký MỌI request bằng msToken/X-Bogus/X-Gnarly tính bởi JS của chính trang lúc user thao
// tác thật — hàm autoScanAndReadTcmProfile (shared.js) chỉ tự bấm hộ các nút tab thật trên
// trang, không tự fetch()/giả mạo chữ ký. Đọc tab + POST webapp chạy trong background.js.
document.getElementById('autoScanBtn').addEventListener('click', async () => {
  const autoScanStatusDiv = document.getElementById('autoScanStatus');
  const webappUrl = getWebappUrl();
  chrome.storage.local.set({ webappUrl });

  if (!(await ensureWebappHostPermission(webappUrl))) {
    setStatusText(autoScanStatusDiv, '❌ Cần cấp quyền truy cập webapp URL này trước.', 'red');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(autoScanStatusDiv, '⏳ Đang tự động click qua các tab (~10s)...', 'orange');
  await chrome.runtime.sendMessage({ type: 'RUN_DETAIL_JOB', mode: 'scan', tabId: tab.id, webappUrl });
  startJobsPolling();
});

// ================== LẤY ENGAGEMENT METRICS TRANG PROFILE TIKTOK (tiktok.com/@handle) ==================
// User tự mở trang tiktok.com/@handle của creator, bấm nút này. scrapeTikTokEngagementPage
// (shared.js) đọc window.__pickdi_items do interceptor.js chặn từ API item_list thật ra số
// liệu engagement chính xác. Đọc tab + POST webapp chạy trong background.js.
document.getElementById('pushEngagementBtn').addEventListener('click', async () => {
  const engagementStatusDiv = document.getElementById('engagementStatus');
  const webappUrl = getWebappUrl();
  chrome.storage.local.set({ webappUrl });

  if (!(await ensureWebappHostPermission(webappUrl))) {
    setStatusText(engagementStatusDiv, '❌ Cần cấp quyền truy cập webapp URL này trước.', 'red');
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(engagementStatusDiv, '⏳ Đang đọc trang...', 'orange');
  await chrome.runtime.sendMessage({ type: 'RUN_ENGAGEMENT_PUSH', tabId: tab.id, webappUrl });
  startJobsPolling();
});
