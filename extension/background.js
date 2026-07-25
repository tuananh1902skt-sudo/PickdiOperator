// Service worker nền — sống độc lập với popup (popup bị Chrome tự đóng khi mất
// focus, nên mọi việc mở tab/gọi API/chờ lâu phải chạy ở đây, không chạy trong popup.js).

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function appendLog(line) {
  const { findCreatorsLog = [] } = await chrome.storage.local.get(['findCreatorsLog']);
  const next = [...findCreatorsLog, line];
  await chrome.storage.local.set({ findCreatorsLog: next });
  return next;
}

async function setLastLog(line) {
  const { findCreatorsLog = [] } = await chrome.storage.local.get(['findCreatorsLog']);
  const next = [...findCreatorsLog];
  next[next.length - 1] = line;
  await chrome.storage.local.set({ findCreatorsLog: next });
}

function waitForTabComplete(tabId) {
  return new Promise((resolve) => {
    function listener(id, info) {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// Chạy BÊN TRONG trang ads.tiktok.com (world MAIN) — không được closure biến ngoài,
// chỉ nhận qua args như executeScript yêu cầu (kể cả helper filter phải viết lồng bên trong).
// Tự lặp qua nhiều "trang" giống hệt việc cuộn chuột trên UI (infinite scroll = tăng page,
// giữ nguyên filter) cho tới khi đủ targetCount creator khớp filter hoặc hết dữ liệu.
async function fetchCreatorSquareInPage(filters, targetCount) {
  function matchesFilters(c) {
    const followers = c.statisticData && c.statisticData.overallPerformance
      ? c.statisticData.overallPerformance.followerCount : 0;
    if (filters.follower_min && followers < filters.follower_min) return false;
    if (filters.follower_max && followers > filters.follower_max) return false;

    const rateRaw = c.esData && c.esData.price ? Number(c.esData.price.startingRate100k || 0) : 0;
    const rateUsd = rateRaw ? rateRaw / 1000 : null;
    if (filters.budget_min && rateUsd != null && rateUsd < filters.budget_min) return false;
    if (filters.budget_max && rateUsd != null && rateUsd > filters.budget_max) return false;

    return true;
  }

  const matched = [];
  const seenIds = new Set();
  const MAX_PAGES = 50; // chặn an toàn — tối đa 50*24=1200 creator quét qua dù chưa đủ targetCount
  let page = 1;

  try {
    while (matched.length < targetCount && page <= MAX_PAGES) {
      const body = {
        page,
        limit: 24,
        query: filters.query_keyword || '',
        filterParam: {
          contentLabels: [], industryLabels: [], creatorPriceFilter: { currency: 'USD' },
          languages: [], audienceMaxDistriCountry: '', audienceMaxDistriAge: '',
          storeCountryCodeList: [], subRegions: [], audienceMaxDistrPersonaList: [],
          creatorValueList: [], recommendationTypeList: [],
        },
        sortParam: { sortType: 2, sortField: 1 },
        dataVDCRegion: 3,
        searchType: 6,
      };
      const res = await fetch('/CreativeOne/MatchMaking/QueryCreatorSquare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        if (matched.length > 0) break; // đã có ít nhiều kết quả -> trả về thay vì báo lỗi trắng tay
        return { error: 'HTTP ' + res.status + ' — có thể chưa đăng nhập TikTok One' };
      }
      // QUAN TRỌNG: aioCreatorID/ttUID là số nguyên 19 chữ số, vượt Number.MAX_SAFE_INTEGER
      // (~16 chữ số) — TikTok trả về KHÔNG có dấu ngoặc kép (JSON number thật, không phải string),
      // nên res.json()/JSON.parse thường sẽ tự làm tròn mất vài chữ số cuối. Phải bọc 2 field này
      // thành string TRƯỚC khi parse để giữ nguyên chính xác.
      const rawText = await res.text();
      const safeText = rawText.replace(/"(aioCreatorID|ttUID)":(\d+)/g, '"$1":"$2"');
      const data = JSON.parse(safeText);
      const batch = data.creators || [];
      if (batch.length === 0) break; // hết trang, không còn creator nào nữa

      for (const c of batch) {
        const id = c.aioCreatorID || c.ttUID;
        if (id && seenIds.has(id)) continue; // phòng trường hợp trang sau lặp lại creator cũ
        if (id) seenIds.add(id);
        if (matchesFilters(c)) matched.push(c);
      }

      page++;
      if (matched.length < targetCount && page <= MAX_PAGES) {
        await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 600));
      }
    }

    return { creators: matched.slice(0, targetCount) };
  } catch (err) {
    return { error: err.message, creators: matched };
  }
}

const DEFAULT_TARGET_COUNT = 100;

async function scrapeTikTokOneForFilters(filters, targetCount = DEFAULT_TARGET_COUNT) {
  const tab = await chrome.tabs.create({ url: 'https://ads.tiktok.com/creative/creator/explore?region=us_ttp', active: false });
  try {
    await waitForTabComplete(tab.id);
    await sleep(1500); // đợi SPA tự render/gọi API lần đầu xong trước khi mình gọi thêm

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: fetchCreatorSquareInPage,
      args: [filters, targetCount],
    });
    const result = results && results[0] && results[0].result;
    if (!result) throw new Error('Không đọc được kết quả từ trang TikTok One');
    // Có lỗi giữa chừng (vd 1 trang bị lỗi) nhưng vẫn còn creator đã gom được -> dùng tạm,
    // chỉ throw hẳn khi không lấy được gì cả.
    if (result.error && (!result.creators || result.creators.length === 0)) throw new Error(result.error);
    return result.creators || [];
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

// Chuẩn hoá 1 creator thô từ QueryCreatorSquare thành shape chuẩn của Pickdi Creator.
// Field nào TikTok không trả thì để undefined — KHÔNG tự bịa số/placeholder.
function normalizeCreator(c) {
  const stats = c.statisticData && c.statisticData.overallPerformance;
  const followers = stats && stats.followerCount !== undefined ? Number(stats.followerCount) : undefined;
  const avgViews = stats && stats.avgVideoViews !== undefined ? Number(stats.avgVideoViews) : undefined;
  const engagementRate = stats && stats.engagementRate !== undefined ? Number(stats.engagementRate) : undefined;

  const rateRaw = c.esData && c.esData.price ? Number(c.esData.price.startingRate100k || 0) : 0;
  const rateCard = rateRaw ? String(rateRaw / 1000) : undefined;

  const tiktokOneId = c.aioCreatorID || c.ttUID || undefined;
  const handle = c.uniqueId || c.unique_id || c.handle || undefined;
  const displayName = c.nickname || c.nickName || handle || undefined;
  const avatar = c.avatarUrl || c.avatar_url || c.avatar || undefined;
  const category = c.categoryName || c.category_name || undefined;

  return {
    handle,
    displayName,
    avatar,
    tiktokOneId,
    followers,
    avgViews,
    engagementRate,
    category,
    rateCard,
  };
}

async function runFindCreators(webappUrl, filters) {
  await chrome.storage.local.set({ findCreatorsLog: [], findCreatorsRunning: true });
  await appendLog(`🔄 Đang cào TikTok One (follower ${filters.follower_min || 0}-${filters.follower_max || '∞'})...`);

  try {
    const rawCreators = await scrapeTikTokOneForFilters(filters);
    if (rawCreators.length === 0) {
      await setLastLog('⚠️ Không có creator nào khớp filter.');
      await chrome.storage.local.set({ findCreatorsRunning: false });
      return;
    }

    const normalized = rawCreators.map(normalizeCreator).filter((c) => c.handle);
    await setLastLog(`🔄 Cào được ${normalized.length}, đang đẩy về webapp...`);

    const res = await fetch(`${webappUrl}/api/creators/batch-import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'TikTok One Extension', creators: normalized }),
    });
    const data = await res.json();
    await setLastLog(data.success
      ? `✅ +${data.importedCount} creator mới (${data.updatedCount} cập nhật)`
      : `❌ ${data.message || 'Import thất bại'}`);
  } catch (err) {
    await setLastLog(`❌ ${err.message}`);
  }

  await appendLog('🎉 Hoàn tất.');
  await chrome.storage.local.set({ findCreatorsRunning: false });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'FIND_CREATORS') {
    runFindCreators(message.webappUrl, message.filters || {});
  }
});
