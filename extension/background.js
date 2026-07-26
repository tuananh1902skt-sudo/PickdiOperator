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
// Chỉ fetch ĐÚNG 1 trang mỗi lần gọi — vòng lặp phân trang nằm ở background.js (ngoài trang
// web) để có thể ghi log tiến độ giữa các trang; hàm chạy trong world MAIN không gọi được
// chrome.storage nên không thể tự báo tiến độ từ bên trong.
async function fetchCreatorSquarePage(filters, page) {
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
  try {
    const res = await fetch('/CreativeOne/MatchMaking/QueryCreatorSquare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!res.ok) return { error: 'HTTP ' + res.status + ' — có thể chưa đăng nhập TikTok One' };
    // QUAN TRỌNG: aioCreatorID/ttUID là số nguyên 19 chữ số, vượt Number.MAX_SAFE_INTEGER
    // (~16 chữ số) — TikTok trả về KHÔNG có dấu ngoặc kép (JSON number thật, không phải string),
    // nên res.json()/JSON.parse thường sẽ tự làm tròn mất vài chữ số cuối. Phải bọc 2 field này
    // thành string TRƯỚC khi parse để giữ nguyên chính xác.
    const rawText = await res.text();
    const safeText = rawText.replace(/"(aioCreatorID|ttUID)":(\d+)/g, '"$1":"$2"');
    const data = JSON.parse(safeText);
    return { creators: data.creators || [] };
  } catch (err) {
    return { error: err.message };
  }
}

function matchesFilters(filters, c) {
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

// Tự lặp qua nhiều "trang" giống hệt việc cuộn chuột trên UI (infinite scroll = tăng page,
// giữ nguyên filter) cho tới khi đủ targetCount creator khớp filter hoặc hết dữ liệu.
// Ghi log tiến độ sau mỗi trang để popup không trông như bị treo.
async function fetchCreatorSquareAllPages(tabId, filters, targetCount) {
  const matched = [];
  const seenIds = new Set();
  const MAX_PAGES = 50; // chặn an toàn — tối đa 50*24=1200 creator quét qua dù chưa đủ targetCount
  let page = 1;

  while (matched.length < targetCount && page <= MAX_PAGES) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: fetchCreatorSquarePage,
      args: [filters, page],
    });
    const result = results && results[0] && results[0].result;
    if (!result) return { error: 'Không đọc được kết quả từ trang TikTok One', creators: matched };
    if (result.error) {
      if (matched.length > 0) break; // đã có ít nhiều kết quả -> trả về thay vì báo lỗi trắng tay
      return { error: result.error, creators: matched };
    }

    const batch = result.creators || [];
    if (batch.length === 0) break; // hết trang, không còn creator nào nữa

    for (const c of batch) {
      const id = c.aioCreatorID || c.ttUID;
      if (id && seenIds.has(id)) continue; // phòng trường hợp trang sau lặp lại creator cũ
      if (id) seenIds.add(id);
      if (matchesFilters(filters, c)) matched.push(c);
    }

    await setLastLog(`🔄 Đang cào TikTok One... trang ${page}, khớp ${matched.length}/${targetCount}`);

    page++;
    if (matched.length < targetCount && page <= MAX_PAGES) {
      await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 600));
    }
  }

  return { creators: matched.slice(0, targetCount) };
}

const DEFAULT_TARGET_COUNT = 100;

