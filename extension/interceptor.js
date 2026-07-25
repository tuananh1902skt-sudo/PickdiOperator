// Chạy ở world MAIN (cùng scope với trang TikTok thật) ngay từ document_start
// để chặn fetch/XHR và bắt trọn response của endpoint /api/post/item_list/
// (endpoint chứa toàn bộ stats video: playCount/diggCount/commentCount/shareCount/createTime).
(function () {
  if (window.__pickdi_patched) return;
  window.__pickdi_patched = true;
  window.__pickdi_items = window.__pickdi_items || {};

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

  const origFetch = window.fetch;
  window.fetch = function (...args) {
    const req = args[0];
    const url = (req && req.url) ? req.url : (typeof req === 'string' ? req : '');
    const p = origFetch.apply(this, args);
    if (url.includes('/api/post/item_list')) {
      p.then(function (res) {
        res.clone().text().then(ingest);
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
    if (this.__pickdi_url && String(this.__pickdi_url).includes('/api/post/item_list')) {
      this.addEventListener('load', function () {
        ingest(this.responseText);
      });
    }
    return origSend.apply(this, args);
  };
})();
