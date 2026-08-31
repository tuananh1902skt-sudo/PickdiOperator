# Lộ trình khắc phục — Pickdi Operator

Nguồn duy nhất để theo dõi việc sửa lỗi từ đợt audit kỹ thuật ngày 2026-07-31.
Không cần link artifact nữa — mọi thông tin cần để sửa từng lỗi nằm trong file này.

## Cách dùng file này cho session mới

1. Mở session mới, nói kiểu: *"Đọc FIX_ROADMAP.md, làm mục P0-3"*, hoặc copy nguyên khối
   `### P0-3: ...` dán thẳng vào tin nhắn đầu tiên — cả hai cách đều đủ context, không cần
   dán lại báo cáo audit đầy đủ.
2. Mỗi mục là **độc lập** — chỉ cần đọc đúng mục đó + code liên quan là đủ để sửa, không cần
   đọc các mục khác trong file (trừ khi mục ghi rõ "phụ thuộc vào X").
3. Sửa xong, chạy đúng phần **Cách kiểm tra sau khi sửa**, rồi tự cập nhật ngay trong file này:
   - Đổi `Trạng thái` sang `✅ Xong` (hoặc `⚠️ Blocked` nếu vướng, ghi rõ vướng gì)
   - Điền `Ghi chú` — quyết định thiết kế đã chọn, đánh đổi, hoặc điều bất ngờ gặp phải
   - Cập nhật dòng tương ứng trong bảng tổng quan bên dưới
4. Đừng tạo file mới cho từng lỗi — mọi cập nhật đều nằm trong file này để session sau đọc được
   toàn bộ lịch sử.
5. Một `P` (P0/P1/P2/P3) có thể tách nhiều session — cứ làm 1-2 mục/session rồi dừng, không sao.

**Quy ước Trạng thái:** `⬜ Chưa làm` · `🔄 Đang làm` · `✅ Xong` · `⚠️ Blocked`
- **Ghi chú:** **Đừng chỉ set biến môi trường `API_KEY` để vá — làm vậy là app tự chết.** Middleware ở `server.ts` chặn MỌI request non-GET thiếu header `x-api-key`, mà frontend không gửi header đó ở bất kỳ đâu; bật lên là mọi nút bấm trong webapp 401. Kiểm tra 2026-09-01: `POST /api/__probe__` trên production trả **404 chứ không phải 401** → `API_KEY` chưa set, API đang mở hoàn toàn. Muốn đóng phải làm cả hai đầu cùng lúc.

---

## Bảng tổng quan tiến độ

