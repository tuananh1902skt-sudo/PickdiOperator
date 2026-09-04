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

// AGENTS.md network/CORS-fallback rule: khi POST sync tới CRM lỗi, data KHÔNG được mất — job
// chạy trong background.js (không có clipboard/DOM) nên lưu payload lỗi vào chrome.storage
// (job.failedPayload). Copy vào clipboard CHỈ khi user chủ động bấm dòng trạng thái (xem
// renderJob) — trước đây tự copy ngầm mỗi lần popup mở/render thấy job lỗi, ghi đè bất ngờ bất
// cứ thứ gì user vừa copy (vd danh sách handle định dán vào ô Kalodata) mà không báo trước.
async function copyToClipboardFallback(payload, statusEl) {
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    const prevColor = statusEl.style.color;
    const prevText = statusEl.dataset.baseMessage || statusEl.textContent;
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
  'detail-single-export': 'detailStatus',
  'auto-scan-export': 'autoScanStatus',
  'push-engagement-export': 'engagementStatus',
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

function renderJob(jobType, job) {
  const divId = JOB_STATUS_DIVS[jobType];
  if (!divId || !job) return;
  const div = document.getElementById(divId);
  if (!div) return;
  const color = job.status === 'error' ? 'red' : job.status === 'running' ? 'orange' : 'green';
  if (job.status === 'error' && job.failedPayload) {
    div.dataset.baseMessage = job.message || '';
    setStatusText(div, `${job.message || ''} — 📋 Bấm vào đây để copy data lỗi vào clipboard.`, color);
    div.style.cursor = 'pointer';
    div.onclick = () => copyToClipboardFallback(job.failedPayload, div);
  } else {
    delete div.dataset.baseMessage;
    setStatusText(div, job.message || '', color);
    div.style.cursor = '';
    div.onclick = null;
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
  const autoDetailMax = Number(document.getElementById('autoDetailMax').value) || 0; // 0 = không giới hạn, background.js xử lý toàn bộ list trong 1 đợt
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

// ================== XUẤT CSV DANH SÁCH ĐÃ BẮT (không đẩy lên webapp) ==================
// Cột/tên/thứ tự PHẢI khớp CHÍNH XÁC MAIN_COLUMNS trong src/components/export/ExportView.tsx —
// đó là bảng nhận diện SYN trong apps-script (Import.gs) phía Sheet, dán sai tên/thứ tự cột thì
// script không map được. Đổi cột ở đây thì phải đổi cả 2 chỗ kia.
function csvEscapeCell(v) {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}

function fmtCell(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'x' : '';
  return String(v);
}

function roundPctCell(v, digits) {
  return String(Number(v.toFixed(digits)));
}

// plain=true (mặc định của ExportView) — số thuần để Sheet tính công thức được, không rút gọn
// dạng $53k như bản hiển thị trên UI webapp.
function formatUsdShortCell(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  return String(Math.round(v));
}

function beautyRatioCell(c) {
  if (c.beautyCategoryRatio !== undefined) return c.beautyCategoryRatio;
  const split = c.salesMetrics && c.salesMetrics.categorySplit;
  const beauty = Array.isArray(split) ? split.find((x) => (x.name || '').toLowerCase().includes('beauty')) : undefined;
  return beauty ? beauty.value : undefined;
}

function categoryTop2Cell(c) {
  const split = c.salesMetrics && Array.isArray(c.salesMetrics.categorySplit)
    ? c.salesMetrics.categorySplit.filter((x) => x.name !== '-1')
    : [];
  if (split.length > 0) {
    return [...split]
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((x, i) => `${i + 1}. ${x.name} ${roundPctCell(x.value, 1)}%`)
      .join('\n');
  }
  return fmtCell(c.category);
}

function personaStrCell(c) {
  const demo = c.demographics;
  if (!demo) return '';
  return [demo.topGender, demo.topAgeGroup, demo.topCountry].filter(Boolean).join(' / ');
}

function gmvPerVideoCell(c) {
  const n = c.videoMetrics && c.videoMetrics.videosCount;
  if (c.gmv30d === undefined || !n || n <= 0) return undefined;
  return c.gmv30d / n;
}

function whyThisCreatorCell(c) {
  const facts = [];
  if (c.gmv30d !== undefined && c.gmv30d > 0) facts.push(`GMV 30d ${formatUsdShortCell(c.gmv30d)}`);
  const beauty = beautyRatioCell(c);
  if (beauty !== undefined) facts.push(`${roundPctCell(beauty, 0)}% revenue from beauty category`);
  const demo = c.demographics;
  if (demo && demo.topGender && demo.topAgeGroup) {
    facts.push(`top audience ${demo.topGender} ${demo.topAgeGroup}${demo.topCountry ? ` in ${demo.topCountry}` : ''}`);
  }
  if (c.engagementRate !== undefined && c.engagementRate >= 7) {
    facts.push(`engagement ${roundPctCell(c.engagementRate, 1)}% above average`);
  }
  if (facts.length === 0) return '';
  const collabCount = c.collabMetrics && c.collabMetrics.brandCollabCount;
  const isTopTier = c.gmvTier === 'L4' || c.gmvTier === 'L5';
  let conclusion = '';
  if (isTopTier) {
    conclusion = collabCount ? `safe pick, already collabed with ${collabCount} other brands` : 'safe pick';
  } else if (beauty !== undefined && beauty >= 50) {
    conclusion = 'strong fit for the category';
  } else if ((c.gmv30d === undefined || c.gmv30d < 5000) && c.engagementRate !== undefined && c.engagementRate >= 7) {
    conclusion = 'good candidate to test a new product';
  }
  return conclusion ? `${facts.slice(0, 3).join(', ')} — ${conclusion}.` : `${facts.slice(0, 3).join(', ')}.`;
}

const MAIN_SHEET_COLUMNS = [
  { header: 'handle', get: (c) => fmtCell(c.handle) },
  { header: 'email', get: (c) => fmtCell(c.email) },
  { header: 'name', get: (c) => fmtCell(c.displayName) },
  { header: 'source', get: () => 'TCM' },
  { header: 'follower', get: (c) => formatUsdShortCell(c.followers) },
  { header: 'gmv 30d', get: (c) => formatUsdShortCell(c.gmv30d) },
  { header: 'gmv/video', get: (c) => formatUsdShortCell(gmvPerVideoCell(c)) },
  { header: 'gpm', get: (c) => formatUsdShortCell(c.gpm) },
  { header: 'avg views', get: (c) => formatUsdShortCell(c.avgViews) },
  { header: 'beauty %', get: (c) => (beautyRatioCell(c) !== undefined ? roundPctCell(beautyRatioCell(c), 1) : '') },
  { header: 'female %', get: (c) => (c.demographics && c.demographics.genderFemale !== undefined ? roundPctCell(c.demographics.genderFemale, 1) : '') },
  { header: 'age group', get: (c) => fmtCell(c.demographics && c.demographics.topAgeGroup) },
  { header: 'category', get: (c) => categoryTop2Cell(c) },
  { header: 'video link', get: (c) => fmtCell(c.recentVideos && c.recentVideos.find((v) => v.videoUrl) && c.recentVideos.find((v) => v.videoUrl).videoUrl) },
  { header: 'persona', get: (c) => personaStrCell(c) },
  { header: 'why this creator', get: (c) => whyThisCreatorCell(c) },
];

function downloadCreatorsCsv(creators, filename) {
  const header = MAIN_SHEET_COLUMNS.map((col) => col.header).join(',');
  const rows = creators.map((c) => MAIN_SHEET_COLUMNS.map((col) => csvEscapeCell(col.get(c))).join(','));
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

document.getElementById('exportCsvBtn').addEventListener('click', async () => {
  const findStatusDiv = document.getElementById('findStatus');
  const filters = {
    follower_min: Number(document.getElementById('followerMin').value) || undefined,
    follower_max: Number(document.getElementById('followerMax').value) || undefined,
    query_keyword: document.getElementById('keyword').value.trim() || undefined,
  };
  if (filters.follower_min && filters.follower_max && filters.follower_min > filters.follower_max) {
    [filters.follower_min, filters.follower_max] = [filters.follower_max, filters.follower_min];
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(findStatusDiv, '⏳ Đang đọc data đã bắt được để xuất CSV...', 'orange');
  const res = await chrome.runtime.sendMessage({ type: 'RUN_LIST_EXPORT', tabId: tab.id, filters }).catch((err) => ({ ok: false, error: String(err) }));
  if (!res || !res.ok) {
    setStatusText(findStatusDiv, `❌ ${(res && res.error) || 'Không đọc được data.'}`, 'red');
    return;
  }
  if (res.creators.length === 0) {
    setStatusText(findStatusDiv, `⚠️ Bắt được ${res.totalCaptured} creator nhưng không có creator nào khớp filter/có handle hợp lệ.`, 'red');
    return;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  downloadCreatorsCsv(res.creators, `tcm-creators-${stamp}.csv`);
  setStatusText(findStatusDiv, `✅ Đã tải CSV ${res.creators.length}/${res.totalCaptured} creator.`, 'green');
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

// ================== HÀNG ĐỢI TỰ ĐỘNG LẤY CHI TIẾT CSV (không đẩy webapp) ==================
// Đọc lại đúng data đã bắt được ở list bên trên (RUN_LIST_EXPORT — không cần quyền webapp),
// lọc creator có tcmCreatorOecuid, rồi nhờ background.js tự mở lần lượt từng trang chi tiết và
// gộp vào CSV buffer — y hệt cơ chế "🤖 Sau khi import, tự mở tab ẩn..." ở trên nhưng không đẩy
// webapp ở bước cuối.
document.getElementById('startCsvAutoDetailBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('csvAutoDetailQueueStatus');
  const filters = {
    follower_min: Number(document.getElementById('followerMin').value) || undefined,
    follower_max: Number(document.getElementById('followerMax').value) || undefined,
    query_keyword: document.getElementById('keyword').value.trim() || undefined,
  };
  if (filters.follower_min && filters.follower_max && filters.follower_min > filters.follower_max) {
    [filters.follower_min, filters.follower_max] = [filters.follower_max, filters.follower_min];
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(statusDiv, '⏳ Đang đọc data đã bắt được...', 'orange');
  const res = await chrome.runtime.sendMessage({ type: 'RUN_LIST_EXPORT', tabId: tab.id, filters }).catch((err) => ({ ok: false, error: String(err) }));
  if (!res || !res.ok) {
    setStatusText(statusDiv, `❌ ${(res && res.error) || 'Không đọc được data.'}`, 'red');
    return;
  }
  const items = res.creators.filter((c) => c.handle && c.tcmCreatorOecuid).map((c) => ({ cid: c.tcmCreatorOecuid, handle: c.handle }));
  if (items.length === 0) {
    setStatusText(statusDiv, `⚠️ Bắt được ${res.creators.length} creator nhưng không creator nào có tcmCreatorOecuid để mở trang chi tiết.`, 'red');
    return;
  }
  let shopId = '', shopRegion = 'US';
  try {
    const u = new URL(tab.url);
    shopId = u.searchParams.get('shop_id') || '';
    shopRegion = u.searchParams.get('shop_region') || 'US';
  } catch (e) {}
  if (!shopId) {
    setStatusText(statusDiv, '⚠️ Không đọc được shop_id từ tab hiện tại — mở lại trang Find Creators trên affiliate-us.tiktok.com rồi thử lại.', 'red');
    return;
  }

  const maxCount = Number(document.getElementById('csvAutoDetailMax').value) || 0;
  const autoContinue = document.getElementById('csvAutoDetailContinueCheckbox').checked;
  const cooldownMs = (Number(document.getElementById('csvAutoDetailCooldownMin').value) || 1) * 60000;
  await chrome.runtime.sendMessage({ type: 'START_CSV_DETAIL_QUEUE', items, shopId, shopRegion, maxCount, autoContinue, cooldownMs });
  startCsvAutoDetailPolling();
});

let csvAutoDetailPollTimer = null;
function startCsvAutoDetailPolling() {
  if (csvAutoDetailPollTimer) return;
  const tick = async () => {
    const state = await chrome.runtime.sendMessage({ type: 'GET_CSV_DETAIL_QUEUE_STATUS' });
    renderCsvAutoDetailStatus(state);
    if (state && state.status === 'done') refreshCsvBufferStatus();
    const waitingForAutoContinue = state && state.status === 'done' && state.autoContinue && state.pending && state.pending.length > 0;
    if (!state || (state.status !== 'running' && !waitingForAutoContinue)) {
      clearInterval(csvAutoDetailPollTimer);
      csvAutoDetailPollTimer = null;
    }
  };
  tick();
  csvAutoDetailPollTimer = setInterval(tick, 2000);
}

function renderCsvAutoDetailStatus(state) {
  const div = document.getElementById('csvAutoDetailQueueStatus');
  const stopBtn = document.getElementById('stopCsvAutoDetailBtn');
  const continueBtn = document.getElementById('continueCsvAutoDetailBtn');
  if (!state || !state.queue || state.queue.length === 0) {
    stopBtn.style.display = 'none';
    continueBtn.style.display = 'none';
    return;
  }
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
      setStatusText(div, `${state.status === 'stopped' ? '⏹' : '✅'} ${label}: ${done}/${total} xong (${failed} lỗi). Xem mục 📦 CSV buffer bên dưới để xuất file.`, color);
    }
  }
}

document.getElementById('stopCsvAutoDetailBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'STOP_CSV_DETAIL_QUEUE' });
});

document.getElementById('continueCsvAutoDetailBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CONTINUE_CSV_DETAIL_QUEUE' });
  startCsvAutoDetailPolling();
});

document.addEventListener('DOMContentLoaded', async () => {
  const state = await chrome.runtime.sendMessage({ type: 'GET_CSV_DETAIL_QUEUE_STATUS' }).catch(() => null);
  if (state && state.queue && state.queue.length > 0) {
    renderCsvAutoDetailStatus(state);
    if (state.status === 'running' || (state.status === 'done' && state.autoContinue && state.pending && state.pending.length > 0)) {
      startCsvAutoDetailPolling();
    }
  }
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

// Không đẩy webapp — chỉ gộp vào CSV buffer offline (xem "📦 CSV buffer" cuối popup).
document.getElementById('detailExportBtn').addEventListener('click', async () => {
  const detailStatusDiv = document.getElementById('detailStatus');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(detailStatusDiv, '⏳ Đang đọc data đã bắt được...', 'orange');
  await chrome.runtime.sendMessage({ type: 'RUN_DETAIL_EXPORT_JOB', mode: 'read', tabId: tab.id });
  startJobsPolling();
  setTimeout(refreshCsvBufferStatus, 1500);
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

// Không đẩy webapp — chỉ gộp vào CSV buffer offline.
document.getElementById('autoScanExportBtn').addEventListener('click', async () => {
  const autoScanStatusDiv = document.getElementById('autoScanStatus');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(autoScanStatusDiv, '⏳ Đang tự động click qua các tab (~10s)...', 'orange');
  await chrome.runtime.sendMessage({ type: 'RUN_DETAIL_EXPORT_JOB', mode: 'scan', tabId: tab.id });
  startJobsPolling();
  setTimeout(refreshCsvBufferStatus, 1500);
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

// Không đẩy webapp — chỉ gộp vào CSV buffer offline.
document.getElementById('engagementExportBtn').addEventListener('click', async () => {
  const engagementStatusDiv = document.getElementById('engagementStatus');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  setStatusText(engagementStatusDiv, '⏳ Đang đọc trang...', 'orange');
  await chrome.runtime.sendMessage({ type: 'RUN_ENGAGEMENT_EXPORT_JOB', tabId: tab.id });
  startJobsPolling();
  setTimeout(refreshCsvBufferStatus, 1500);
});

// ================== CSV BUFFER OFFLINE (chi tiết/engagement đã lưu tạm, không ở webapp) ==================
// Gộp theo handle trong background.js — chạy detail rồi engagement cho cùng creator gộp chung 1
// dòng. Dùng lại đúng MAIN_SHEET_COLUMNS ở trên (khớp MAIN_COLUMNS/ExportView.tsx) — buffer chỉ
// khác chỗ data đến từ trang chi tiết/engagement nên các cột email/beauty %/female %/age
// group/video link/persona thường có giá trị thật (list-level thường để trống các cột này).
async function refreshCsvBufferStatus() {
  const res = await chrome.runtime.sendMessage({ type: 'GET_CSV_BUFFER' }).catch(() => null);
  const div = document.getElementById('csvBufferStatus');
  const creators = (res && res.creators) || [];
  div.textContent = creators.length === 0
    ? 'Buffer trống.'
    : `📦 Đang giữ ${creators.length} creator trong buffer (chưa đẩy webapp).`;
  return creators;
}

document.getElementById('exportBufferCsvBtn').addEventListener('click', async () => {
  const creators = await refreshCsvBufferStatus();
  if (creators.length === 0) return;
  downloadCreatorsCsv(creators, `tcm-creators-detail-${new Date().toISOString().slice(0, 10)}.csv`);
});

document.getElementById('clearBufferCsvBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CLEAR_CSV_BUFFER' });
  await refreshCsvBufferStatus();
});

document.addEventListener('DOMContentLoaded', refreshCsvBufferStatus);

// ================== TÌM CID RỒI LẤY CHI TIẾT CSV CHO CREATOR CHỈ CÓ HANDLE (Kalodata/import) ==================
// Creator chưa từng xuất hiện trong list TCM đã bắt (Kalodata/nhập tay) không có cid nên không
// mở thẳng được trang chi tiết — background.js (processOneCsvSearchQueueItem) tự gõ handle vào ô
// search thật của TCM để tìm cid trước, rồi tự mở trang chi tiết của đúng cid đó, gộp vào cùng
// CSV buffer như các mục trên. Cần shopId/shopRegion đã ghi nhớ từ lần chạy "Đọc data đã bắt
// được" gần nhất trên tab TCM thật (runListImportJob ở background.js đã lưu sẵn).
function parseHandlesInput(text) {
  return [...new Set(
    text
      .split(/[\n,\s]+/)
      .map((h) => h.trim().replace(/^@/, ''))
      .filter(Boolean)
  )].map((handle) => ({ handle }));
}

// Đọc thẳng cột "Handle" từ file .xlsx Kalodata tải về (readXlsxColumnByHeader — xlsxLite.js) —
// tự điền vào textarea thay vì phải copy/dán tay. Vẫn để ở dạng text chứ không tự chạy luôn, để
// user xem/sửa lại danh sách trước khi bấm "Tìm & lấy chi tiết CSV".
document.getElementById('kalodataXlsxFile').addEventListener('change', async (e) => {
  const statusDiv = document.getElementById('kalodataQueueStatus');
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  setStatusText(statusDiv, '⏳ Đang đọc file .xlsx...', 'orange');
  try {
    const buffer = await file.arrayBuffer();
    const rawHandles = await readXlsxColumnByHeader(buffer, ['handle', 'tiktok handle', 'tiktokhandle', 'username']);
    const cleaned = [...new Set(rawHandles.map((h) => h.trim().replace(/^@/, '')).filter(Boolean))];
    if (cleaned.length === 0) {
      setStatusText(statusDiv, '⚠️ Không đọc được handle nào từ cột "Handle" trong file.', 'red');
      return;
    }
    document.getElementById('kalodataHandles').value = cleaned.join('\n');
    setStatusText(statusDiv, `✅ Đã đọc ${cleaned.length} handle từ file — bấm "🔍 Tìm & lấy chi tiết CSV" bên dưới để bắt đầu.`, 'green');
  } catch (err) {
    setStatusText(statusDiv, `❌ ${String((err && err.message) || err)}`, 'red');
  } finally {
    e.target.value = '';
  }
});

// Cho phép gõ tay Shop ID/Shop Region thay vì bắt buộc phải mở tab TCM thật trước — lưu vào
// đúng key 'lastShopId'/'lastShopRegion' mà runListImportJob (background.js) cũng dùng, nên hai
// đường lấy Shop ID (tự động qua tab TCM, hoặc gõ tay ở đây) tương đương nhau.
(async () => {
  const stored = await chrome.storage.local.get(['lastShopId', 'lastShopRegion']);
  if (stored.lastShopId) document.getElementById('manualShopId').value = stored.lastShopId;
  if (stored.lastShopRegion) document.getElementById('manualShopRegion').value = stored.lastShopRegion;
})();

document.getElementById('saveManualShopIdBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('manualShopIdStatus');
  const shopId = document.getElementById('manualShopId').value.trim();
  const shopRegion = document.getElementById('manualShopRegion').value.trim() || 'US';
  if (!shopId) {
    setStatusText(statusDiv, '⚠️ Chưa nhập Shop ID.', 'red');
    return;
  }
  await chrome.storage.local.set({ lastShopId: shopId, lastShopRegion: shopRegion });
  setStatusText(statusDiv, `✅ Đã lưu Shop ID ${shopId} (region ${shopRegion}).`, 'green');
});

document.getElementById('startKalodataCsvBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('kalodataQueueStatus');
  const items = parseHandlesInput(document.getElementById('kalodataHandles').value);
  if (items.length === 0) {
    setStatusText(statusDiv, '⚠️ Chưa nhập handle nào.', 'red');
    return;
  }
  const stored = await chrome.storage.local.get(['lastShopId', 'lastShopRegion']);
  if (!stored.lastShopId) {
    setStatusText(statusDiv, '⚠️ Chưa có Shop ID — gõ tay vào ô "🔑 Shop ID" ở trên rồi bấm 💾 Lưu, hoặc bấm "🔍 Đọc data đã bắt được" ít nhất 1 lần từ tab TCM thật (extension tự ghi nhớ Shop ID từ đó) rồi thử lại.', 'red');
    return;
  }
  const maxCount = Number(document.getElementById('kalodataMax').value) || 0;
  setStatusText(statusDiv, `⏳ Đang bắt đầu tìm ${items.length} handle...`, 'orange');
  await chrome.runtime.sendMessage({
    type: 'START_CSV_SEARCH_CID_QUEUE',
    items,
    shopId: stored.lastShopId,
    shopRegion: stored.lastShopRegion || 'US',
    maxCount,
  });
  startKalodataCsvPolling();
});

let kalodataCsvPollTimer = null;
function startKalodataCsvPolling() {
  if (kalodataCsvPollTimer) return;
  const tick = async () => {
    const state = await chrome.runtime.sendMessage({ type: 'GET_CSV_SEARCH_CID_QUEUE_STATUS' });
    renderKalodataCsvStatus(state);
    if (state && state.status === 'done') refreshCsvBufferStatus();
    if (!state || state.status !== 'running') {
      clearInterval(kalodataCsvPollTimer);
      kalodataCsvPollTimer = null;
    }
  };
  tick();
  kalodataCsvPollTimer = setInterval(tick, 2000);
}

function renderKalodataCsvStatus(state) {
  const div = document.getElementById('kalodataQueueStatus');
  const stopBtn = document.getElementById('stopKalodataCsvBtn');
  const continueBtn = document.getElementById('continueKalodataCsvBtn');
  if (!state || !state.queue || state.queue.length === 0) {
    stopBtn.style.display = 'none';
    continueBtn.style.display = 'none';
    return;
  }
  const total = state.totalCount || state.queue.length;
  const done = state.processedCount || 0;
  const failed = state.failedCount || 0;
  const pending = (state.pending && state.pending.length) || 0;
  if (state.status === 'running') {
    stopBtn.style.display = 'block';
    continueBtn.style.display = 'none';
    setStatusText(div, `🔍 Đang tìm/lấy chi tiết: ${done}/${total} xong (${failed} lỗi)${state.currentHandle ? ` — đang tìm @${state.currentHandle}` : ''}...`, 'orange');
  } else {
    stopBtn.style.display = 'none';
    const color = state.autoStopReason ? 'red' : failed > 0 ? 'orange' : 'green';
    const label = state.status === 'stopped' ? 'Đã dừng' : 'Hoàn tất';
    const autoStopPrefix = state.autoStopReason ? `⚠️ ${state.autoStopReason} ` : '';
    if (pending > 0) {
      continueBtn.style.display = 'block';
      setStatusText(div, `${autoStopPrefix}${label} đợt này: ${done}/${total} xong (${failed} lỗi). Còn ${pending} handle chưa xử lý — bấm "Lấy tiếp" khi sẵn sàng.`, color);
    } else {
      continueBtn.style.display = 'none';
      setStatusText(div, `${autoStopPrefix}${state.status === 'stopped' ? '⏹' : '✅'} ${label}: ${done}/${total} xong (${failed} lỗi). Xem mục 📦 CSV buffer bên trên để xuất file.`, color);
    }
  }
}

document.getElementById('stopKalodataCsvBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'STOP_CSV_SEARCH_CID_QUEUE' });
});

document.getElementById('continueKalodataCsvBtn').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: 'CONTINUE_CSV_SEARCH_CID_QUEUE' });
  startKalodataCsvPolling();
});

document.addEventListener('DOMContentLoaded', async () => {
  const state = await chrome.runtime.sendMessage({ type: 'GET_CSV_SEARCH_CID_QUEUE_STATUS' }).catch(() => null);
  if (state && state.queue && state.queue.length > 0) {
    renderKalodataCsvStatus(state);
    if (state.status === 'running') startKalodataCsvPolling();
  }
});