async function scrapeTikTokOneForFilters(filters, targetCount = DEFAULT_TARGET_COUNT) {
  const tab = await chrome.tabs.create({ url: 'https://ads.tiktok.com/creative/creator/explore?region=us_ttp', active: false });
  try {
    await waitForTabComplete(tab.id);
    await sleep(1500); // đợi SPA tự render/gọi API lần đầu xong trước khi mình gọi thêm

    const result = await fetchCreatorSquareAllPages(tab.id, filters, targetCount);
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
  // TikTok trả engagementRate dạng fraction 0-1 (giống stat.engagementRate ở extractCreatorDetailFromNetwork
  // bên dưới, nơi nó được nhân 100 qua pct()) — nhân sẵn ở đây để engagementRate luôn là số percent (vd 4.52),
  // tránh lệch đơn vị với field cùng tên được ghi từ update-detail/update-engagement.
  const engagementRate = stats && stats.engagementRate !== undefined ? Number(stats.engagementRate) * 100 : undefined;

  const rateRaw = c.esData && c.esData.price ? Number(c.esData.price.startingRate100k || 0) : 0;
  const rateCard = rateRaw ? String(rateRaw / 1000) : undefined;

  // Handle/tên/avatar/bio thật nằm trong creatorTTInfo, không phải top-level (đối chiếu từ
  // sample response thật của QueryCreatorSquare, không phải đoán theo tên field chuẩn REST).
  const ttInfo = c.creatorTTInfo || {};
  const tiktokOneId = c.aioCreatorID || c.ttUID || undefined;
  const handle = ttInfo.handleName || ttInfo.uniqueId || ttInfo.unique_id || c.handle || undefined;
  const displayName = ttInfo.nickName || ttInfo.nickname || handle || undefined;
  const avatar = ttInfo.avatarURL || ttInfo.avatarUrl || undefined;
  const bio = ttInfo.bio || undefined;
  const emailMatch = bio && bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : undefined;
  const category = c.categoryName || c.category_name || undefined;

  return {
    handle,
    displayName,
    avatar,
    bio,
    email,
    tiktokOneId,
    followers,
    avgViews,
    engagementRate,
    category,
    rateCard,
  };
}

// Cuộn trang xuống dần để kích hoạt các widget lazy-load (Content performance,
// Videos, Collaborations, Audience demographics đều nằm trên cùng 1 trang dài,
// chỉ gọi API riêng khi cuộn tới, không tự gọi hết ngay khi load) — giống hệt
// việc user tự tay cuộn qua từng phần trước khi bấm "Lấy chi tiết trang này".
// Trả về Promise nên chrome.scripting.executeScript sẽ tự đợi cho tới khi resolve.
async function autoScrollAndWait() {
  return new Promise((resolve) => {
    let total = 0;
    let pass = 0;
    const step = 700;
    const timer = setInterval(() => {
      window.scrollBy(0, step);
      total += step;
      if (total >= document.body.scrollHeight + 3000 || total > 40000) {
        pass++;
        if (pass < 2) {
          // Cuộn lại từ đầu 1 lần nữa — một số widget (vd Collaborations) chỉ gọi API
          // khi thật sự cuộn TỚI (không phải khi đã ở cuối trang ngay từ vòng đầu).
          total = 0;
          window.scrollTo(0, 0);
          return;
        }
        clearInterval(timer);
        setTimeout(() => resolve(true), 2500); // đợi thêm cho các request cuối cùng trả về
      }
    }, 700);
  });
}

// Đọc data đã bắt được từ interceptor.js cho ĐÚNG creator đang mở (id lấy từ URL của
// chính tab này) — giống hệt logic trong popup.js's scrapeTikTokOneDetailFromNetwork,
// nhưng chạy tại đây vì background.js tự mở/đóng tab, không qua click của user.
function extractCreatorDetailFromNetwork() {
  const idMatch = location.pathname.match(/creator\/profile\/(\d+)/);
  if (!idMatch) return { error: 'URL không phải trang profile chi tiết.' };
  const tiktokOneId = idMatch[1];

  const store = window.__pickdi_creator_cards || {};
  const c = store[tiktokOneId];
  if (!c) return { error: 'Không bắt được data mạng cho creator này.' };

  const tt = c.creatorTTInfo || {};
  const handle = tt.handleName ? '@' + tt.handleName : null;
  if (!handle) return { error: 'Không đọc được handle từ data đã bắt.' };

  const vs = c.creatorValueStat || {};
  const stat = (c.statisticData && c.statisticData.overallPerformance) || {};
  const coop = c.creatorCooperationInfo || {};
  const followerDist = (c.statisticData && c.statisticData.followerDistriData) || {};
  const audienceReached = (c.statisticData && c.statisticData.audienceReachedDemographics) || {};
  const audienceEngaged = (c.statisticData && c.statisticData.audienceEngagedDemographics) || {};
  const followerHistory = (c.statisticData && c.statisticData.followerCountHistory && c.statisticData.followerCountHistory.followerCount) || [];
  const videoPerf = (c.statisticData && c.statisticData.videoPerformance) || {};

  function topByRatio(arr, labelKey) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    const top = arr.reduce((a, b) => (b.ratio > (a ? a.ratio : -1) ? b : a), null);
    return top ? top[labelKey] : null;
  }
  function pct(n) {
    return n != null ? (n * 100).toFixed(2) + '%' : null;
  }
  function summarizeVideo(v) {
    // TikTok One không trả link video/thumbnail trực tiếp trong videoPerformance, nhưng
    // itemID + handle là đủ để dựng đúng URL video thật theo format chuẩn của TikTok
    // (https://www.tiktok.com/@handle/video/itemID) — không cần đoán field ảnh bìa không có thật.
    const videoUrl = v.itemID ? `https://www.tiktok.com/${handle}/video/${v.itemID}` : null;
    return {
      itemID: v.itemID, title: v.title, views: Number(v.views) || 0,
      likes: v.heart || 0, comments: v.comment || 0, shares: v.share || 0,
      createTime: v.createTime, isSponsoredVideo: !!v.isSponsoredVideo,
      videoUrl,
    };
  }

  return {
    handle,
    tiktokOneId,
    detail: {
      videoContentTag: (c.potentialIndustryLabels || []).map((l) => l.labelName).join(', ') || null,
      industryTag: null,
      languagesSpoken: (c.creatorProfile && c.creatorProfile.spokenLanguageList || []).join(', ') || null,
      followerGrowthRate: pct(stat.followersGrowthRate),
      postingFrequencyPer30Days: coop.contentPostFreq30d != null ? Number(coop.contentPostFreq30d) : null,
      collabScore: vs.comprehensiveScore != null ? vs.comprehensiveScore : null,
      collabBroadcasting: vs.broadcastingScore != null ? vs.broadcastingScore : null,
      collabDiligence: vs.collaborationScore != null ? vs.collaborationScore : null,
      collabCommercial: vs.commercialScore != null ? vs.commercialScore : null,
      medianViews: stat.medianViews != null ? String(stat.medianViews) : null,
      medianViewsBenchmark: stat.medianBenchMarkViews != null ? String(stat.medianBenchMarkViews) : null,
      sixSecondViewRate: pct(stat.avgSixSecondsViewsRate),
      sixSecondViewRateBenchmark: pct(stat.avgSixSecondsViewsBenchMarkViews),
      engagementRateContent: pct(stat.engagementRate),
      engagementRateBenchmark: pct(stat.engagementRateBenchMark),
      brandedVideosCount: coop.bcVideoCnt90d != null ? Number(coop.bcVideoCnt90d) : null,
      industryCoveredCount: coop.collabIndustryCnt90d != null ? Number(coop.collabIndustryCnt90d) : null,
      audienceTopGender: topByRatio(followerDist.gender, 'gender'),
      audienceTopAgeRange: topByRatio(followerDist.age, 'ageInterval'),
      audienceTopCountry: topByRatio(followerDist.region, 'country'),
      audienceDemographics: { reached: audienceReached, engaged: audienceEngaged, follower: followerDist },
      followerHistory: followerHistory.slice(-30),
      topVideos: (videoPerf.popularVideos || []).slice(0, 10).map(summarizeVideo),
      recentVideos: (videoPerf.recentVideos || []).slice(0, 10).map(summarizeVideo),
      brandInfoList: (c.brandInfoList || []).map((b) => b.brandName),
    },
  };
}

