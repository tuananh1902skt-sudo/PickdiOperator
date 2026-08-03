// Hàm chuẩn hoá dùng chung giữa popup.js (chạy trong popup, world ISOLATED) và background.js
// (service worker) — cần tách riêng vì background.js không có DOM/popup context nhưng vẫn phải
// tự gọi normalizeTcmProfileDetail() khi xử lý hàng đợi "auto lấy chi tiết" (session 8/9).
// Nạp bằng <script src="shared.js"> (popup.html, trước popup.js) và importScripts('shared.js')
// (background.js) — cả 2 cách đều add function vào cùng 1 global scope, không dùng module.

function parseMoney(v) {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return isNaN(n) ? undefined : n;
}

// Field tiền tệ thật của marketplace/profile (xác nhận qua live recon DevTools, không đoán) có
// 2 shape khác nhau tuỳ field: (1) {value,symbol,format} cho 1 số đơn (vd gpm, med_gmv_revenue,
// avg_revenue_per_buyer) — dùng .value; (2) {minimal,maximum,symbol,...} cho field range (vd
// ec_video_gpm, ec_live_gpm) — lấy trung bình 2 đầu. Field CHƯA có data thật trả về dạng
// {is_authorized,status} (không có value/minimal/maximum) -> trả undefined thay vì đoán bừa.
function extractMoneyLikeValue(v) {
  if (v === null || v === undefined || typeof v !== 'object') return v;
  if (v.value !== undefined) return v.value;
  if (v.minimal !== undefined || v.maximum !== undefined) {
    const lo = Number(v.minimal), hi = Number(v.maximum);
    if (Number.isFinite(lo) && Number.isFinite(hi)) return (lo + hi) / 2;
    if (Number.isFinite(lo)) return lo;
    if (Number.isFinite(hi)) return hi;
  }
  return undefined;
}

