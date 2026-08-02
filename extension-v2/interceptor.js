// Chạy ở world MAIN (cùng scope với trang thật) ngay từ document_start để chặn fetch/XHR:
// - trên www.tiktok.com: bắt trọn response của /api/post/item_list (stats video thật).
// - trên affiliate-us.tiktok.com (TCM/Affiliate Center): bắt response của 2 endpoint
//   marketplace/find (danh sách creator) và marketplace/profile (chi tiết creator).
(function () {
  if (window.__pickdi_patched) return;
  window.__pickdi_patched = true;
  window.__pickdi_items = window.__pickdi_items || {};
  window.__pickdi_tcm_list = window.__pickdi_tcm_list || {};
  window.__pickdi_tcm_profiles = window.__pickdi_tcm_profiles || {};
  window.__pickdi_tcm_last_pagination = window.__pickdi_tcm_last_pagination || null;

  function ingest(text) {
    try {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.itemList)) {
        data.itemList.forEach(function (item) {
          if (item && item.id) window.__pickdi_items[item.id] = item;
        });
      }
    } catch (e) {
      // response không phải JSON hợp lệ -> bỏ qua
    }
  }

  // TCM gọi marketplace/profile NHIỀU LẦN song song cho cùng 1 creator (xác nhận qua live
  // recon: 4 lần gọi cho 1 lần load trang chi tiết), mỗi lần trả về một tập field khác nhau —
  // và với field TCM CHƯA TÍNH XONG ở lần gọi đó (vd follower_genders_v2/follower_ages_v2 khi
  // lần gọi đó không thuộc nhóm Followers), field đó trả về dạng placeholder rỗng
  // {is_authorized, status} — KHÔNG có "value". Nếu 1 lần gọi khác (trước đó hoặc cùng lúc) đã
  // trả field đó với dữ liệu THẬT (vd mảng [{key:"female",value:"0.761"},...]), do các Promise
  // fetch resolve không theo thứ tự cố định, lần gọi có placeholder có thể merge SAU và xoá mất
  // dữ liệu thật đã bắt được — đây chính là nguyên nhân donut Gender/Age ở tab Followers luôn
  // rỗng dù UI web hiển thị đúng %. Fix: nếu source là placeholder rỗng và target đã có dữ liệu
  // thật (không phải placeholder), giữ nguyên target thay vì để placeholder ghi đè.
  function isPlaceholderStub(v) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
    const keys = Object.keys(v);
    return keys.length > 0 && keys.every(function (k) { return k === 'is_authorized' || k === 'status'; });
  }

  // Deep-merge nông nhiều lớp: response của marketplace/profile được trang gọi lại nhiều lần
  // (mỗi lần user chuyển tab PPS/Sample score/Sales/Video/LIVE/Followers/Trends) và mỗi lần
  // chỉ trả về MỘT PHẦN field -> phải gộp dồn thay vì ghi đè toàn bộ để không mất field đã bắt
  // được trước đó. Kỹ thuật giống hệt deepMerge dùng cho MGetCreatorsCard của bản TikTok One cũ.
  function deepMerge(target, source) {
    if (isPlaceholderStub(source) && target !== undefined && !isPlaceholderStub(target)) {
      return target;
    }
    if (Array.isArray(source)) return source;
    if (source && typeof source === 'object') {
      const out = (target && typeof target === 'object' && !Array.isArray(target)) ? { ...target } : {};
      for (const key of Object.keys(source)) {
        out[key] = deepMerge(out[key], source[key]);
      }
      return out;
    }
    return source;
  }

  function safeJsonParse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  // Field của endpoint marketplace/find (list) được bọc dạng {value, is_authorized, status}
  // (xác nhận từ recon Session 1) — bung ra giá trị thật để dễ đọc ở background.js/popup.js.
  function unwrapField(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && 'value' in v && ('is_authorized' in v || 'status' in v)) {
      return v.value;
    }
    return v;
  }

  function unwrapCreatorEntry(entry) {
    if (!entry || typeof entry !== 'object') return entry;
    const out = {};
    for (const key of Object.keys(entry)) out[key] = unwrapField(entry[key]);
    return out;
  }

  // CHƯA XÁC NHẬN tên field id chính xác trong response của marketplace/profile (Session 1
  // không recon được) -> dò tìm bất kỳ key nào khớp /creator_?oecuid/i ở vài lớp lồng nhau,
  // thay vì đoán cứng 1 path. Nếu không tìm thấy trong response, thử tìm trong body request
  // (thường creator_oecuid được gửi lên như tham số truy vấn).
  // marketplace/profile (chi tiết) bọc field theo ĐÚNG shape {value, is_authorized, status}
  // giống hệt marketplace/find (list) -- xác nhận thật từ DB: sau khi lưu, sampleScore.breakdown
  // có đủ key/label nhưng thiếu hẳn score, videoMetrics/liveMetrics rỗng {} -- vì
  // toNum()/parseMoney() ở popup.js nhận nguyên object {value,...} thay vì số thô nên luôn ra
  // NaN/undefined. unwrapCreatorEntry() cũ chỉ bung 1 lớp nông cho list; ở đây cần đệ quy toàn
  // bộ cây object/array vì creator_profile lồng nhiều tầng (industry_groups, follower_genders_v2,
  // sample_credit_*, top_video_data...). Giới hạn độ sâu để tránh vòng lặp vô hạn nếu response
  // có tham chiếu vòng bất thường.
  function deepUnwrapProfile(obj, depth) {
    if (depth > 8) return obj;
    if (Array.isArray(obj)) {
      return obj.map(function (v) { return deepUnwrapProfile(v, depth + 1); });
    }
    if (obj && typeof obj === 'object') {
      const unwrapped = unwrapField(obj);
      if (unwrapped !== obj) return deepUnwrapProfile(unwrapped, depth + 1);
      const out = {};
      for (const key of Object.keys(obj)) out[key] = deepUnwrapProfile(obj[key], depth + 1);
      return out;
    }
    return obj;
  }

  function findIdDeep(obj, depth) {
    if (!obj || typeof obj !== 'object' || depth > 3) return null;
    for (const key of Object.keys(obj)) {
      if (/creator_?oecuid/i.test(key)) {
        const v = unwrapField(obj[key]);
        if (v !== null && v !== undefined && v !== '') return String(v);
      }
    }
    for (const key of Object.keys(obj)) {
      const v = obj[key];
      if (v && typeof v === 'object') {
        const found = findIdDeep(v, depth + 1);
        if (found) return found;
      }
    }
    return null;
  }

  // Trang chi tiết TCM gọi marketplace/profile NHIỀU LẦN song song cho cùng 1 creator, nhưng
  // xác nhận qua live recon: lần gọi mang follower_genders_v2/follower_ages_v2 THẬT lại là
  // response "gọn" nhất — không chứa creator_oecuid ở bất kỳ đâu trong response lẫn request
  // body -> findIdDeep() ở trên trả về null cho đúng lần gọi có data quý nhất, khiến
  // ingestTcmProfile() bỏ qua thẳng response đó (an toàn nhưng mất data thật). URL trang chi
  // tiết luôn có dạng .../creator/detail?cid=<id> nên id có thể lấy trực tiếp từ đó, không phụ
  // thuộc nội dung response nào cả.
  function getCidFromLocation() {
    try {
      const m = String(location.search || '').match(/[?&]cid=([^&]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  function ingestTcmFind(text) {
    try {
      const data = JSON.parse(text);
      const list = data && data.creator_profile_list;
      if (Array.isArray(list)) {
        list.forEach(function (entry) {
          const flat = unwrapCreatorEntry(entry);
          const id = flat.creator_oecuid;
          if (id) window.__pickdi_tcm_list[String(id)] = flat;
        });
      }
      if (data && data.next_pagination) {
        window.__pickdi_tcm_last_pagination = data.next_pagination;
      }
    } catch (e) {
      // response không phải JSON hợp lệ -> bỏ qua
    }
  }

  function ingestTcmProfile(text, reqBodyText) {
    try {
      const data = JSON.parse(text);
      const profile = data && data.creator_profile;
      if (!profile) return;
      const id = findIdDeep(profile, 0) || findIdDeep(safeJsonParse(reqBodyText), 0) || getCidFromLocation();
      if (!id) return; // không xác định được creator nào -> bỏ qua thay vì gộp nhầm sang creator khác
      const unwrappedProfile = deepUnwrapProfile(profile, 0);
      window.__pickdi_tcm_profiles[id] = deepMerge(window.__pickdi_tcm_profiles[id], unwrappedProfile);
      // Không có URL trang chi tiết riêng biệt đã xác nhận cho TCM (khác hẳn TikTok One có
      // /creator/profile/:id) -> lưu id của lần merge GẦN NHẤT để nút "Lấy chi tiết trang này"
      // trong popup biết đọc đúng creator user vừa mở, thay vì phải parse URL.
      window.__pickdi_tcm_last_profile_id = id;
    } catch (e) {
      // response không phải JSON hợp lệ -> bỏ qua
    }
  }

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const req = args[0];
    const url = (req && req.url) ? req.url : (typeof req === 'string' ? req : '');
    const opts = args[1];
    const reqBodyText = (opts && typeof opts.body === 'string') ? opts.body : undefined;
    const p = origFetch.apply(this, args);
    if (url.includes('/api/post/item_list')) {
      p.then(function (res) {
        if (res && res.clone) {
          res.clone().text().then(ingest).catch(function () {});
        }
      }).catch(function () {});
    } else if (
      url.includes('/api/v1/oec/affiliate/creator/marketplace/find') ||
      url.includes('/api/v1/oec/affiliate/creator/marketplace/ai/find')
    ) {
      // "marketplace/ai/find" là endpoint riêng cho ô "AI search" (gõ mô tả/handle rồi tìm) —
      // response CÙNG shape hệt "marketplace/find" thường (đã xác nhận qua recon thật: cùng
      // {code,message,next_pagination,creator_profile_list} + cùng field {value,is_authorized,
      // status}), chỉ khác URL nên trước đây không match, khiến search-by-handle luôn "no_match"
      // dù TCM đã tìm ra đúng creator (UI hiện đúng, chỉ là interceptor không bắt được response).
      p.then(function (res) {
        if (res && res.clone) {
          res.clone().text().then(ingestTcmFind).catch(function () {});
        }
      }).catch(function () {});
    } else if (url.includes('/api/v1/oec/affiliate/creator/marketplace/profile')) {
      p.then(function (res) {
        if (res && res.clone) {
          res.clone().text().then(function (text) { ingestTcmProfile(text, reqBodyText); }).catch(function () {});
        }
      }).catch(function () {});
    }
    return p;
  };

  const OrigXHR = window.XMLHttpRequest;
  const origOpen = OrigXHR.prototype.open;
  const origSend = OrigXHR.prototype.send;
  OrigXHR.prototype.open = function (method, url) {
    this.__pickdi_url = url;
    return origOpen.apply(this, arguments);
  };
  OrigXHR.prototype.send = function (...args) {
    const url = String(this.__pickdi_url || '');
    const reqBodyText = (typeof args[0] === 'string') ? args[0] : undefined;
    if (url.includes('/api/post/item_list')) {
      this.addEventListener('load', function () {
        ingest(this.responseText);
      });
    } else if (
      url.includes('/api/v1/oec/affiliate/creator/marketplace/find') ||
      url.includes('/api/v1/oec/affiliate/creator/marketplace/ai/find')
    ) {
      this.addEventListener('load', function () {
        ingestTcmFind(this.responseText);
      });
    } else if (url.includes('/api/v1/oec/affiliate/creator/marketplace/profile')) {
      this.addEventListener('load', function () {
        ingestTcmProfile(this.responseText, reqBodyText);
      });
    }
    return origSend.apply(this, args);
  };
})();
