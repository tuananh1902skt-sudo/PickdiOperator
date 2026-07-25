// Chạy ở world MAIN (cùng scope với trang TikTok thật) ngay từ document_start
// để chặn fetch/XHR và bắt trọn response của endpoint /api/post/item_list/
// (endpoint chứa toàn bộ stats video: playCount/diggCount/commentCount/shareCount/createTime).
(function () {
  if (window.__pickdi_patched) return;
  window.__pickdi_patched = true;
  window.__pickdi_items = window.__pickdi_items || {};
  window.__pickdi_creator_cards = window.__pickdi_creator_cards || {};

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

  // Deep-merge nông nhiều lớp: response của MGetCreatorsCard được trang gọi lại nhiều lần
  // (mỗi lần user chuyển tab/sub-tab All/Branded/Non-branded, Most recent/Most popular) và
  // mỗi lần chỉ trả về MỘT PHẦN field (vd overallPerformance đổi theo filter đang chọn) ->
  // phải gộp dồn các lần gọi lại thay vì ghi đè toàn bộ, để không mất field đã bắt được trước đó.
  function deepMerge(target, source) {
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

  // aioCreatorID/ttUID là số 19 chữ số, vượt Number.MAX_SAFE_INTEGER -> phải bọc thành string
  // TRƯỚC khi JSON.parse để không bị làm tròn mất vài chữ số cuối (giống bug đã gặp ở QueryCreatorSquare).
  function ingestCreatorCard(text) {
    try {
      const safeText = text.replace(/"(aioCreatorID|ttUID)":(\d+)/g, '"$1":"$2"');
      const data = JSON.parse(safeText);
      if (data && Array.isArray(data.creators)) {
        data.creators.forEach(function (c) {
          const id = c.aioCreatorID || (c.creatorTTInfo && c.creatorTTInfo.aioCreatorID);
          if (!id) return;
          window.__pickdi_creator_cards[id] = deepMerge(window.__pickdi_creator_cards[id], c);
        });
      }
    } catch (e) {
      // response không phải JSON hợp lệ -> bỏ qua
    }
  }

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const req = args[0];
    const url = (req && req.url) ? req.url : (typeof req === 'string' ? req : '');
    const p = origFetch.apply(this, args);
    if (url.includes('/api/post/item_list')) {
      p.then(function (res) {
        res.clone().text().then(ingest);
      }).catch(function () {});
    } else if (url.includes('/CreativeOne/MatchPack/MGetCreatorsCard')) {
      p.then(function (res) {
        res.clone().text().then(ingestCreatorCard);
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
    if (url.includes('/api/post/item_list')) {
      this.addEventListener('load', function () {
        ingest(this.responseText);
      });
    } else if (url.includes('/CreativeOne/MatchPack/MGetCreatorsCard')) {
      this.addEventListener('load', function () {
        ingestCreatorCard(this.responseText);
      });
    }
    return origSend.apply(this, args);
  };
})();