// Number(x) trên field không phải số (vd TCM trả "--"/loading placeholder khi tab chưa load
// xong) ra NaN — NaN lọt qua mọi check `!= null` phía trên rồi bị JSON.stringify() khi POST
// biến thành `null` nằm im trong DB, làm UI tưởng có data thật (object tồn tại) nhưng gọi
// .toFixed()/hiển thị số trên giá trị null thì crash/hiện "null". Luôn dùng hàm này thay vì
// Number() trần cho mọi field số lấy từ TCM raw profile.
function toNum(v) {
  if (v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// Field TCM chưa xác nhận đầy đủ có LUÔN là string thuần hay đôi khi vẫn còn bọc dạng
// {value,...}/object khác không (bug thật đã gặp: main_industry lưu thành chuỗi JSON rác
// '{"is_authorized":true,"status":0}', handle của marketplace/profile từng là object khiến
// String(handle) tạo ra "[object Object]" — 1 handle rác nhưng vẫn "truthy" nên lọt qua mọi
// check rồi bị lưu thẳng vào CRM). KHÔNG bao giờ String(v) ép kiểu mù — chỉ nhận khi field đã
// đúng là string sẵn, còn lại coi như chưa biết cách đọc và bỏ qua (rồi log ra để đối chiếu).
function asString(v) {
  return (typeof v === 'string' && v.trim()) ? v.trim() : undefined;
}

// BUG THẬT (2026-08-03, phát hiện qua recon DevTools thật trên đúng response marketplace/profile
// đang cào): med_gmv_revenue/gpm/units_sold/avg_revenue_per_buyer/ec_video_gpm/ec_live_gpm hầu
// như LUÔN là placeholder {is_authorized:false,status:0} — TCM không trả số chính xác cho hầu hết
// creator (cần quyền "authorized" riêng), extractMoneyLikeValue() trả undefined đúng như thiết
// kế nên GMV/Items sold/GPM/GMV per customer/Video GPM/LIVE GPM bị bỏ trắng hoàn toàn dù TCM UI
// vẫn hiển thị được 1 khoảng ước lượng — vì mỗi field số đó có 1 field "_range" song song
// (med_gmv_revenue_range="$5k-$25K", units_sold_range="100-1K", gpm_range="$0-$5k",
// avg_revenue_per_buyer_range="$20+", video_gpm_range, live_gpm_range) mà TCM UI đọc để hiển thị
// khi số chính xác không có quyền xem. Parse khoảng này thành số ước lượng (trung điểm, hoặc cận
// dưới cho dạng "X+") — vẫn tốt hơn nhiều so với bỏ trắng, và đúng là cách TCM tự làm với chính
// mình. Không xác nhận khớp % (dạng "10%-15%") nên hàm chỉ dùng cho field tiền/số lượng.
function parseBucketRange(str) {
  if (typeof str !== 'string') return undefined;
  const s = str.trim();
  if (!s) return undefined;
  const parseTok = (tok) => {
    const t = tok.replace(/[$,\s]/g, '');
    const m = t.match(/^([0-9]*\.?[0-9]+)([kKmM]?)$/);
    if (!m) return undefined;
    const n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return undefined;
    const suffix = m[2].toLowerCase();
    if (suffix === 'k') return n * 1000;
    if (suffix === 'm') return n * 1000000;
    return n;
  };
  const plusMatch = s.match(/^(.+)\+$/);
  if (plusMatch) return parseTok(plusMatch[1]);
  const parts = s.split('-').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 2) {
    const lo = parseTok(parts[0]);
    const hi = parseTok(parts[1]);
    if (lo !== undefined && hi !== undefined) return (lo + hi) / 2;
    return lo !== undefined ? lo : hi;
  }
  return parseTok(s);
}

const DEMO_LABELS = { male: 'Male', female: 'Female' };

// follower_genders_v2/follower_ages_v2 không phải lúc nào cũng cộng đúng 100% (còn 1 phần
// "unknown" TCM không trả ra key riêng, vd 1 creator thật: male 0.7032 + female 0.2481 =
// 0.9513, thiếu ~4.87%) — nhưng donut Gender/Age trên UI thật TCM tự chuẩn hoá lại theo tổng
// chỉ các key ĐÃ trả (0.7032/0.9513=73.92%, khớp CHÍNH XÁC số UI hiển thị, xác nhận qua live
// recon). Nếu lấy % thô không chuẩn hoá, số lưu vào CRM sẽ lệch với số user nhìn thấy trên TCM.
function normalizePct(entries) {
  const sum = entries.reduce((s, e) => s + (Number(e.value) || 0), 0);
  if (!(sum > 0)) return entries.map((e) => ({ key: e.key, pct: 0 }));
  return entries.map((e) => ({ key: e.key, pct: Math.round(((Number(e.value) || 0) / sum) * 100) }));
}

// Bio creator viết email theo rất nhiều kiểu khác nhau để né spam-bot: email thuần
// ("contact me: name@gmail.com"), hoặc né dạng chữ ("name at gmail dot com", "name (at) gmail
// (dot) com", "name[at]gmail[dot]com"). Thử regex email chuẩn trước; nếu không khớp, de-obfuscate
// " at "/"(at)"/"[at]" -> "@" và " dot "/"(dot)"/"[dot]" -> "." (chỉ match \b...\b để không dính
// nhầm "at" nằm giữa từ khác, vd "Latina", "chat") rồi thử lại 1 lần.
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
function extractEmailFromBio(bio) {
  if (typeof bio !== 'string' || !bio.trim()) return undefined;
  const direct = bio.match(EMAIL_RE);
  if (direct) return direct[0].replace(/[.,;:!?]+$/, '');
  const deobfuscated = bio
    .replace(/\s*[\(\[]?\s*\bat\b\s*[\)\]]?\s*/gi, '@')
    .replace(/\s*[\(\[]?\s*\bdot\b\s*[\)\]]?\s*/gi, '.');
  const fallback = deobfuscated.match(EMAIL_RE);
  return fallback ? fallback[0].replace(/[.,;:!?]+$/, '') : undefined;
}

// profile.handle từng bị bắt gặp KHÔNG phải string thuần (nguyên nhân bug thật: 1 creator bị
// lưu với handle="[object Object]" — String(obj) không throw nên lọt qua check "có giá trị" cũ,
// ra 1 chuỗi rác nhưng vẫn "truthy"). Dò thêm vài path lồng nhau khả dĩ trước khi bỏ cuộc, và
// KHÔNG BAO GIỜ String()-ép 1 object/array thành handle.
function extractHandle(profile) {
  const direct = asString(profile.handle);
  if (direct) return direct;
  if (profile.handle && typeof profile.handle === 'object') {
    const nested = asString(profile.handle.value) || asString(profile.handle.handle) || asString(profile.handle.uniqueId);
    if (nested) return nested;
  }
  return asString(profile.unique_id) || asString(profile.uniqueId);
}

// Chuẩn hoá creator_profile (đã deep-merge từ nhiều lần gọi marketplace/profile, hoặc raw 1 lần
// nếu đọc thẳng từ tab vừa mở) thành payload enrich gửi lên /api/creators/batch-import.
function normalizeTcmProfileDetail(profile) {
  const rawHandle = extractHandle(profile);
  const handle = rawHandle ? rawHandle.replace(/^@/, '') : undefined;
  if (!handle) return null;

  const out = { handle };

  // BUG THẬT (2026-08-01): hàm này trước đây không map avatar -> mọi creator tạo/enrich qua
  // luồng "Cào chi tiết TCM" (kể cả nút "Cào lại avatar thiếu" mới thêm) gửi payload lên
  // batch-import KHÔNG có field avatar, nên server.ts không bao giờ push avatarJobs cho những
  // creator đó -> avatar trắng vĩnh viễn dù cào chi tiết "thành công". normalizeCreator() (list
  // endpoint) đã luôn map avatar đúng; profile endpoint (marketplace/profile) CHƯA xác nhận tên
  // field avatar qua recon DevTools thật, nên thử theo đúng thứ tự fallback server.ts đã dùng
  // (avatar/avatar_thumb/head_url) + extractAvatarUrl() để chịu được cả string lẫn object
  // {url_list}/{url}/{uri} — nếu field không tồn tại ở profile response thì vẫn undefined như cũ,
  // không có rủi ro regression.
  const avatarUrl = extractAvatarUrl(profile.avatar) || extractAvatarUrl(profile.avatar_thumb) || extractAvatarUrl(profile.head_url);
  if (avatarUrl) out.avatar = avatarUrl;

  // BUG THẬT (2026-08-03): hàm này chưa bao giờ map followers/avgViews/displayName/country —
  // chỉ normalizeCreator() (list endpoint) map các field này. Creator nào được tạo MỚI thẳng qua
  // "Lấy chi tiết trang này"/"Auto quét" (chưa từng qua "Import creator đã bắt được" từ danh sách
  // trước đó — vd mở thẳng link chi tiết 1 creator từ nơi khác trên TCM) sẽ thiếu hẳn follower
  // count/avg views/tên hiển thị/quốc gia trên CRM dù các nhóm PPS/Sales/Video/LIVE/... vẫn đầy
  // đủ như báo cáo "Đã bắt". follower_cnt/nickname/selection_region XÁC NHẬN THẬT qua recon
  // DevTools (Claude in Chrome, session này) tồn tại y hệt ở response marketplace/profile
  // (detail) — cùng tên với marketplace/find (list).
  const followers = toNum(profile.follower_cnt);
  if (followers !== undefined) out.followers = followers;

  // BUG THẬT #2 (2026-08-03, sửa lại phát hiện lúc test cào thật 1 creator qua đối chiếu số
  // hiển thị trên chính trang TCM): `video_avg_view_cnt` LUÔN là placeholder
  // {is_authorized:true,status:0} trên response thật, KHÔNG BAO GIỜ có .value — dòng comment cũ
  // ở đây ("chỉ có giá trị thật sau khi xem tab Video") sai, có thể do đối chiếu nhầm creator
  // khác lúc trước. Field thật khớp CHÍNH XÁC với số "Avg. video views" trên UI TCM (test thật:
  // TCM hiển thị 13.45K, video_play_cnt_med trả về "13450") là `video_play_cnt_med` — giữ
  // video_avg_view_cnt làm fallback phòng trường hợp TCM đổi field cho creator khác.
  const avgViews = toNum(profile.video_play_cnt_med) ?? toNum(profile.video_avg_view_cnt);
  if (avgViews !== undefined) out.avgViews = avgViews;

  const displayName = asString(profile.nickname);
  if (displayName) out.displayName = displayName;

  const country = asString(profile.selection_region);
  if (country) out.country = country;

  const bio = asString(profile.bio);
  if (bio) {
    out.bio = bio;
    const email = extractEmailFromBio(bio);
    if (email) out.email = email;
  }

  if (Array.isArray(profile.industry_groups) && profile.industry_groups.length > 0) {
    const sorted = [...profile.industry_groups].sort((a, b) => (b.value || 0) - (a.value || 0));
    out.category = asString(sorted[0].name);
    // niche = tất cả tag ngành hàng TCM trả về (không chỉ cái #1) — trước đây không field nào
    // trong toàn bộ pipeline ghi vào Creator.niche nên nó luôn trống ở CRM dù industry_groups
    // đã có sẵn data.
    out.niche = sorted.map((g) => asString(g.name)).filter(Boolean);
    const beauty = profile.industry_groups.find((g) => /beauty|personal care/i.test(g.name || ''));
    if (beauty) out.beautyCategoryRatio = Math.round((beauty.value || 0) * 100);
  }

  const demographics = {};
  if (Array.isArray(profile.follower_genders_v2) && profile.follower_genders_v2.length > 0) {
    const genderPct = normalizePct(profile.follower_genders_v2);
    genderPct.forEach((g) => {
      if (g.key === 'male') demographics.genderMale = g.pct;
      if (g.key === 'female') demographics.genderFemale = g.pct;
    });
    const topGenderEntry = [...genderPct].sort((a, b) => b.pct - a.pct)[0];
    if (topGenderEntry) demographics.topGender = DEMO_LABELS[topGenderEntry.key] || topGenderEntry.key;
  }
  if (Array.isArray(profile.follower_ages_v2) && profile.follower_ages_v2.length > 0) {
    const agePct = normalizePct(profile.follower_ages_v2);
    demographics.ageDistribution = agePct.map((a) => ({ name: a.key, value: a.pct }));
    const topAge = [...agePct].sort((a, b) => b.pct - a.pct)[0];
    demographics.topAgeGroup = topAge.key;
  }
  if (Array.isArray(profile.follower_state_location) && profile.follower_state_location.length > 0) {
    // "country" ở đây thực ra là BANG Mỹ, không phải quốc gia — TCM chỉ trả top 5 theo bang.
    demographics.countryDistribution = profile.follower_state_location.map((s) => ({ name: s.key, value: Number(s.value) || 0 }));
    demographics.topCountry = profile.follower_state_location[0].key;
  }
  if (Object.keys(demographics).length > 0) out.demographics = demographics;

  const gpm = parseMoney(extractMoneyLikeValue(profile.gpm)) ?? parseBucketRange(profile.gpm_range);
  if (gpm !== undefined) out.gpm = gpm;

  // med_gmv_revenue là GMV TRUNG VỊ 30 ngày (không phải tổng tích luỹ) — field GMV tích luỹ
  // hiển thị ở list view TCM chưa xác nhận tên JSON thô, dùng tạm field này cho gmv30d.
  // Fallback sang med_gmv_revenue_range (parseBucketRange) khi số chính xác bị khoá quyền xem.
  const gmv30d = parseMoney(extractMoneyLikeValue(profile.med_gmv_revenue)) ?? parseBucketRange(profile.med_gmv_revenue_range);
  if (gmv30d !== undefined) out.gmv30d = gmv30d;

  if (profile.video_publish_cnt_30d != null) out.postingFrequency30d = toNum(profile.video_publish_cnt_30d);

  const unitsSold = toNum(profile.units_sold) ?? parseBucketRange(profile.units_sold_range);
  if (gmv30d !== undefined || unitsSold !== undefined) {
    out.hasAffiliateGmv = (gmv30d || 0) > 0 || (unitsSold || 0) > 0;
  }

  if (toNum(profile.pps_score) !== undefined) {
    out.pps = { score: toNum(profile.pps_score) };
  }

  // TCM hiển thị 4 mục "Posts with samples / Post frequency / Sales generation / Content
  // quality" trên UI thật, nhưng field JSON thô trả về tên khác (fulfillment/diligence/
  // sales_ability/content_quality) — map theo ngữ nghĩa gần nhất, KHÔNG xác nhận khớp
  // 1:1 tuyệt đối với đúng thứ tự UI. content_quality khớp trực tiếp, 3 mục còn lại là suy
  // luận hợp lý nhất hiện có (fulfillment=nộp đủ sample đã nhận, diligence=đều đặn đăng bài,
  // sales_ability=khả năng bán hàng).
  const sampleBreakdown = [];
  const pushSample = (key, label, scoreField, rankField) => {
    const score = profile[scoreField];
    const rank = profile[rankField];
    if (score == null && rank == null) return;
    sampleBreakdown.push({
      key,
      label,
      score: toNum(score),
      percentileText: typeof rank === 'string' ? rank : undefined,
    });
  };
  pushSample('postsWithSamples', 'Posts with samples', 'sample_credit_fulfillment_score', 'sample_credit_fulfillment_rank');
  pushSample('postFrequency', 'Post frequency', 'sample_credit_diligence_score', 'sample_credit_diligence_rank');
  pushSample('salesGeneration', 'Sales generation', 'sample_credit_sales_ability_score', 'sample_credit_sales_ability_rank');
  pushSample('contentQuality', 'Content quality', 'sample_credit_content_quality_score', 'sample_credit_content_quality_rank');
  if (sampleBreakdown.length > 0 || profile.sample_credit_total_score != null) {
    out.sampleScore = {
      total: toNum(profile.sample_credit_total_score),
      breakdown: sampleBreakdown,
    };
  }

  const salesMetrics = {};
  if (gmv30d !== undefined) salesMetrics.gmv = gmv30d;
  if (unitsSold !== undefined) salesMetrics.itemsSold = unitsSold;
  if (gpm !== undefined) salesMetrics.gpm = gpm;
  const gmvPerCustomer = parseMoney(extractMoneyLikeValue(profile.avg_revenue_per_buyer)) ?? parseBucketRange(profile.avg_revenue_per_buyer_range);
  if (gmvPerCustomer !== undefined) salesMetrics.gmvPerCustomer = gmvPerCustomer;
  if (Array.isArray(profile.content_groups) && profile.content_groups.length > 0) {
    const channelSplit = {};
    profile.content_groups.forEach((g) => {
      if (g.key === 'video_gmv') channelSplit.video = Math.round((g.value || 0) * 100);
      if (g.key === 'live_gmv') channelSplit.live = Math.round((g.value || 0) * 100);
    });
    if (channelSplit.video !== undefined || channelSplit.live !== undefined) salesMetrics.channelSplit = channelSplit;
  }
  if (Array.isArray(profile.industry_groups) && profile.industry_groups.length > 0) {
    salesMetrics.categorySplit = profile.industry_groups.map((g) => ({ name: asString(g.name) || g.key, value: Math.round((g.value || 0) * 100) }));
  }
  if (Object.keys(salesMetrics).length > 0) out.salesMetrics = salesMetrics;

  const collabMetrics = {};
  const commissionRateRaw = toNum(profile.med_commission_rate);
  const avgCommissionRatePct = commissionRateRaw !== undefined ? commissionRateRaw / 100 : undefined;
  if (avgCommissionRatePct !== undefined) collabMetrics.avgCommissionRatePct = avgCommissionRatePct;
  if (toNum(profile.collaborated_brands_num) !== undefined) collabMetrics.brandCollabCount = toNum(profile.collaborated_brands_num);
  if (Array.isArray(profile.partnered_brand) && profile.partnered_brand.length > 0) {
    collabMetrics.brandPartners = profile.partnered_brand
      .filter((b) => b && b.name)
      .map((b) => ({ id: String(b.id ?? b.name), name: asString(b.name) || String(b.name) }));
  }
  // "Est. post rate" (sample_fulfillment_rate/100) và "Products" (promoted_product_num) — 2 ô
  // TCM UI hiển thị thật trong khối Collaboration metrics nhưng trước đây KHÔNG hàm nào map,
  // xác nhận thật tên field qua recon: sample_fulfillment_rate=9280 khớp "Est. post rate 92.8%",
  // promoted_product_num="6" khớp "Products 6".
  const postRateRaw = toNum(profile.sample_fulfillment_rate);
  if (postRateRaw !== undefined) collabMetrics.estPostRatePct = postRateRaw / 100;
  const productsCount = toNum(profile.promoted_product_num);
  if (productsCount !== undefined) collabMetrics.productsCount = productsCount;
  if (Object.keys(collabMetrics).length > 0) out.collabMetrics = collabMetrics;

  // video_gpm/live_gpm KHÔNG tồn tại trong response thật — tên field thật là ec_video_gpm/
  // ec_live_gpm, dạng range {minimal,maximum} chứ không phải 1 số đơn (xác nhận qua live recon
  // DevTools, session 7). video_engagement/live_engagement (chia 100) khớp CHÍNH XÁC với %
  // hiển thị trên UI thật ("Avg. video engagement rate 0.8%" = video_engagement 80/100). Cả 2
  // field GPM này gần như LUÔN là placeholder {is_authorized:false,...} như GMV/GPM chung —
  // fallback sang video_gpm_range/live_gpm_range (parseBucketRange) khi bị khoá quyền xem.
  // video_play_cnt_med/live_med_view_cnt là "Avg. video views"/"Avg. LIVE views" thật trên UI
  // (đối chiếu số chính xác lúc test cào thật, session này) — trước đây 2 field này chưa được
  // map dù UI (CreatorDetailDrawer) đã có sẵn ô hiển thị luôn để trống "Chưa có dữ liệu".
  const videoGpm = parseMoney(extractMoneyLikeValue(profile.ec_video_gpm)) ?? parseBucketRange(profile.video_gpm_range);
  const videoEngagementRatePct = toNum(profile.video_engagement) !== undefined ? toNum(profile.video_engagement) / 100 : undefined;
  const videoAvgViews = toNum(profile.video_play_cnt_med);
  if (videoGpm !== undefined || profile.video_publish_cnt_30d != null || videoEngagementRatePct !== undefined || videoAvgViews !== undefined) {
    out.videoMetrics = {
      gpm: videoGpm,
      videosCount: toNum(profile.video_publish_cnt_30d),
      avgViews: videoAvgViews,
      engagementRatePct: videoEngagementRatePct,
    };
  }

  const liveGpm = parseMoney(extractMoneyLikeValue(profile.ec_live_gpm)) ?? parseBucketRange(profile.live_gpm_range);
  const liveEngagementRatePct = toNum(profile.live_engagement) !== undefined ? toNum(profile.live_engagement) / 100 : undefined;
  const liveAvgViews = toNum(profile.live_med_view_cnt);
  if (liveGpm !== undefined || profile.live_streaming_cnt_30d != null || liveEngagementRatePct !== undefined || liveAvgViews !== undefined) {
    out.liveMetrics = {
      gpm: liveGpm,
      engagementRatePct: liveEngagementRatePct,
      streamsCount: toNum(profile.live_streaming_cnt_30d),
      avgViews: liveAvgViews,
    };
  }

  // Creator.engagementRate (field ER top-level dùng ở list/scoring toàn app) trước đây KHÔNG
  // bao giờ được set ở đây — chỉ videoMetrics/liveMetrics.engagementRatePct có giá trị, nên ER
  // luôn trống trên CRM dù TCM hiển thị "Engagement rate" thật ngay trên UI list/detail.
  if (videoEngagementRatePct !== undefined) out.engagementRate = videoEngagementRatePct;
  else if (liveEngagementRatePct !== undefined) out.engagementRate = liveEngagementRatePct;

  // BUG THẬT (2026-08-03, xác nhận qua recon DevTools thật lúc test cào 1 creator): top_video_data
  // KHÔNG có field title/cover/createTime như đoán trước — tên field thật là `name` (title),
  // `release_date` (unix giây, không phải mili-giây), `item_id`. Không có field cover/thumbnail
  // nào trong response (video.video_infos chỉ chứa file video main_url/backup_url, không phải
  // ảnh bìa) nên out.thumb tiếp tục để trống thay vì đoán tên field không tồn tại.
  const videoList = profile.top_video_data || profile.ec_top_video_data;
  if (Array.isArray(videoList) && videoList.length > 0) {
    out.recentVideos = videoList.slice(0, 10).map((v, i) => ({
      id: String(v.itemID || v.item_id || v.id || i),
      title: asString(v.name) || asString(v.title) || '',
      views: Number(v.views ?? v.play_cnt ?? v.playCount ?? 0),
      thumb: v.cover || v.coverUrl || v.thumb || '',
      date: (v.release_date || v.createTime || v.create_time)
        ? new Date(Number(v.release_date || v.createTime || v.create_time) * 1000).toISOString().slice(0, 10)
        : undefined,
      isBranded: !!(v.isSponsoredVideo ?? v.is_sponsored ?? v.isBranded),
      videoUrl: (v.itemID || v.item_id) ? `https://www.tiktok.com/@${handle}/video/${v.itemID || v.item_id}` : undefined,
    }));
  }

  const oecuid = asString(profile.creator_oecuid) || (typeof profile.creator_oecuid === 'number' ? String(profile.creator_oecuid) : undefined);
  if (oecuid) out.tcmCreatorOecuid = oecuid;

  return out;
}

// ================== Helper dùng chung cho các flow chạy trong background.js ==================
// Chuyển từ popup.js sang đây (session 10) để background.js có thể tự đọc tab + tự POST webapp
// mà KHÔNG cần popup còn mở — trước đây các nút bấm gọi fetch() thẳng trong popup.js, nên nếu
// user chuyển tab (Chrome tự đóng popup) đúng lúc đang fetch, request bị huỷ giữa chừng, không
// có gì được lưu lại. Các hàm "HÀM CHẠY BÊN TRONG TAB" dưới đây được chrome.scripting.executeScript
// serialize bằng toString() rồi eval lại trong page context — TUYỆT ĐỐI không được closure biến
// ngoài, bất kể được gọi từ popup.js hay background.js.

function extractAvatarUrl(avatarField) {
  if (!avatarField) return undefined;
  if (typeof avatarField === 'string') return avatarField;
  if (Array.isArray(avatarField.url_list) && avatarField.url_list.length > 0) return avatarField.url_list[0];
  if (typeof avatarField.url === 'string') return avatarField.url;
  if (typeof avatarField.uri === 'string') return avatarField.uri;
  return undefined;
}

function matchesClientFilters(flat, filters) {
  const followers = flat.follower_cnt != null ? Number(flat.follower_cnt) : undefined;
  if (filters.follower_min && (followers === undefined || followers < filters.follower_min)) return false;
  if (filters.follower_max && (followers === undefined || followers > filters.follower_max)) return false;
  if (filters.query_keyword) {
    const kw = filters.query_keyword.toLowerCase();
    const haystack = `${flat.handle || ''} ${flat.nickname || ''} ${flat.main_industry || ''}`.toLowerCase();
    if (!haystack.includes(kw)) return false;
  }
  return true;
}

// marketplace/find (list) đã có sẵn pps_score/med_gmv_revenue/units_sold/ec_video_gpm/
// ec_live_gpm/video_engagement CHO MỌI creator trong danh sách (xác nhận qua live recon
// DevTools, session 8) — map thẳng vào đây để nút "Import creator đã bắt được" tự có luôn PPS/
// Sales(partial)/Video-Live GPM mà KHÔNG cần mở trang chi tiết từng creator.
function normalizeCreator(flat) {
  const rawHandle = asString(flat.handle);
  const handle = rawHandle ? rawHandle.replace(/^@/, '') : undefined;
  const followers = flat.follower_cnt != null ? Number(flat.follower_cnt) : undefined;
  const avgViews = flat.ec_video_avg_view_cnt != null ? Number(flat.ec_video_avg_view_cnt) : undefined;
  const gpmRaw = flat.ec_video_gpm != null ? flat.ec_video_gpm : flat.ec_live_gpm;

  // `main_industry` từng bị coi là nguồn category/niche của list-endpoint (session 1) nhưng live
  // recon DevTools thật (Claude in Chrome, phiên này) xác nhận field đó LUÔN là auth-wrapper rỗng
  // {is_authorized,status:0} — chưa từng có giá trị thật ở bất kỳ creator nào. Category tag thật
  // (vd "Beauty & Personal Care") nằm ở field `category`, dạng mảng [{name,starling_key}] — bug
  // thật khiến category/niche trống 100% cho MỌI creator import qua list trước session này.
  const categoryTags = Array.isArray(flat.category)
    ? flat.category.map(c => asString(c && c.name)).filter(Boolean)
    : [];

  const out = {
    handle,
    displayName: asString(flat.nickname) || handle,
    avatar: extractAvatarUrl(flat.avatar),
    country: asString(flat.selection_region),
    followers,
    avgViews,
    category: categoryTags[0],
    niche: categoryTags.length > 0 ? categoryTags : undefined,
    gpm: parseMoney(extractMoneyLikeValue(gpmRaw)),
    tcmCreatorOecuid: asString(flat.creator_oecuid) || (typeof flat.creator_oecuid === 'number' ? String(flat.creator_oecuid) : undefined),
  };

  if (toNum(flat.pps_score) !== undefined) out.pps = { score: toNum(flat.pps_score) };

  const gmv30d = parseMoney(extractMoneyLikeValue(flat.med_gmv_revenue));
  const unitsSold = toNum(flat.units_sold);
  if (gmv30d !== undefined) out.gmv30d = gmv30d;
  if (gmv30d !== undefined || unitsSold !== undefined) {
    out.salesMetrics = { gmv: gmv30d, itemsSold: unitsSold, gpm: out.gpm };
    out.hasAffiliateGmv = (gmv30d || 0) > 0 || (unitsSold || 0) > 0;
  }

  const videoGpm = parseMoney(extractMoneyLikeValue(flat.ec_video_gpm));
  const videoEngagementRatePct = toNum(flat.video_engagement) !== undefined ? toNum(flat.video_engagement) / 100 : undefined;
  if (videoGpm !== undefined || videoEngagementRatePct !== undefined) {
    out.videoMetrics = { gpm: videoGpm, engagementRatePct: videoEngagementRatePct };
  }
  // Creator.engagementRate top-level — TCM đã hiện sẵn "Engagement rate" ngay ở list view
  // (field thô video_engagement), nhưng trước đây chỉ videoMetrics.engagementRatePct được set
  // nên ER ở CRM (list/scoring) luôn trống dù list-import đã bắt được data này.
  if (videoEngagementRatePct !== undefined) out.engagementRate = videoEngagementRatePct;

  const liveGpm = parseMoney(extractMoneyLikeValue(flat.ec_live_gpm));
  if (liveGpm !== undefined) out.liveMetrics = { gpm: liveGpm };

  return out;
}

// HÀM CHẠY BÊN TRONG TAB "Find creators" VỪA MỞ (world MAIN) — gõ handle vào đúng ô search thật
// của TCM (textarea "Describe the creators you're looking for") rồi bấm nút search thật, để
// chính JS của trang tự gọi API marketplace/find có chữ ký hợp lệ — KHÔNG tự fetch()/giả mạo gì.
// Xác nhận qua recon thật (Claude in Chrome, session này): gõ đúng handle vào ô này trả về CHÍNH
// XÁC creator đó kể cả khi họ chưa từng tương tác gì với shop trên TCM (không chỉ creator được
// TCM tự gợi ý) — dùng để tra cid cho creator chỉ có sẵn TikTok handle (Kalodata/manual/import).
async function searchTcmByHandle(handle) {
  // Tìm ô search: ưu tiên đúng placeholder tiếng Anh (giao diện mặc định lúc recon), fallback
  // sang "textarea duy nhất trên trang" nếu tài khoản dùng TCM UI ngôn ngữ khác (placeholder sẽ
  // không khớp tiếng Anh nữa) — Find Creators chỉ có đúng 1 textarea (ô AI-search) nên an toàn.
  // Poll tối đa 6s vì trang có thể còn đang hydrate ngay sau khi tab báo 'complete'.
  const findSearchBox = () => {
    const byPlaceholder = document.querySelector('textarea[placeholder="Describe the creators you\'re looking for"]');
    if (byPlaceholder) return byPlaceholder;
    const allTextareas = document.querySelectorAll('textarea');
    return allTextareas.length === 1 ? allTextareas[0] : null;
  };
  let ta = null;
  const findBoxStartedAt = Date.now();
  while (Date.now() - findBoxStartedAt < 6000) {
    ta = findSearchBox();
    if (ta) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!ta) return { error: 'search_box_not_found' };

  const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  nativeSetter.call(ta, handle);
  ta.dispatchEvent(new Event('input', { bubbles: true }));

  // Nút search thật là <button> primary (icon kính lúp) nằm cùng khối cha với ô search — không
  // có data-testid/aria-label ổn định nên nhận diện qua class "core-btn-primary" (xác nhận qua
  // recon thật, duy nhất 1 button primary trong khối này). Class tên không phụ thuộc ngôn ngữ tài
  // khoản nên vẫn đáng tin cậy hơn text/placeholder — vẫn poll thêm phòng khi nút render trễ.
  const findSearchBtn = () => {
    let wrapper = ta;
    for (let i = 0; i < 4 && wrapper; i++) wrapper = wrapper.parentElement;
    return wrapper ? wrapper.querySelector('button.core-btn-primary') : null;
  };
  let searchBtn = null;
  const findBtnStartedAt = Date.now();
  while (Date.now() - findBtnStartedAt < 3000) {
    searchBtn = findSearchBtn();
    if (searchBtn) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!searchBtn) return { error: 'search_button_not_found' };
  searchBtn.click();

  const wantedHandle = handle.replace(/^@/, '').trim().toLowerCase();
  const startedAt = Date.now();
  while (Date.now() - startedAt < 8000) {
    const store = window.__pickdi_tcm_list || {};
    const match = Object.values(store).find((c) => {
      const h = c && c.handle ? String(c.handle).replace(/^@/, '').trim().toLowerCase() : '';
      return h === wantedHandle;
    });
    if (match) return { match };
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return { error: 'no_match' };
}

// HÀM CHẠY BÊN TRONG TAB TCM ĐANG MỞ — interceptor.js đã unwrap sẵn field {value,...} trước khi
// lưu vào window.__pickdi_tcm_list nên chỉ cần đọc thẳng ra.
function readTcmCapturedList() {
  const store = window.__pickdi_tcm_list || {};
  return { list: Object.values(store) };
}

// HÀM CHẠY BÊN TRONG TAB TCM ĐANG MỞ — chỉ trả raw profile, việc chuẩn hoá field làm ở ngoài
// trang (normalizeTcmProfileDetail) để tái dùng helper chung.
//
// Lưu ý: hàm này được chrome.scripting.executeScript({ func: readTcmLastProfile }) inject
// NGUYÊN VĂN vào trang TCM — nó KHÔNG thể gọi các hàm khác định nghĩa ở top-level của
// shared.js (findAllRetryButtons/humanLikeScrollDown/autoRetryLoadErrors bên dưới trong
// autoScanAndReadTcmProfile) vì executeScript chỉ mang theo đúng 1 hàm được trỏ tới, không
// mang cả file. Vì vậy phần cuộn + tự bấm Retry phải viết lại local ở đây.
async function readTcmLastProfile() {
  function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  function looksClickable(el) {
    if (!el) return false;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') return true;
    if (el.getAttribute && (el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'button')) return true;
    try { return window.getComputedStyle(el).cursor === 'pointer'; } catch (e) { return false; }
  }

  function pickClickableAncestor(el) {
    let node = el;
    for (let depth = 0; depth < 4 && node; depth++) {
      if (looksClickable(node)) return node;
      node = node.parentElement;
    }
    return el;
  }

  function isNearViewport(el, margin) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom >= -margin && r.top <= vh + margin;
  }

  // skipScroll: bỏ qua bước scrollIntoView vì đã biết chắc el đang nằm trong/gần khung nhìn rồi
  // (dùng khi bấm Retry vừa lộ ra lúc đang cuộn dần — không cần "nhảy" tới, chỉ bấm tại chỗ).
  async function fireClick(el, opts) {
    opts = opts || {};
    if (!opts.skipScroll && !isNearViewport(el, 0)) {
      try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (e) {}
      await sleep(320 + Math.random() * 220);
    }
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      try { el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window })); } catch (e) {}
    });
    try { el.click(); } catch (e) {}
  }

  function findAllRetryButtons() {
    const all = document.querySelectorAll('body *');
    const seen = new Set();
    const buttons = [];
    for (const el of all) {
      if (el.children.length > 0) continue;
      if ((el.textContent || '').trim() !== 'Retry') continue;
      const target = pickClickableAncestor(el);
      if (seen.has(target)) continue;
      seen.add(target);
      buttons.push(target);
    }
    return buttons;
  }

  // onlyVisible: chỉ bấm những nút Retry đang trong/gần khung nhìn NGAY LÚC NÀY — dùng trong lúc
  // cuộn dần để mô phỏng đúng thứ tự "đọc tới đâu xử lý tới đó" từ trên xuống, tránh nhảy thẳng
  // tới 1 nút Retry còn nằm sâu bên dưới (đã có trong DOM nhưng mắt người chưa "thấy" tới).
  async function clickAllRetryButtons(onlyVisible) {
    const buttons = findAllRetryButtons();
    const targets = onlyVisible ? buttons.filter((b) => isNearViewport(b, 150)) : buttons;
    for (const btn of targets) {
      await fireClick(btn, { skipScroll: true });
    }
    return targets.length;
  }

  async function humanLikeScrollDown() {
    let lastY = -1;
    for (let i = 0; i < 12; i++) {
      window.scrollBy(0, 220 + Math.random() * 360);
      await sleep(160 + Math.random() * 260);
      await clickAllRetryButtons(true);
      const y = window.scrollY;
      const atBottom = Math.ceil(y + window.innerHeight) >= document.documentElement.scrollHeight;
      if (atBottom || y === lastY) break;
      lastY = y;
    }
    await sleep(200 + Math.random() * 200);
    window.scrollTo(0, 0);
    await sleep(150);
  }

  async function autoRetryLoadErrors(maxAttempts) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      const clickedCount = await clickAllRetryButtons();
      if (clickedCount === 0) return true;
      attempt++;
      await sleep(1000 + attempt * 400 + Math.random() * 500);
    }
    return findAllRetryButtons().length === 0;
  }

  await humanLikeScrollDown();
  await autoRetryLoadErrors(6);

  const id = window.__pickdi_tcm_last_profile_id;
  if (!id) {
    return { error: 'Chưa bắt được data creator nào — hãy mở chi tiết 1 creator trên TCM, đợi vài giây cho các tab Sales/Video/Audience tự load, rồi bấm lại nút này.' };
  }
  const store = window.__pickdi_tcm_profiles || {};
  const profile = store[id];
  if (!profile) return { error: 'Không tìm thấy data đã bắt cho creator này.' };
  return { profile };
}