// Mở tab ẩn tới đúng trang profile của 1 creator, cuộn để kích hoạt lazy-load, đọc data
// mạng đã bắt được rồi đóng tab lại. Chạy TUẦN TỰ (không song song nhiều tab) để giống
// hành vi người dùng thật, tránh bị TikTok One nghi ngờ bot khi quét hàng loạt profile.
async function fetchOneCreatorFullDetail(tiktokOneId) {
  const url = `https://ads.tiktok.com/creative/creator/profile/${tiktokOneId}?creatorType=1&region=us_ttp`;
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForTabComplete(tab.id);
    await sleep(1200);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: autoScrollAndWait });
    const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: 'MAIN', func: extractCreatorDetailFromNetwork });
    return results && results[0] && results[0].result;
  } finally {
    chrome.tabs.remove(tab.id).catch(() => {});
  }
}

async function fetchAllCreatorFullDetails(webappUrl, normalizedCreators) {
  const withId = normalizedCreators.filter((c) => c.tiktokOneId);
  let ok = 0;
  let fail = 0;
  await appendLog(`🔄 Đang lấy chi tiết đầy đủ 0/${withId.length} creator...`);

  for (let i = 0; i < withId.length; i++) {
    const c = withId[i];
    try {
      const result = await fetchOneCreatorFullDetail(c.tiktokOneId);
      if (result && result.detail) {
        const res = await fetch(`${webappUrl}/api/creators/update-detail`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ handle: result.handle, tiktokOneId: result.tiktokOneId, detail: result.detail }),
        });
        const data = await res.json();
        if (data.status === 'ok') ok++; else fail++;
      } else {
        fail++;
      }
    } catch (err) {
      fail++;
    }
    await setLastLog(`🔄 Đang lấy chi tiết đầy đủ ${i + 1}/${withId.length} creator... (✅ ${ok} / ❌ ${fail})`);
    await sleep(900 + Math.random() * 900); // jitter giữa các profile — tránh trông như bot
  }

  await appendLog(`🎉 Đã lấy chi tiết đầy đủ: ✅ ${ok} / ❌ ${fail}.`);
}

async function runFindCreators(webappUrl, filters, fetchFullDetail) {
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
    if (normalized.length === 0) {
      // Không map được field handle nào -> in thử sample thô ra log để đối chiếu tên field thật
      // của TikTok One (thay vì đoán mù), giúp sửa normalizeCreator() cho đúng.
      await setLastLog(`⚠️ Cào được ${rawCreators.length} creator thô nhưng không nhận diện được field handle. Sample field names: ${Object.keys(rawCreators[0] || {}).join(', ')}`);
      await appendLog(`Sample raw creator: ${JSON.stringify(rawCreators[0]).slice(0, 1500)}`);
      await chrome.storage.local.set({ findCreatorsRunning: false });
      return;
    }
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

    if (data.success && fetchFullDetail) {
      await fetchAllCreatorFullDetails(webappUrl, normalized);
    }
  } catch (err) {
    await setLastLog(`❌ ${err.message}`);
  }

  await appendLog('🎉 Hoàn tất.');
  await chrome.storage.local.set({ findCreatorsRunning: false });
}

chrome.runtime.onMessage.addListener((message) => {
  if (message && message.type === 'FIND_CREATORS') {
    runFindCreators(message.webappUrl, message.filters || {}, !!message.fetchFullDetail);
  }
});