| ID | Mức độ | Tên lỗi | Trạng thái |
|---|---|---|---|
| [P0-1](#p0-1-giới-hạn-gửi-email-ngày-là-bộ-đếm-suốt-đời) | Critical | Giới hạn email/ngày không reset | ✅ Xong |
| [P0-2](#p0-2-extension-chỉ-kết-nối-được-với-localhost) | Critical | Extension chỉ chạy trên localhost | ✅ Xong |
| [P0-3](#p0-3-api-không-bắt-buộc-xác-thực) | Critical | API không bắt buộc xác thực | ⚠️ Nửa chừng |
| [P0-4](#p0-4-không-phân-trang-getall-tự-cắt-ở-1000-dòng) | Critical | Không phân trang, cắt ở 1.000 dòng | ✅ Xong |
| [P0-5](#p0-5-không-có-ràng-buộc-unique-cho-handle-creator) | High | Không unique constraint cho handle | ⬜ Chưa làm |
| [P0-6](#p0-6-race-condition-khi-gửi-email-hàng-loạt) | High | Race condition gửi email hàng loạt | ✅ Xong |
| [P1-1](#p1-1-cờ-không-liên-hệ-nữa-không-có-ui) | High | do-not-contact không có UI | ⬜ Chưa làm |
| [P1-2](#p1-2-xoá-creator-không-dùng-transaction) | High | Xoá creator không transaction | ⬜ Chưa làm |
| [P1-3](#p1-3-bật-row-level-security-trên-supabase) | High | RLS chưa bật | ⬜ Chưa làm |
| [P1-4](#p1-4-thêm-ci-tối-thiểu) | High | Không có CI | ⬜ Chưa làm |
| [P1-5](#p1-5-secrets-lưu-plaintext-trong-app_config) | High | Secrets plaintext | ⬜ Chưa làm |
| [P1-6](#p1-6-extension-không-kiểm-tra-senderorigin) | High | Extension không check origin | ⬜ Chưa làm |
| [P1-7](#p1-7-lọc-workspaceid-ở-js-thay-vì-sql) | High | Lọc workspace ở JS không phải SQL | ⬜ Chưa làm |
| [P2-1](#p2-1-thêm-not-null--khoá-ngoại-vào-schema) | Medium | Thiếu FK/NOT NULL trong schema | ⬜ Chưa làm |
| [P2-2](#p2-2-thêm-index-còn-thiếu) | Medium | Thiếu index | ⬜ Chưa làm |
| [P2-3](#p2-3-tách-approuttsx-theo-domain-hook) | Medium | App.tsx quá lớn | ⬜ Chưa làm |
| [P2-4](#p2-4-tách-serverrouttsx-thành-routesservices) | Medium | server.ts quá lớn | ⬜ Chưa làm |
| [P2-5](#p2-5-hai-nguồn-sự-thật-cho-creator-campaign) | Medium | creatorIds trùng nguồn dữ liệu | ⬜ Chưa làm |
| [P2-6](#p2-6-thêm-structured-logging) | Medium | Thiếu structured logging | ⬜ Chưa làm |
| [P2-7](#p2-7-thu-hẹp-quyền-extension) | Medium | Quyền extension quá rộng | ⬜ Chưa làm |
| [P3-1](#p3-1-gộp-helper-fetch-dùng-chung) | Low | Trùng lặp fetch boilerplate | ⬜ Chưa làm |
| [P3-2](#p3-2-chuyển-xlsx-về-npm-registry) | Low | xlsx cài từ CDN | ⬜ Chưa làm |
| [P3-3](#p3-3-dọn-dependency-sqlite) | Low | Dọn dependency SQLite | ⬜ Chưa làm |
| [P3-4](#p3-4-dọn-comment-lạc-hậu--metadata) | Low | Comment lạc hậu, tên project | ⬜ Chưa làm |
| [P3-5](#p3-5-so-sánh-api-key-kiểu-constant-time) | Low | So sánh API key không an toàn thời gian | ⬜ Chưa làm |
| [P3-6](#p3-6-review-pháp-lýtuân-thủ-scraping--email) | Low | Rủi ro pháp lý scraping/email | ⬜ Chưa làm |

---

## P0 — Phải sửa trước khi mở rộng

### P0-1: Giới hạn gửi email/ngày là bộ đếm suốt đời
- **Vị trí:** `server.ts:1101-1103` (tăng counter), `server.ts:1362-1368` (điều kiện chặn), `src/db.ts:773-784` (`getKpis`/`setKpis`)
- **Vấn đề:** `kpis.todayEmailsSent` chỉ tăng, không có logic reset theo ngày ở bất kỳ đâu. Sau khi tổng số email gửi từ trước tới giờ vượt `dailyCap` (mặc định 80), mọi job outreach sau đó bị đánh dấu `done` ngay từ item đầu tiên, các item còn lại kẹt ở `draft` — không có lỗi hiển thị.
- **Hướng khắc phục:**
  1. Đổi cấu trúc lưu trong `getKpis`/`setKpis` (`src/db.ts:773-784`) từ `{ todayEmailsSent: number }` sang có kèm ngày, ví dụ `{ todayEmailsSent: number, countDate: string /* YYYY-MM-DD */ }`.
  2. Ở mọi chỗ đọc `kpis.todayEmailsSent` để so sánh với `dailyCap` (`server.ts:1362`) và mọi chỗ tăng counter (`server.ts:1101`), thêm bước: nếu `kpis.countDate !== ngày hôm nay (theo timezone workspace hoặc UTC — quyết định rõ và ghi vào Ghi chú)`, reset `todayEmailsSent = 0` và `countDate = hôm nay` trước khi so sánh/tăng.
  3. Cân nhắc viết một helper `getTodayEmailCount()` dùng chung thay vì sửa rải rác nhiều chỗ.
- **Cách kiểm tra sau khi sửa:**
  1. Set `dailyCap` thấp (vd. 2) qua UI/DB test, tạo bulk outreach job có 3 item, chạy — xác nhận đúng 2 item gửi rồi dừng đúng như cũ (không phá behavior cap trong-ngày).
  2. Giả lập "hôm qua đã gửi đủ cap": set thủ công `countDate` = ngày hôm qua trong DB, tạo job mới hôm nay — xác nhận job gửi được (không bị chặn bởi số đếm cũ).
  3. Kiểm tra dashboard KPI "today" vẫn hiển thị đúng số đã gửi trong ngày sau khi reset.
- **Trạng thái:** ✅ Xong
- **Ghi chú:** Sửa 2026-09-01. Thêm `countDate` vào `DashboardKPIs`; toàn bộ logic "đã sang ngày mới" nằm trong `rollDailyCounters()` ở `src/db.ts`, gọi từ bên trong `getKpis()` — mọi đường đọc KPI đều đi qua đó nên không thể quên reset ở một nhánh nào. **Chọn giờ VN (`Asia/Ho_Chi_Minh`), không phải UTC**: mốc sang ngày của UTC rơi đúng 7h sáng VN, reset giữa buổi làm sẽ cho gửi gấp đôi hạn mức trong cùng một ngày làm việc. Chỉ reset trên đường ĐỌC, không tự ghi xuống DB (getKpis còn được gọi ở chỗ chỉ xem); giá trị mới ghi xuống ở lần `setKpis` kế tiếp. Bản ghi cũ chưa có `countDate` rơi vào nhánh reset — đúng ý đồ. Giá trị thật lúc sửa là **1358 / cap 80**, tức mọi job outreach đang dừng ở `paused_cap` trước khi gửi được email đầu tiên. Đã test: kpiDayKey đúng ở cả 3 mốc quanh nửa đêm VN, cùng ngày giữ nguyên 5 → tăng được lên 6, countDate cũ → reset về 0.

---

### P0-2: Extension chỉ kết nối được với localhost
- **Vị trí:** `extension/manifest.json:23-28` (`externally_connectable.matches`)
- **Vấn đề:** Danh sách chỉ có `http://localhost:*/*` và `http://127.0.0.1:*/*`. Domain production (biến `APP_URL` mà server đã chuẩn bị CORS cho) không có trong danh sách → web app thật không gửi message được cho extension, tính năng "Auto quét + Lấy chi tiết" chết trên production.
- **Hướng khắc phục:**
  1. Xác nhận domain production thật đang dùng (đọc giá trị `APP_URL` trong `.env`/Vercel env, hoặc hỏi user nếu không rõ).
  2. Thêm domain đó vào `externally_connectable.matches` trong `extension/manifest.json`, ví dụ `"https://ten-mien-that.vercel.app/*"`. Giữ nguyên `localhost`/`127.0.0.1` cho dev.
  3. Nếu domain có thể đổi giữa các môi trường (preview deploy của Vercel có domain ngẫu nhiên), cân nhắc dùng pattern rộng hơn có kiểm soát (vd. `https://*.vercel.app/*` chỉ nếu chấp nhận được rủi ro, hoặc build một bước generate manifest theo từng môi trường) — quyết định và ghi vào Ghi chú.
  4. Sau khi sửa, phải **build lại và cài lại extension** (Chrome không tự update unpacked extension theo thời gian thực).
- **Cách kiểm tra sau khi sửa:**
  1. Mở web app ở domain production thật (không phải localhost), vào trang creator, bấm "Auto quét + Lấy chi tiết".
  2. Mở DevTools Console của extension (`chrome://extensions` → Inspect service worker) — xác nhận không có lỗi `Could not establish connection`.
  3. Xác nhận queue thực sự bắt đầu chạy (có log/UI phản hồi từ extension).
- **Trạng thái:** ✅ Xong
- **Ghi chú:** Đã có `https://pickdi-operator.vercel.app/*` trong `externally_connectable.matches` ở cả `extension/manifest.json` và `extension-v2/manifest.json`. Xác nhận lại 2026-09-01.

---

### P0-3: API không bắt buộc xác thực
- **Vị trí:** `server.ts:183-194` (middleware kiểm tra `x-api-key`, chỉ áp dụng cho non-GET), `.env.example` (API_KEY không bắt buộc)
- **Vấn đề:** `API_KEY` mặc định không được set; kể cả khi set, GET request vẫn không bị chặn — mọi endpoint đọc dữ liệu (creator, outreach, hội thoại...) công khai với ai biết URL.
- **Lưu ý phụ thuộc:** sửa mục này sẽ đụng tới cách extension gọi API (P1-6 liên quan) — nên xử lý cùng lúc hoặc đọc kỹ P0-2/P1-6 trước khi làm để tránh phá luồng batch-import của extension (tìm thấy trong audit: hiện extension không gửi `x-api-key` ở đâu cả).
- **Hướng khắc phục:**
  1. Quyết định cơ chế xác thực dùng lâu dài: tối thiểu là bắt buộc `API_KEY` (không cho chạy production nếu thiếu — fail fast ở startup), áp dụng cho **mọi method kể cả GET**, sửa ở `server.ts:183-194`.
  2. Đảm bảo frontend (`src/App.tsx` và mọi nơi gọi `fetch`) gửi kèm header xác thực đúng cách — cần một cơ chế để frontend biết secret (session cookie / login thật, hoặc key inject lúc build cho bản deploy nội bộ — cân nhắc mức độ cần thiết theo quy mô người dùng thực tế, ghi rõ lựa chọn vào Ghi chú).
  3. Đảm bảo extension gửi được key riêng của nó (xem P1-6) — không dùng chung key với frontend nếu muốn revoke độc lập.
  4. Nếu quyết định làm full login (không chỉ API key) thì đây là việc lớn hơn phạm vi 1 session — nên tách thành sub-task riêng, ghi rõ trong Ghi chú và không tự ý mở rộng scope.
- **Cách kiểm tra sau khi sửa:**
  1. `curl` trực tiếp một GET endpoint (vd. `/api/creators`) không kèm key — phải trả về 401, không trả dữ liệu.
  2. Đăng nhập/dùng app bình thường qua UI — mọi màn hình vẫn tải được dữ liệu như cũ.
  3. Chạy thử luồng extension batch-import — vẫn thành công (không bị 401).
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:** _(ghi rõ cơ chế xác thực đã chọn: chỉ API key hay có login thật)_

---

### P0-4: Không phân trang, `getAll*` tự cắt ở 1.000 dòng
- **Vị trí:** `src/db.ts` — toàn bộ hàm `getAll*` (`getAllCreators`, `getAllCampaigns`, `getAllAssignments`, và các hàm tương tự, ~24 chỗ dùng `select('*')` không có `.range()`/`.limit()`)
- **Vấn đề:** PostgREST mặc định trả tối đa 1.000 dòng/response. Không hàm nào chỉ định range → khi bảng vượt 1.000 dòng, phần dư bị cắt âm thầm, không lỗi, không cờ báo.
- **Hướng khắc phục:**
  1. Bắt đầu với các bảng dễ lớn nhất trước: `creators`, `outreach_emails`, `activities` (tra bằng `SELECT count(*) FROM <table>` trên Supabase để biết bảng nào gần ngưỡng 1.000 nhất — ưu tiên sửa bảng đó trước nếu muốn chia nhỏ ra nhiều session).
  2. Thêm tham số phân trang (`page`, `pageSize` hoặc `offset`, `limit`) vào chữ ký hàm `getAllX`, dùng `.range(offset, offset + pageSize - 1)`.
  3. Cập nhật route gọi hàm này trong `server.ts` để nhận query param phân trang từ client, trả kèm `total`/`hasMore`.
  4. Cập nhật phía frontend (nơi gọi các API danh sách này trong `src/App.tsx` và các view) để hỗ trợ phân trang hoặc "load more" — **đây là phần lớn nhất, có thể tách thành session riêng cho từng view** (creators, campaigns, outreach...).
  5. Nếu muốn fix nhanh tạm thời trước khi làm UI phân trang đầy đủ: ít nhất nâng giới hạn lên một con số an toàn hợp lý (vd. `.range(0, 9999)`) và log cảnh báo khi số dòng trả về chạm đúng giới hạn — để không mất dữ liệu ngay lập tức trong lúc chờ làm phân trang đàng hoàng. Ghi rõ đây là giải pháp tạm nếu chọn hướng này.
- **Cách kiểm tra sau khi sửa:**
  1. Chèn tạm >1.000 dòng test vào bảng `creators` (script hoặc SQL trực tiếp trên Supabase, xoá lại sau khi test), gọi API danh sách creators — xác nhận nhận đủ số dòng (qua phân trang hoặc qua range mở rộng).
  2. Xác nhận UI vẫn hiển thị đúng, không bị lỗi khi số lượng lớn.
  3. Dọn dữ liệu test đã chèn.
- **Trạng thái:** ✅ Xong
- **Ghi chú:** Đã phân trang thật bằng `.range(from, from + PAGE_SIZE - 1)`, bắn các trang song song. Xác nhận lại 2026-09-01 (`src/db.ts` 694/918/1047/1162).

---

### P0-5: Không có ràng buộc unique cho handle creator
- **Vị trí:** `supabase/schema.sql:90` (index hiện tại chỉ là index thường trên `lower(handle)`, không phải unique), `server.ts:534` (luồng batch-import: check-rồi-insert), `src/db.ts:886-892` (`getCreatorByHandle` dùng `ilike` không escape)
- **Vấn đề:** Hai vấn đề gộp: (a) không có ràng buộc unique thật ở DB nên 2 request đồng thời có thể tạo trùng creator; (b) `ilike` coi `_` là wildcard, handle TikTok hay có `_`, dễ khớp nhầm hoặc khớp nhiều dòng khiến `.maybeSingle()` ném lỗi.
- **Hướng khắc phục:**
  1. Thêm cột generated hoặc dùng index hiện có để tạo unique constraint: `ALTER TABLE creators ADD CONSTRAINT creators_handle_lower_unique UNIQUE (lower(handle));` (chạy trong Supabase SQL editor hoặc thêm vào `supabase/schema.sql` làm nguồn tham chiếu — xác nhận cách team đang quản lý migration, có dùng Supabase migration files hay chạy tay).
  2. Sửa `getCreatorByHandle` (`src/db.ts:886-892`) đổi `.ilike('handle', cleanHandle)` thành `.eq('handle', cleanHandle)` nếu đã có cột chuẩn hoá lowercase, hoặc escape `%`/`_` trước khi dùng ilike (thay `_` → `\_`, `%` → `\%`).
  3. Sửa luồng batch-import (`server.ts` quanh dòng 534 trở đi) từ "select rồi insert" sang `upsert(..., { onConflict: 'handle' })` để tận dụng constraint mới, tránh race condition.
- **Cách kiểm tra sau khi sửa:**
  1. Thử insert 2 creator cùng handle (khác hoa/thường) trực tiếp qua Supabase SQL — phải bị chặn bởi constraint.
  2. Test batch-import với handle có gạch dưới (vd. `jane_doe`) khi đã có creator `jane_doe` trong hệ thống — xác nhận được nhận diện là "đã tồn tại" (enrich), không tạo trùng, không lỗi.
  3. Gọi batch-import 2 lần gần như đồng thời (script gửi 2 request song song) với cùng 1 handle mới — xác nhận chỉ tạo ra 1 creator.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P0-6: Race condition khi gửi email hàng loạt
- **Vị trí:** `server.ts:1358-1368` (`sendNextBulkOutreachItem`)
- **Vấn đề:** Không có khoá/CAS khi chọn item tiếp theo để gửi. Double-click, 2 tab, hoặc QStash gửi lại webhook (at-least-once) có thể trùng chọn 1 item → gửi email 2 lần cho cùng creator.
- **Hướng khắc phục:**
  1. Tìm bước "chọn item draft tiếp theo" trong `sendNextBulkOutreachItem` — hiện chắc là select rồi update riêng. Đổi thành một update có điều kiện nguyên tử, ví dụ (dùng Supabase): update dòng có `status = 'draft'` thành `status = 'sending'` VÀ đọc kết quả trả về (`.select()` sau update) — nếu không có dòng nào trả về nghĩa là đã bị luồng khác lấy mất, thì dừng lại thay vì tiếp tục gửi.
  2. Nếu Supabase JS client không hỗ trợ update-conditional-trả-dòng-cũ tiện lợi, cân nhắc dùng một Postgres function (`rpc`) làm việc này trong 1 transaction ở DB để đảm bảo atomic thật sự.
  3. Đảm bảo bất kỳ nơi nào trigger `sendNextBulkOutreachItem` (webhook QStash, fire-and-forget sau khi tạo job) đều an toàn khi gọi trùng lặp (idempotent) sau khi sửa.
- **Cách kiểm tra sau khi sửa:**
  1. Viết script gọi endpoint trigger-gửi-item-tiếp-theo 2 lần gần như đồng thời (Promise.all 2 fetch) trên cùng 1 job — xác nhận chỉ 1 email thực sự được gửi (kiểm tra qua `outreach_emails` hoặc mailbox test), luồng còn lại phải nhận biết được là "đã có luồng khác xử lý" và không gửi trùng.
  2. Chạy lại luồng gửi bulk outreach bình thường (1 luồng duy nhất) — xác nhận vẫn gửi tuần tự đúng như cũ, không bị đứng do khoá.
- **Trạng thái:** ✅ Xong
- **Ghi chú:**

---

## P1 — Sửa sớm

### P1-1: Cờ "không liên hệ nữa" không có UI
- **Vị trí:** `src/types.ts:172` (định nghĩa `doNotContact`), đọc ở 3 chỗ trong luồng lọc outreach (tìm bằng `grep -rn doNotContact src/ server.ts`), UI: `src/components/creators/CreatorDetailDrawer.tsx`
- **Vấn đề:** Field tồn tại và được dùng để lọc, nhưng không có control nào trong UI để set giá trị `true`.
- **Hướng khắc phục:**
  1. Xác nhận field đã có sẵn trong schema Supabase (`supabase/schema.sql`) — nếu chưa, thêm cột `doNotContact boolean default false`.
  2. Thêm toggle/checkbox trong `CreatorDetailDrawer.tsx` (khu vực thông tin cơ bản hoặc khu vực hành động) để bật/tắt.
  3. Thêm API route hoặc dùng route update creator hiện có để lưu giá trị này xuống DB.
  4. Hiển thị badge/chip rõ ràng trong `CreatorListView.tsx` cho creator đang bật cờ này, để người vận hành không lỡ đưa vào campaign outreach.
- **Cách kiểm tra sau khi sửa:**
  1. Vào chi tiết 1 creator, bật cờ "Không liên hệ nữa", lưu lại, tải lại trang — xác nhận trạng thái được giữ.
  2. Thử thêm creator đó vào 1 bulk outreach job — xác nhận bị loại tự động khỏi danh sách gửi (hoặc có cảnh báo rõ ràng).
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P1-2: Xoá creator không dùng transaction
- **Vị trí:** `src/db.ts:908-925` (`deleteCreatorPermanently`)
- **Vấn đề:** 7 bước xoá tuần tự trên nhiều bảng, không transaction, không khoá ngoại backstop. Lỗi giữa chừng để lại dữ liệu mồ côi. `notifications` và `unmatched_inbound_emails.candidateCreatorIds` còn không được dọn trong mọi trường hợp.
- **Hướng khắc phục (chọn 1 trong 2, ưu tiên phương án A nếu có thời gian):**
  - **A (đúng nhất):** Viết một Postgres function (`create or replace function delete_creator_permanently(creator_id text) ... $$ language plpgsql`) gộp toàn bộ 7 bước xoá trong 1 transaction, gọi qua `db.rpc('delete_creator_permanently', { creator_id })` từ `src/db.ts`. Thêm luôn bước dọn `notifications` và `unmatched_inbound_emails` vào function này.
  - **B (nhanh hơn, không cần viết SQL function):** Giữ nguyên xoá tuần tự bằng JS nhưng đổi thứ tự để xoá bảng con trước bảng cha đúng chuẩn, bọc toàn bộ trong try/catch có ghi log rõ ràng bước nào fail, và thêm một job/route "dọn dữ liệu mồ côi" chạy định kỳ để phát hiện và dọn các bản ghi còn sót — chấp nhận đây là giải pháp tạm, kém hơn transaction thật.
  - Dù chọn phương án nào, phải thêm bước dọn `notifications` và `unmatched_inbound_emails.candidateCreatorIds` — hiện đang bị bỏ sót hoàn toàn.
- **Cách kiểm tra sau khi sửa:**
  1. Tạo 1 creator test có đầy đủ dữ liệu liên quan: outreach email, conversation, content review, posted video, task, notification.
  2. Xoá vĩnh viễn creator đó — kiểm tra từng bảng liên quan (`outreach_emails`, `conversations`, `content_reviews`, `posted_videos`, `tasks`, `notifications`) đều không còn bản ghi tham chiếu tới creator id đó.
  3. Nếu chọn phương án A: thử giả lập lỗi giữa chừng (vd. tạm sửa function để throw ở bước 4/7) — xác nhận **không có** bảng nào bị xoá dở (transaction rollback đúng).
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:** _(ghi rõ chọn phương án A hay B)_

---

### P1-3: Bật Row Level Security trên Supabase
- **Vị trí:** `supabase/schema.sql` (toàn bộ bảng, hiện 0 policy)
- **Vấn đề:** Không có lớp phòng thủ thứ hai ở tầng DB — mọi cách ly workspace chỉ dựa vào code đúng.
- **Hướng khắc phục:**
  1. Xác nhận backend hiện dùng `service_role` key (bypass RLS mặc định) hay `anon` key — nếu dùng `service_role` toàn bộ (khả năng cao dựa trên audit), bật RLS sẽ **không tự động** chặn được gì trừ khi cũng đổi cách backend query kèm policy được thiết kế để áp dụng ngay cả với service role, hoặc chuyển một phần truy vấn sang dùng `anon`/`authenticated` key có policy áp dụng. Quyết định hướng đi trước khi code — đây là quyết định kiến trúc, không chỉ chạy 1 câu SQL.
  2. Hướng khuyến nghị tối thiểu: bật RLS + viết policy theo `workspace_id` cho từng bảng multi-tenant, coi đây là lưới an toàn dự phòng nếu sau này có API dùng key giới hạn quyền hơn (không phải service role) — kể cả chưa dùng ngay, có sẵn policy đúng sẽ tránh phải làm lại từ đầu khi cần.
  3. `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` + `CREATE POLICY ... USING (workspace_id = current_setting('app.workspace_id')::text)` (hoặc cơ chế tương đương phù hợp với cách app set context) cho từng bảng đa-workspace.
- **Cách kiểm tra sau khi sửa:**
  1. Xác nhận app vẫn hoạt động bình thường sau khi bật RLS (không bị chặn nhầm dữ liệu hợp lệ) — test đầy đủ các luồng chính.
  2. Nếu có thể, thử query trực tiếp bằng `anon` key (không qua service role) — xác nhận không lấy được dữ liệu ngoài workspace được phép.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:** _(ghi rõ backend dùng service_role hay anon key, và policy áp dụng thế nào)_

---

### P1-4: Thêm CI tối thiểu
- **Vị trí:** không có file — cần tạo `.github/workflows/ci.yml` (hoặc tương đương nếu không dùng GitHub Actions)
- **Vấn đề:** Không có gì chặn code lỗi trước khi lên production. 5 lần vá khẩn cấp liên tiếp (commit `b852fc4` → `03988b2`) đều được phát hiện trực tiếp trên production.
- **Hướng khắc phục:**
  1. Tạo workflow chạy khi có PR/push: `npm ci`, `npm run lint` (tức `tsc --noEmit`), `npm run build` (chạy đúng lệnh build thật dùng cho production, bao gồm bước esbuild bundle `dist/server.mjs`).
  2. Thêm bước smoke test tối thiểu sau build: chạy `node dist/server.mjs` (cần set các env giả lập tối thiểu để không crash ngay), gọi thử 1 endpoint đơn giản (vd. health check nếu có, hoặc `/api/dashboard`) bằng `curl`, xác nhận trả về response hợp lệ (không phải lỗi crash/500 do vấn đề bundling).
  3. Nếu chưa có endpoint health check, cân nhắc thêm 1 route `/api/health` đơn giản trả `{ ok: true }` — hữu ích cho cả CI lẫn giám sát production sau này.
- **Cách kiểm tra sau khi sửa:**
  1. Tạo PR thử với một lỗi TypeScript cố ý — xác nhận CI fail đúng ở bước lint.
  2. Tạo PR thử với một lỗi chỉ lộ ra sau khi bundle (nếu có thể tái hiện kiểu lỗi giống các commit fix gần đây) — xác nhận CI fail ở bước smoke test, không phải chỉ pass lint suông.
  3. PR hợp lệ — xác nhận CI xanh hoàn toàn.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P1-5: Secrets lưu plaintext trong `app_config`
- **Vị trí:** bảng `app_config` trong Supabase (chứa mật khẩu SMTP, API key AI provider) — cần tìm chính xác các hàm đọc/ghi bảng này trong `src/db.ts`/`src/lib/emailConfig.ts`
- **Vấn đề:** Không mã hoá tại chỗ; kết hợp không RLS (P1-3), lộ dữ liệu Supabase = lộ luôn mọi secret.
- **Hướng khắc phục:**
  1. Cách đơn giản, ít rủi ro nhất: **chuyển các secret ra biến môi trường** (Vercel env vars) thay vì lưu trong bảng DB, nếu số lượng cấu hình này không cần thay đổi qua UI thường xuyên. Kiểm tra `src/lib/emailConfig.ts` xem UI có đang cho phép user tự nhập SMTP/API key qua Settings — nếu có, việc này cần giữ lại khả năng đó, không thể xoá thẳng.
  2. Nếu bắt buộc phải lưu trong DB (vì cần cấu hình qua UI theo từng workspace): mã hoá giá trị trước khi lưu bằng một khoá mã hoá lưu ở biến môi trường (vd. dùng Node `crypto` với AES-GCM), giải mã khi đọc để dùng, không bao giờ trả giá trị đã giải mã về cho frontend (chỉ hiện dạng che dấu như `••••1234`).
  3. Bất kể chọn hướng nào, rà lại toàn bộ nơi log các giá trị này (`console.log`) — đảm bảo không log ra secret dạng thô.
- **Cách kiểm tra sau khi sửa:**
  1. Query trực tiếp bảng `app_config` qua Supabase SQL editor — xác nhận giá trị SMTP password/API key không còn đọc được ở dạng plaintext (hoặc không còn tồn tại trong bảng này nếu đã chuyển sang env).
  2. Test luồng gửi email outreach thật — xác nhận vẫn gửi được bình thường sau khi đổi cách lưu.
  3. Vào Settings UI xem cấu hình SMTP/AI provider — xác nhận không hiển thị secret dạng thô.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:** _(ghi rõ chọn env var hay mã hoá trong DB)_

---

### P1-6: Extension không kiểm tra `sender.origin`
- **Vị trí:** `extension/background.js` (handler `onMessageExternal` / tương đương xử lý message từ web page)
- **Vấn đề:** Bất kỳ trang nào chạy trên `localhost:*`/`127.0.0.1:*` (không riêng gì web app Pickdi) có thể gửi lệnh cho extension bắt đầu quét dữ liệu TikTok và đẩy đi bất kỳ đâu (`webappUrl` tuỳ ý).
- **Hướng khắc phục:**
  1. Trong handler `chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {...})`, thêm kiểm tra đầu tiên: `if (!sender.url || !isAllowedOrigin(sender.url)) { return; }` — `isAllowedOrigin` kiểm tra origin khớp đúng domain Pickdi (localhost cho dev + domain production đã thêm ở P0-2).
  2. Không tin tưởng bất kỳ giá trị `webappUrl` nào gửi kèm trong message nếu nó dùng để xác định nơi gửi dữ liệu về — nên lấy origin thẳng từ `sender.url` đã được xác thực, không dùng giá trị do caller tự khai.
- **Cách kiểm tra sau khi sửa:**
  1. Mở 1 trang HTML tĩnh bất kỳ chạy trên `http://localhost:<port khác>` (không phải app Pickdi), thử gọi `chrome.runtime.sendMessage(extensionId, {...})` với payload giả lập lệnh quét — xác nhận extension từ chối/không phản hồi.
  2. Từ đúng web app Pickdi (đúng origin) — xác nhận lệnh vẫn hoạt động bình thường như cũ.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P1-7: Lọc `workspaceId` ở JS thay vì SQL
- **Vị trí:** `src/db.ts:838-877` và các hàm `getAll*` tương tự, `server.ts:1888-1923` (`scopedToWorkspace`)
- **Vấn đề:** Toàn bộ bảng được tải về rồi mới lọc theo `workspaceId` bằng `.filter()` trong Node — không dùng `WHERE`, không có index hỗ trợ.
- **Lưu ý phụ thuộc:** nên làm cùng lúc hoặc sau P0-4 (phân trang) vì cùng đụng vào các hàm `getAll*`.
- **Hướng khắc phục:**
  1. Thêm tham số `workspaceId` vào chữ ký các hàm `getAllX` liên quan, dùng `.eq('workspaceId', workspaceId)` ngay trong query Supabase thay vì filter sau khi có kết quả.
  2. Thêm index cho cột `workspaceId` trên các bảng đa-workspace trong `supabase/schema.sql` (`creators`, `campaigns`, `outreach_emails`, `conversations`, `content_reviews`, `tasks`, `notifications`, `activities`, `posted_videos`, `creator_campaign_assignments`).
  3. Cập nhật `scopedToWorkspace` (`server.ts:1888-1923`) và mọi call site để truyền `workspaceId` xuống tận query thay vì lọc kết quả đã tải về.
- **Cách kiểm tra sau khi sửa:**
  1. Tạo 2 workspace test, mỗi workspace vài creator riêng — xác nhận danh sách creator của mỗi workspace chỉ thấy đúng dữ liệu của mình.
  2. Dùng Supabase dashboard xem query plan (`EXPLAIN ANALYZE`) cho 1 truy vấn danh sách creator theo workspace — xác nhận dùng index, không phải seq scan toàn bảng.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

## P2 — Cải thiện quan trọng

### P2-1: Thêm NOT NULL + khoá ngoại vào schema
- **Vị trí:** `supabase/schema.sql` — toàn bộ `create table` (creators, campaigns, outreach_emails, conversations, content_reviews, posted_videos, tasks, creator_campaign_assignments, notifications, unmatched_inbound_emails, workspaces, app_config...)
- **Hướng khắc phục:**
  1. Rà từng bảng, đối chiếu với field bắt buộc trong `src/types.ts` (vd. `Creator.handle`, `Creator.status`, `Campaign.name`), thêm `NOT NULL` cho các cột thực sự bắt buộc.
  2. Thêm `FOREIGN KEY ... REFERENCES creators(id) ON DELETE CASCADE` (hoặc `SET NULL` tuỳ ý nghĩa nghiệp vụ) cho `creatorId` ở các bảng con; tương tự cho `campaignId REFERENCES campaigns(id)`, `workspaceId REFERENCES workspaces(id)`.
  3. **Cẩn thận:** trước khi add constraint, chạy query kiểm tra dữ liệu hiện có có vi phạm không (vd. `SELECT * FROM outreach_emails WHERE creatorId NOT IN (SELECT id FROM creators)`), dọn/xử lý dữ liệu vi phạm trước, nếu không lệnh `ALTER TABLE ADD CONSTRAINT` sẽ fail.
  4. Làm từng bảng một, test kỹ sau mỗi bảng — đừng đổi toàn bộ schema trong 1 lần chạy.
- **Cách kiểm tra sau khi sửa:**
  1. Sau mỗi constraint thêm vào, thử insert dữ liệu vi phạm (thiếu field bắt buộc, hoặc `creatorId` không tồn tại) qua SQL trực tiếp — xác nhận bị chặn.
  2. Chạy lại toàn bộ luồng chính của app (tạo creator, campaign, gán, xoá, outreach) — xác nhận không có gì bị lỗi do constraint mới quá chặt so với dữ liệu thực tế app đang ghi.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:** _(ghi bảng nào đã làm — có thể tách nhiều session, mỗi session vài bảng)_

---

### P2-2: Thêm index còn thiếu
- **Vị trí:** `supabase/schema.sql` — thiếu index trên `outreach_emails.creatorId/campaignId`, `conversations.creatorId`, `content_reviews.creatorId/campaignId`, `tasks.relatedCreatorId/relatedCampaignId`, `creators.email`
- **Hướng khắc phục:** Thêm `CREATE INDEX idx_<table>_<col> ON <table>(<col>);` cho từng cột liệt kê ở trên. Có thể phụ thuộc P1-7 nếu cùng lúc thêm index cho `workspaceId`.
- **Cách kiểm tra sau khi sửa:** Dùng `EXPLAIN ANALYZE` cho các truy vấn lọc theo các cột này trước/sau khi thêm index — xác nhận chuyển từ seq scan sang index scan khi bảng đủ lớn (với bảng nhỏ Postgres có thể vẫn chọn seq scan vì rẻ hơn — đó là bình thường, không phải lỗi).
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P2-3: Tách `App.tsx` theo domain (hook riêng)
- **Vị trí:** `src/App.tsx` (~1.240 dòng, 31 `useState`)
- **Hướng khắc phục:**
  1. Chọn 1 domain trước để làm mẫu (khuyến nghị bắt đầu với domain đơn giản nhất, ví dụ Tasks hoặc Notifications) — tạo `src/hooks/useTasks.ts` chứa state + các hàm CRUD liên quan tới task, chuyển logic từ `App.tsx` sang.
  2. Lặp lại cho từng domain: creators, campaigns, outreach, reviews — **mỗi domain có thể là 1 session riêng**, không cần làm hết trong 1 lần.
  3. `App.tsx` cuối cùng chỉ còn: gọi các hook, quản lý tab/routing, và truyền props xuống view — không còn chứa logic fetch/CRUD trực tiếp.
- **Cách kiểm tra sau khi sửa (áp dụng cho mỗi domain đã tách):**
  1. Chạy app, test đầy đủ chức năng của domain vừa tách (CRUD, các nút hành động liên quan) — hành vi phải giống hệt trước khi tách.
  2. Kiểm tra không có warning React mới (missing dependency trong useEffect, v.v.) xuất hiện do việc tách hook.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:** _(ghi rõ domain nào đã tách xong, domain nào còn lại)_

---

### P2-4: Tách `server.ts` thành routes/services
- **Vị trí:** `server.ts` (~2.130 dòng)
- **Hướng khắc phục:**
  1. Tạo `server/services/outreach.ts`, di chuyển `deliverOutreachEmail` và logic bulk-outreach state machine sang đó, export các hàm cần dùng.
  2. Tạo `server/routes/*.ts` theo nhóm resource (creators, campaigns, outreach, settings...), mỗi file chỉ chứa định nghĩa route + gọi service, không chứa logic nghiệp vụ trực tiếp.
  3. `server.ts` cuối cùng chỉ còn: khởi tạo app, mount middleware, mount routes.
  4. **Quan trọng:** làm xong mỗi bước phải chạy lại `npm run build` để đảm bảo bước bundle esbuild (nhạy cảm với cấu trúc import, xem `package.json` script `build`) vẫn hoạt động đúng — đây chính là loại thay đổi từng gây ra chuỗi sự cố production trước đây (xem P1-4).
- **Cách kiểm tra sau khi sửa:**
  1. `npm run build` chạy thành công, `node dist/server.mjs` khởi động không lỗi.
  2. Test lại toàn bộ endpoint chính bằng `curl` hoặc qua UI — hành vi không đổi.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P2-5: Hai nguồn sự thật cho creator-campaign
- **Vị trí:** `src/types.ts:256` (`Campaign.creatorIds`), `src/db.ts:665-693` (`assignCreatorToCampaign`), bảng `creator_campaign_assignments`
- **Hướng khắc phục:**
  1. Quyết định: bỏ `campaigns.creatorIds`, luôn suy ra danh sách creator của 1 campaign bằng query join với `creator_campaign_assignments` (đã có index từ trước theo audit Pass 5).
  2. Rà toàn bộ nơi đang đọc `campaign.creatorIds` trực tiếp (`grep -rn "creatorIds" src/ server.ts`), thay bằng hàm query mới (vd. `getCreatorIdsForCampaign(campaignId)`).
  3. Sau khi không còn nơi nào đọc `creatorIds`, xoá field này khỏi type và khỏi việc ghi xuống DB.
- **Cách kiểm tra sau khi sửa:**
  1. Gán/bỏ gán creator vào campaign qua UI — xác nhận danh sách creator trong campaign detail luôn đúng và nhất quán, kể cả sau khi 2 tab cùng thao tác gần như đồng thời.
  2. Xác nhận không còn nơi nào trong code đọc trường `creatorIds` cũ (grep lại để chắc chắn).
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P2-6: Thêm structured logging
- **Vị trí:** `server.ts` (toàn bộ `console.log`/`console.error`)
- **Hướng khắc phục:**
  1. Thêm một logger tối thiểu (vd. `pino`) log dạng JSON có `level`, `timestamp`, `context` (route, workspaceId nếu có) thay cho `console.log` thô.
  2. Rà các chỗ log dữ liệu nhạy cảm (email, token, secret) — đảm bảo không log giá trị thô.
  3. Cân nhắc thêm error tracking (Sentry hoặc tương đương) cho các lỗi unhandled — ít nhất là bắt lỗi ở global error handler hiện có (từ commit `43e4ebe`) và gửi đi thay vì chỉ log console.
- **Cách kiểm tra sau khi sửa:**
  1. Trigger 1 lỗi có chủ đích (vd. gọi API với dữ liệu sai) — xác nhận log xuất hiện dạng có cấu trúc, đọc được trên Vercel logs.
  2. Nếu có thêm error tracking — xác nhận lỗi test xuất hiện trên dashboard tracking.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

### P2-7: Thu hẹp quyền extension
- **Vị trí:** `extension/manifest.json` (`optional_host_permissions: ["http://*/*", "https://*/*"]`)
- **Hướng khắc phục:** Rà xem tính năng nào thực sự cần `optional_host_permissions` rộng như vậy (tìm chỗ gọi `chrome.permissions.request` trong `background.js`/`popup.js`) — nếu chỉ cần truy cập thêm 1-2 domain cụ thể (vd. domain webhook tuỳ chỉnh do user nhập), thu hẹp lại đúng nhu cầu thay vì xin toàn bộ web.
- **Cách kiểm tra sau khi sửa:** Test lại đúng tính năng đang cần optional permission — xác nhận vẫn hoạt động với quyền đã thu hẹp; xác nhận Chrome không còn hiện cảnh báo "truy cập mọi trang web" khi cài extension.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

---

## P3 — Cải thiện thêm

### P3-1: Gộp helper fetch dùng chung
- **Vị trí:** `src/App.tsx:220-269` và các đoạn tương tự (7+ chỗ) trong `refreshCreators`, `refreshAfterBulkOutreach`
- **Hướng khắc phục:** Viết 1 hàm `fetchJson<T>(url, opts)` xử lý parse JSON + check `success`/content-type nhất quán, thay thế các đoạn lặp lại.
- **Cách kiểm tra sau khi sửa:** Test lại các luồng đã đổi sang dùng helper mới — hành vi khi API lỗi/trả về không phải JSON phải giống hoặc tốt hơn trước (không silent fail nhiều hơn).
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

### P3-2: Chuyển `xlsx` về npm registry
- **Vị trí:** `package.json` — `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`
- **Hướng khắc phục:** Kiểm tra có bản `xlsx` chính thức trên npm registry publish bởi SheetJS chưa; nếu có, đổi sang version npm bình thường. Nếu vẫn phải dùng tarball, đảm bảo `package-lock.json` có ghi integrity hash cho nó.
- **Cách kiểm tra sau khi sửa:** `npm ci` chạy sạch từ đầu; tính năng export Excel trong app vẫn hoạt động đúng.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

### P3-3: Dọn dependency SQLite
- **Vị trí:** `package.json` devDependencies (`better-sqlite3`, `@types/better-sqlite3`), `scripts/migrate-sqlite-to-supabase.ts`
- **Hướng khắc phục:** Sau khi xác nhận chắc chắn không còn cần chạy lại migration (hỏi user để chốt), xoá dependency và di dời script migrate ra khỏi repo chính (hoặc archive) — **không tự ý xoá nếu chưa chắc migration đã ổn định lâu dài, hỏi trước khi làm mục này**.
- **Cách kiểm tra sau khi sửa:** `npm ci` không còn cài `better-sqlite3`; build và app vẫn chạy bình thường.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

### P3-4: Dọn comment lạc hậu + metadata
- **Vị trí:** `vite.config.ts:19-24` (comment nhắc SQLite như đang sống), `package.json:2` (`"name": "react-example"`)
- **Hướng khắc phục:** Cập nhật/xoá comment sai, đổi tên project trong `package.json` thành tên phù hợp (vd. `pickdi-operator`).
- **Cách kiểm tra sau khi sửa:** Build vẫn chạy bình thường sau khi đổi tên package (tên package thường không ảnh hưởng build trừ khi có nơi nào đó reference cứng — kiểm tra nhanh bằng grep tên cũ).
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

### P3-5: So sánh API key kiểu constant-time
- **Vị trí:** `server.ts:183-194` (chỗ so sánh `x-api-key` với `API_KEY`)
- **Hướng khắc phục:** Dùng `crypto.timingSafeEqual` (Node built-in) thay vì so sánh chuỗi trực tiếp (`===`), nhớ xử lý trường hợp độ dài khác nhau trước khi gọi (nếu không sẽ throw).
- **Cách kiểm tra sau khi sửa:** Gọi API với key đúng — pass; key sai (kể cả gần đúng, sai 1 ký tự cuối) — vẫn bị từ chối đúng như trước, không đổi hành vi chức năng, chỉ đổi cách so sánh.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**

### P3-6: Review pháp lý/tuân thủ scraping + email
- **Vị trí:** không phải lỗi code cụ thể — cần quyết định ở cấp sản phẩm/pháp lý, không tự ý code khi chưa rõ chủ trương
- **Vấn đề:** Hệ thống cào thông tin cá nhân creator (email, bio) rồi gửi email hàng loạt, trong khi cơ chế opt-out (`doNotContact`, xem P1-1) chưa hoạt động — có rủi ro liên quan luật chống spam/bảo vệ dữ liệu cá nhân tuỳ khu vực hoạt động.
- **Hướng khắc phục:** Sau khi P1-1 xong, cân nhắc thêm: (a) link unsubscribe thật trong template email outreach (nếu chưa có — kiểm tra `src/lib/emailTemplate.ts`), (b) ghi log/lưu trữ bằng chứng đồng ý hoặc cơ sở pháp lý gửi email nếu cần, (c) hỏi ý kiến người phụ trách pháp lý/kinh doanh trước khi thay đổi cách thu thập dữ liệu — mục này không nên tự động hoá quyết định mà không có chỉ đạo rõ ràng.
- **Cách kiểm tra sau khi sửa:** Tuỳ theo quyết định cụ thể được chốt — không có checklist chung.
- **Trạng thái:** ⬜ Chưa làm
- **Ghi chú:**
