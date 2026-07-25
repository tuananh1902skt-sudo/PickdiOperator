// Tự động lưu và load Webapp URL + filter đã nhập gần nhất
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(['webappUrl', 'lastFilters'], (res) => {
    document.getElementById('webappUrl').value = res.webappUrl || 'http://localhost:3000';
    const f = res.lastFilters || {};
    if (f.follower_min) document.getElementById('followerMin').value = f.follower_min;
    if (f.follower_max) document.getElementById('followerMax').value = f.follower_max;
    if (f.budget_min) document.getElementById('budgetMin').value = f.budget_min;
    if (f.budget_max) document.getElementById('budgetMax').value = f.budget_max;
    if (f.query_keyword) document.getElementById('keyword').value = f.query_keyword;
  });

  chrome.storage.local.get(['findCreatorsLog', 'findCreatorsRunning'], (res) => {
    renderFindStatus(res.findCreatorsLog, res.findCreatorsRunning);
  });
});

function getWebappUrl() {
  return (document.getElementById('webappUrl').value.trim() || 'http://localhost:3000').replace(/\/$/, '');
}

// ================== TÌM CREATOR TỰ ĐỘNG QUA TIKTOK ONE ==================
// Toàn bộ việc cào (mở tab, gọi API, đẩy về webapp) chạy trong background.js —
// KHÔNG chạy trong popup, vì popup.html bị Chrome tự đóng ngay khi mất focus
// (vd. khi mở tab mới), sẽ huỷ ngang chừng việc đang chạy dở mà không báo lỗi gì.
// Popup chỉ bắn message nhờ background chạy, rồi đọc log tiến độ từ chrome.storage
// (để dù popup có bị đóng/mở lại vẫn thấy đúng trạng thái mới nhất).

function renderFindStatus(log, running) {
  const statusDiv = document.getElementById('findStatus');
  const text = (log && log.length) ? log.join('<br>') : '';
  statusDiv.innerHTML = running ? (text + '<br>⏳ Đang chạy...') : text;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.findCreatorsLog || changes.findCreatorsRunning) {
    chrome.storage.local.get(['findCreatorsLog', 'findCreatorsRunning'], (res) => {
      renderFindStatus(res.findCreatorsLog, res.findCreatorsRunning);
    });
  }
});

document.getElementById('findCreatorsBtn').addEventListener('click', () => {
  const webappUrl = getWebappUrl();
  const filters = {
    follower_min: Number(document.getElementById('followerMin').value) || undefined,
    follower_max: Number(document.getElementById('followerMax').value) || undefined,
    budget_min: Number(document.getElementById('budgetMin').value) || undefined,
    budget_max: Number(document.getElementById('budgetMax').value) || undefined,
    query_keyword: document.getElementById('keyword').value.trim() || undefined,
  };
  chrome.storage.local.set({ webappUrl, lastFilters: filters });
  chrome.runtime.sendMessage({ type: 'FIND_CREATORS', webappUrl, filters });
});

// ================== LẤY CHI TIẾT TRANG PROFILE TIKTOK ONE ==================
// Nút này KHÔNG mở tab mới, chỉ đọc tab đang active hiện tại (user tự mở & xem
// 1 creator trên TikTok One trước) -> không dính bug popup tự đóng, chạy thẳng
// trong popup.js là an toàn.
//
// Đây là DOM-scrape (đọc text đã render), KHÔNG phải gọi API — vì API thật của trang
// này (MGetCreatorsCard) có chữ ký chống bot X-Bogus/X-Gnarly không tái tạo được.