// HÀM CHẠY BÊN TRONG TAB TCM ĐANG MỞ — tự bấm hộ các nút tab thật trên trang (TCM ký mọi
// request bằng msToken/X-Bogus/X-Gnarly tính bởi JS của chính trang lúc user thao tác thật,
// không thể tự fetch() giả lập — hàm này chỉ tự động hoá việc click, không né bước ký request).
async function autoScanAndReadTcmProfile() {
  const TAB_LABELS = [
    { label: 'PPS', checkField: 'pps_score' },
    { label: 'Sample score', checkField: 'sample_credit_total_score' },
    { label: 'Sales', checkField: 'med_gmv_revenue' },
    { label: 'Collaboration metrics', checkField: 'collaborated_brands_num' },
    { label: 'Video', checkField: 'video_publish_cnt_30d' },
    { label: 'LIVE', checkField: 'live_streaming_cnt_30d' },
    { label: 'Followers', checkField: 'follower_genders_v2' },
    { label: 'Trends', checkField: null },
    { label: 'Example videos', checkField: 'top_video_data' },
  ];
  const MAX_WAIT_MS = 4000;
  const POLL_INTERVAL_MS = 200;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function normalizeText(s) {
    return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function looksClickable(el) {
    if (!el) return false;
    if (el.tagName === 'BUTTON' || el.tagName === 'A') return true;
    if (el.getAttribute && (el.getAttribute('role') === 'tab' || el.getAttribute('role') === 'button')) return true;
    try {
      return window.getComputedStyle(el).cursor === 'pointer';
    } catch (e) {
      return false;
    }
  }

  function pickClickableAncestor(el) {
    let node = el;
    for (let depth = 0; depth < 4 && node; depth++) {
      if (looksClickable(node)) return node;
      node = node.parentElement;
    }
    return el;
  }

  function findTabElement(label) {
    const all = document.querySelectorAll('body *');
    const exact = [];
    const loose = [];
    const wantLoose = normalizeText(label);
    for (const el of all) {
      const text = (el.textContent || '').trim();
      if (text === label) exact.push(el);
      else if (normalizeText(text).indexOf(wantLoose) === 0 && text.length <= label.length + 12) loose.push(el);
    }
    const candidates = exact.length > 0 ? exact : loose;
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    for (const el of candidates) {
      const clickable = pickClickableAncestor(el);
      if (looksClickable(clickable)) return clickable;
    }
    return candidates[0];
  }

  function isNearViewport(el, margin) {
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    return r.bottom >= -margin && r.top <= vh + margin;
  }

  // skipScroll: bỏ qua scrollIntoView vì đã biết chắc el đang nằm trong/gần khung nhìn rồi
  // (dùng khi bấm Retry vừa lộ ra lúc đang cuộn dần — không cần "nhảy" tới, chỉ bấm tại chỗ).
  async function fireClick(el, opts) {
    opts = opts || {};
    if (!opts.skipScroll && !isNearViewport(el, 0)) {
      try { el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' }); } catch (e) {}
      await sleep(320 + Math.random() * 220);
    }
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((type) => {
      try {
        el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      } catch (e) {}
    });
    try { el.click(); } catch (e) {}
  }

  // Trang creator details là 1 trang dài (PPS/Sample score/Sales/Collaboration/Video/LIVE/...
  // xếp chồng theo chiều dọc), nên nhiều mục có thể lỗi "Failed to load data" và hiện nút Retry
  // CÙNG LÚC — không chỉ 1 nút duy nhất ở đầu trang. Tìm và trả về TẤT CẢ nút Retry đang có.
  function findAllRetryButtons() {
    const all = document.querySelectorAll('body *');
    const seen = new Set();
    const buttons = [];
    for (const el of all) {
      if (el.children.length > 0) continue;
      const text = (el.textContent || '').trim();
      if (text !== 'Retry') continue;
      const target = pickClickableAncestor(el);
      if (seen.has(target)) continue;
      seen.add(target);
      buttons.push(target);
    }
    return buttons;
  }

  function hasLoadError() {
    return findAllRetryButtons().length > 0 || /Failed to load data/i.test(document.body.innerText || '');
  }

  // onlyVisible: chỉ bấm những nút Retry đang trong/gần khung nhìn NGAY LÚC NÀY — dùng trong lúc
  // cuộn dần để mô phỏng đúng thứ tự "đọc tới đâu xử lý tới đó" từ trên xuống, tránh nhảy thẳng
  // tới 1 nút Retry còn nằm sâu bên dưới (đã có trong DOM nhưng mắt người chưa "thấy" tới).
  async function clickAllRetryButtons(onlyVisible) {
    const buttons = findAllRetryButtons();
    const targets = onlyVisible ? buttons.filter((b) => isNearViewport(b, 150)) : buttons;
    for (const btn of targets) {
      await fireClick(btn, { skipScroll: true });
    }
    return targets.length;
  }

  // Cuộn dần xuống cuối trang theo từng đoạn ngẫu nhiên (thay vì scrollTo tức thì) để giống
  // thao tác cuộn chuột người thật, đồng thời bấm ngay mọi nút Retry lộ ra ở mỗi đoạn cuộn
  // (mục nào lỗi load sẽ hiện Retry đúng lúc cuộn tới, không đợi cuộn hết mới quay lại tìm).
  async function humanLikeScrollDown() {
    let lastY = -1;
    for (let i = 0; i < 12; i++) {
      window.scrollBy(0, 220 + Math.random() * 360);
      await sleep(160 + Math.random() * 260);
      await clickAllRetryButtons(true);
      const y = window.scrollY;
      const atBottom = Math.ceil(y + window.innerHeight) >= document.documentElement.scrollHeight;
      if (atBottom || y === lastY) break;
      lastY = y;
    }
    await sleep(200 + Math.random() * 200);
    window.scrollTo(0, 0);
    await sleep(150);
  }

  // Nếu trang vẫn còn (bất kỳ) nút Retry nào, tự bấm HẾT TẤT CẢ trong mỗi lượt, lặp lại (có
  // backoff) tới khi hết lỗi hoặc hết số lần thử. Trả về true nếu không còn lỗi khi kết thúc.
  async function autoRetryLoadErrors(maxAttempts) {
    let attempt = 0;
    while (attempt < maxAttempts) {
      const clickedCount = await clickAllRetryButtons();
      if (clickedCount === 0) return true;
      attempt++;
      await sleep(1000 + attempt * 400 + Math.random() * 500);
    }
    return !hasLoadError();
  }

  function currentProfile() {
    const id = window.__pickdi_tcm_last_profile_id;
    if (!id) return undefined;
    return (window.__pickdi_tcm_profiles || {})[id];
  }

  async function waitForField(checkField) {
    if (!checkField) { await sleep(700); return false; }
    const start = Date.now();
    while (Date.now() - start < MAX_WAIT_MS) {
      const profile = currentProfile();
      if (profile && profile[checkField] !== undefined) return true;
      await sleep(POLL_INTERVAL_MS);
    }
    return false;
  }

  const clicked = [];
  const notFound = [];
  const confirmed = [];
  const clickedButNoData = [];

  // Cuộn trang như người thật trước khi thao tác, rồi tự bấm Retry nếu trang mở lên
  // đã báo lỗi "Failed to load data" (xảy ra khá thường xuyên trên Creator details).
  await humanLikeScrollDown();
  const recoveredInitially = await autoRetryLoadErrors(6);
  if (!recoveredInitially) {
    return {
      error: 'Trang creator details báo lỗi "Failed to load data" và đã tự bấm Retry nhiều lần nhưng vẫn không load được — thử lại sau hoặc bỏ qua creator này.',
      clicked, notFound, confirmed, clickedButNoData,
    };
  }

  for (const tab of TAB_LABELS) {
    let el = findTabElement(tab.label);
    if (!el) {
      window.scrollTo(0, 0);
      await sleep(150);
      el = findTabElement(tab.label);
    }
    if (!el) {
      notFound.push(tab.label);
      continue;
    }
    await fireClick(el);
    clicked.push(tab.label);
    // Mỗi tab con (Sales, Video, LIVE...) có thể tự báo lỗi load riêng — retry tại chỗ
    // trước khi kiểm tra field, tránh bỏ sót data chỉ vì 1 lần load lỗi thoáng qua.
    await autoRetryLoadErrors(3);
    const gotField = await waitForField(tab.checkField);
    if (tab.checkField) {
      if (gotField) confirmed.push(tab.label);
      else clickedButNoData.push(tab.label);
    }
  }

  // Vài chỉ số bị thiếu sau lượt đầu không có nghĩa là hết hy vọng — click lại đúng những tab
  // đó thêm tối đa 2 lượt (kèm retry lỗi load) trước khi chấp nhận là thật sự thiếu, tránh báo
  // "quét đủ" trong khi chỉ là load chậm/lỗi thoáng qua ở 1 tab.
  for (let pass = 0; pass < 2 && clickedButNoData.length > 0; pass++) {
    const stillMissing = clickedButNoData.splice(0, clickedButNoData.length);
    await humanLikeScrollDown();
    for (const label of stillMissing) {
      const tab = TAB_LABELS.find((t) => t.label === label);
      if (!tab) continue;
      let el = findTabElement(tab.label);
      if (!el) {
        notFound.push(tab.label);
        continue;
      }
      await fireClick(el);
      await autoRetryLoadErrors(3);
      const gotField = await waitForField(tab.checkField);
      if (gotField) confirmed.push(tab.label);
      else clickedButNoData.push(tab.label);
    }
  }

  const id = window.__pickdi_tcm_last_profile_id;
  if (!id) {
    return {
      error: 'Không xác định được creator đang xem sau khi auto quét — hãy chắc trang chi tiết 1 creator đã mở và ít nhất 1 tab đã load được trước khi bấm.',
      clicked, notFound, confirmed, clickedButNoData,
    };
  }
  const profile = (window.__pickdi_tcm_profiles || {})[id];
  if (!profile) return { error: 'Không tìm thấy data đã bắt cho creator này.', clicked, notFound, confirmed, clickedButNoData };
  return { profile, clicked, notFound, confirmed, clickedButNoData };
}

// Mỗi field group dưới đây chỉ xuất hiện khi user đã tự click qua đúng tab con tương ứng trên
// TCM (mỗi tab gọi API marketplace/profile riêng, chỉ trả field của tab đó) — liệt kê rõ nhóm
// nào bắt được / còn thiếu để user biết ngay là do chưa xem hết tab hay do field TCM chưa xác
// nhận tên JSON.
const DETAIL_TAB_GROUPS = [
  { key: 'pps', label: 'PPS' },
  { key: 'sampleScore', label: 'Sample score' },
  { key: 'salesMetrics', label: 'Sales' },
  { key: 'collabMetrics', label: 'Collaboration metrics' },
  { key: 'videoMetrics', label: 'Video' },
  { key: 'liveMetrics', label: 'LIVE' },
  { key: 'demographics', label: 'Followers' },
  { key: 'recentVideos', label: 'Example videos' },
];

function summarizeCapturedGroups(detail) {
  const got = DETAIL_TAB_GROUPS.filter((g) => detail[g.key] != null).map((g) => g.label);
  const missing = DETAIL_TAB_GROUPS.filter((g) => detail[g.key] == null).map((g) => g.label);
  let msg = `Đã bắt: ${got.length > 0 ? got.join(', ') : '(không nhóm nào)'}.`;
  if (missing.length > 0) {
    msg += ` Còn thiếu: ${missing.join(', ')} — nếu chưa click qua các tab đó trên TCM thì hãy click qua rồi bấm lại nút này.`;
  }
  return msg;
}

// HÀM CHẠY TRỰC TIẾP TRÊN TRANG tiktok.com/@handle — đọc window.__pickdi_items do
// interceptor.js chặn từ API item_list thật ra số liệu engagement chính xác, không đoán.
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