// HÀM CHẠY BÊN TRONG TAB TIKTOK ONE ĐANG MỞ — không được closure biến ngoài.
function scrapeTikTokOneDetailPage() {
  const idMatch = location.pathname.match(/creator\/profile\/(\d+)/);
  if (!idMatch) return { error: 'Trang hiện tại không phải trang profile chi tiết TikTok One.' };
  const tiktokOneId = idMatch[1];

  const lines = document.body.innerText.split('\n');

  function valuesAfterLabel(label, count) {
    const idx = lines.findIndex((l) => l.trim() === label);
    if (idx === -1) return [];
    const out = [];
    for (let i = idx + 1; i < lines.length && out.length < count; i++) {
      const v = lines[i].trim();
      if (v && !/^Top\s+\d/i.test(v)) out.push(v); // bỏ qua dòng percentile "Top 5 %" chen giữa
    }
    return out;
  }
  function valueAfterLabel(label) {
    return valuesAfterLabel(label, 1)[0] || null;
  }
  function metricWithBenchmark(label) {
    const vals = valuesAfterLabel(label, 3);
    return { value: vals[0] || null, benchmark: vals[2] || null };
  }
  function concatLabelValue(label) {
    const re = new RegExp('^' + label.replace(/'/g, "\\'") + '(.+)$');
    const line = lines.find((l) => re.test(l.trim()) && l.trim() !== label);
    const m = line && line.trim().match(re);
    return m ? m[1] : null;
  }

  const medianViews = metricWithBenchmark('Median views');
  const sixSecondViews = metricWithBenchmark('6-second video views');
  const engagementRate = metricWithBenchmark('Engagement rate');
  const postingFreqLine = valueAfterLabel('Posting frequency');

  // Collaboration evaluation: "Overall score" đứng riêng (không có benchmark), còn
  // Broadcasting/Diligence/Commercial đứng dưới "Score breakdown" kèm 1 dòng % chen giữa
  // (vd "69.2" rồi "3%") -> lấy value đầu tiên sau mỗi label, bỏ qua dòng %.
  function scoreAfterLabel(label) {
    const idx = lines.findIndex((l) => l.trim() === label);
    if (idx === -1) return null;
    for (let i = idx + 1; i < lines.length; i++) {
      const v = lines[i].trim();
      if (!v) continue;
      if (/^-?\d+(\.\d+)?%?$/.test(v) && v !== '--') return parseFloat(v);
      if (v === '--') return null;
      break;
    }
    return null;
  }
  const collabScore = scoreAfterLabel('Overall score');
  const collabBroadcasting = scoreAfterLabel('Broadcasting');
  const collabDiligence = scoreAfterLabel('Diligence');
  const collabCommercial = scoreAfterLabel('Commercial');

  // Lấy handle từ link "View TikTok profile" (href dạng https://www.tiktok.com/@handle) —
  // dùng để MATCH creator trong webapp (đáng tin hơn tiktokOneId vì đọc trực tiếp, không qua
  // pipeline số có thể lệch).
  const profileLink = Array.from(document.querySelectorAll('a')).find((a) => /tiktok\.com\/@/.test(a.href));
  const handleMatch = profileLink && profileLink.href.match(/tiktok\.com\/(@[\w.]+)/);
  const handle = handleMatch ? handleMatch[1] : null;
  if (!handle) return { error: 'Không đọc được handle của creator trên trang này.' };

  const brandedVideosCount = Number(valueAfterLabel('Branded videos'));
  const industryCoveredCount = Number(valueAfterLabel('Industry covered'));

  return {
    handle,
    tiktokOneId,
    detail: {
      videoContentTag: valueAfterLabel('Video content tag'),
      industryTag: valueAfterLabel('Industry tag'),
      languagesSpoken: valueAfterLabel('Languages spoken'),
      followerGrowthRate: valueAfterLabel('Follower growth rate'),
      postingFrequencyPer30Days: postingFreqLine ? Number(postingFreqLine.replace(/[^\d.]/g, '')) || null : null,
      collabScore,
      collabBroadcasting,
      collabDiligence,
      collabCommercial,
      medianViews: medianViews.value,
      medianViewsBenchmark: medianViews.benchmark,
      sixSecondViewRate: sixSecondViews.value,
      sixSecondViewRateBenchmark: sixSecondViews.benchmark,
      engagementRateContent: engagementRate.value,
      engagementRateBenchmark: engagementRate.benchmark,
      brandedVideosCount: isNaN(brandedVideosCount) ? null : brandedVideosCount,
      industryCoveredCount: isNaN(industryCoveredCount) ? null : industryCoveredCount,
      responseRate: valueAfterLabel('Response rate'),
      audienceTopGender: concatLabelValue('Gender'),
      audienceTopAgeRange: concatLabelValue('Age'),
      audienceTopCountry: concatLabelValue('Top country or region'),
    },
  };
}

document.getElementById('pushDetailBtn').addEventListener('click', async () => {
  const detailStatusDiv = document.getElementById('detailStatus');
  const webappUrl = getWebappUrl();
  chrome.storage.local.set({ webappUrl });

  detailStatusDiv.innerHTML = '⏳ Đang đọc trang...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: scrapeTikTokOneDetailPage,
  }, async (results) => {
    const scraped = results && results[0] && results[0].result;
    if (!scraped) {
      detailStatusDiv.innerHTML = "<span style='color:red;'>❌ Không đọc được trang.</span>";
      return;
    }
    if (scraped.error) {
      detailStatusDiv.innerHTML = `<span style='color:orange;'>⚠️ ${scraped.error}</span>`;
      return;
    }

    detailStatusDiv.innerHTML = '🔄 Đang đẩy chi tiết về webapp...';
    try {
      const res = await fetch(`${webappUrl}/api/creators/update-detail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle: scraped.handle, tiktokOneId: scraped.tiktokOneId, detail: scraped.detail }),
      });
      const data = await res.json();
      detailStatusDiv.innerHTML = data.status === 'ok'
        ? `<span style='color:green;'>✅ Đã cập nhật chi tiết cho ${data.creator.handle}</span>`
        : `<span style='color:red;'>❌ ${data.message}</span>`;
    } catch (err) {
      detailStatusDiv.innerHTML = `<span style='color:red;'>❌ Lỗi kết nối webapp: ${err.message}</span>`;
    }
  });
});

// ================== LẤY ENGAGEMENT METRICS TRANG PROFILE TIKTOK (tiktok.com/@handle) ==================
// User tự mở trang tiktok.com/@handle của creator, bấm nút này. Đọc window.__pickdi_items
// do interceptor.js chặn từ API item_list thật -> ra số liệu engagement chính xác, không đoán.

// HÀM CHẠY TRỰC TIẾP TRÊN TRANG WEB — không được closure biến ngoài.
function scrapeTikTokEngagementPage() {
  const currentUrl = window.location.href;
  if (!currentUrl.includes('tiktok.com/@')) {
    return { error: 'Trang hiện tại không phải profile TikTok (tiktok.com/@handle).' };
  }
  const handle = window.location.pathname.replace('/', '').split('?')[0];
  const MAX_VIDEOS = 50;

  function toNum(x) {
    if (x == null) return 0;
    if (typeof x === 'number') return x;
    const n = parseInt(String(x).replace(/[^\d]/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  function parseCount(str) {
    if (str == null) return 0;
    if (typeof str === 'number') return str;
    str = String(str).trim().replace(/,/g, '.').toUpperCase();
    const m = str.match(/([\d.]+)\s*([KMB]?)/);
    if (!m) return 0;
    let n = parseFloat(m[1]);
    if (m[2] === 'K') n *= 1e3;
    else if (m[2] === 'M') n *= 1e6;
    else if (m[2] === 'B') n *= 1e9;
    return Math.round(n);
  }

  function getVideosFromNetworkCapture(h) {
    const store = window.__pickdi_items || {};
    const raw = Object.values(store);
    const videos = raw.map((o) => {
      const s = o.stats || o.statsV2 || {};
      let authorHandle = '';
      if (o.author) authorHandle = (typeof o.author === 'string') ? o.author : (o.author.uniqueId || o.author.id || '');
      return {
        createTime: toNum(o.createTime),
        views: toNum(s.playCount),
        likes: toNum(s.diggCount),
        comments: toNum(s.commentCount),
        shares: toNum(s.shareCount),
        author: String(authorHandle).toLowerCase(),
      };
    });
    const hh = h.replace('@', '').toLowerCase();
    const filtered = videos.filter((v) => !v.author || v.author === hh);
    const result = filtered.length > 0 ? filtered : videos;
    result.sort((a, b) => b.createTime - a.createTime);
    return result;
  }

  const followersEl = document.querySelector('[data-e2e="followers-count"]');
  const followersNum = toNum(followersEl ? followersEl.innerText.trim() : '0');

  const avatarEl = document.querySelector('[data-e2e="user-avatar"] img');
  const avatarUrl = avatarEl ? avatarEl.src : null;

  const bioEl = document.querySelector('h2[data-e2e="user-bio"]');
  const bio = bioEl ? bioEl.innerText : '';
  const emailMatch = bio.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const email = emailMatch ? emailMatch[0] : null;

  let instagram = null;
  const igLinkMatch = bio.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
  const igMentionMatch = bio.match(/(?:ig|insta)\s*[:@]\s*@?([a-zA-Z0-9._]+)/i);
  if (igLinkMatch) instagram = igLinkMatch[1];
  else if (igMentionMatch) instagram = igMentionMatch[1];

  let videos = getVideosFromNetworkCapture(handle);
  const hasFullStats = videos.length > 0;
  if (!hasFullStats) {
    return { error: 'Không bắt được data video (window.__pickdi_items rỗng) — hãy tải lại trang này rồi thử lại.' };
  }
  videos = videos.slice(0, MAX_VIDEOS);
  const n = videos.length;

  const sum = videos.reduce((a, v) => ({
    views: a.views + v.views, likes: a.likes + v.likes, comments: a.comments + v.comments, shares: a.shares + v.shares,
  }), { views: 0, likes: 0, comments: 0, shares: 0 });

  const avgViews = n ? Math.round(sum.views / n) : 0;
  const avgLikes = n ? Math.round(sum.likes / n) : 0;
  const avgComments = n ? Math.round(sum.comments / n) : 0;
  const avgShares = n ? Math.round(sum.shares / n) : 0;

  const viewsList = videos.map((v) => v.views).filter((v) => v > 0);
  const maxViews = viewsList.length ? Math.max(...viewsList) : 0;
  const minViews = viewsList.length ? Math.min(...viewsList) : 0;
  const maxMinRatio = minViews > 0 ? maxViews / minViews : null;

  const times = videos.map((v) => v.createTime).filter((t) => t > 0);
  let postingFrequency = null;
  let lastVideoDate = '';
  if (times.length >= 2) {
    const spanDays = (Math.max(...times) - Math.min(...times)) / 86400;
    postingFrequency = spanDays > 0 ? (times.length / (spanDays / 7)) : null;
  }
  if (times.length >= 1) lastVideoDate = new Date(Math.max(...times) * 1000).toISOString().slice(0, 10);

  const totalEngagement = sum.likes + sum.comments + sum.shares;
  const erByView = sum.views ? (totalEngagement / sum.views * 100) : null;
  const erByFollower = followersNum ? (totalEngagement / n / followersNum * 100) : null;

  return {
    handle,
    avatarUrl,
    bio: bio || null,
    email,
    instagram,
    engagement: {
      videosAnalyzed: n,
      avgViews, maxViews, minViews,
      maxMinRatio: maxMinRatio != null ? Number(maxMinRatio.toFixed(1)) : null,
      avgLikes, avgComments, avgShares,
      erView: erByView != null ? Number(erByView.toFixed(2)) : null,
      erFollower: erByFollower != null ? Number(erByFollower.toFixed(2)) : null,
      postingFrequency: postingFrequency != null ? Number(postingFrequency.toFixed(1)) : null,
      lastVideoDate,
    },
  };
}

document.getElementById('pushEngagementBtn').addEventListener('click', async () => {
  const engagementStatusDiv = document.getElementById('engagementStatus');
  const webappUrl = getWebappUrl();
  chrome.storage.local.set({ webappUrl });

  engagementStatusDiv.innerHTML = '⏳ Đang đọc trang...';
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN',
    func: scrapeTikTokEngagementPage,
  }, async (results) => {
    const scraped = results && results[0] && results[0].result;
    if (!scraped) {
      engagementStatusDiv.innerHTML = "<span style='color:red;'>❌ Không đọc được trang.</span>";
      return;
    }
    if (scraped.error) {
      engagementStatusDiv.innerHTML = `<span style='color:orange;'>⚠️ ${scraped.error}</span>`;
      return;
    }

    engagementStatusDiv.innerHTML = '🔄 Đang đẩy engagement metrics về webapp...';
    try {
      const res = await fetch(`${webappUrl}/api/creators/update-engagement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          handle: scraped.handle,
          avatarUrl: scraped.avatarUrl,
          bio: scraped.bio,
          email: scraped.email,
          instagram: scraped.instagram,
          engagement: scraped.engagement,
        }),
      });
      const data = await res.json();
      engagementStatusDiv.innerHTML = data.status === 'ok'
        ? `<span style='color:green;'>✅ Đã cập nhật engagement cho ${data.creator.handle}</span>`
        : `<span style='color:red;'>❌ ${data.message}</span>`;
    } catch (err) {
      engagementStatusDiv.innerHTML = `<span style='color:red;'>❌ Lỗi kết nối webapp: ${err.message}</span>`;
    }
  });
});
