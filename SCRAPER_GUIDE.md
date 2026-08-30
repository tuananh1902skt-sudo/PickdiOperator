# Creator Scraper & Export Guide

## Overview

Bộ công cụ này giúp bạn:
1. **Nhập** danh sách creator handles từ file/clipboard
2. **Cào** metrics từ TikTok hoặc nhập thủ công
3. **Xuất** dữ liệu theo format Google Sheet d'Alba

## Quick Start

### 1. Import Creators (Nhập danh sách handles)

#### Option A: Từ file JSON (khuyên dùng)

File `creators-import-batch.json` đã có sẵn với 170 handles từ danh sách bạn cung cấp.

**Các bước:**
1. Mở ứng dụng → tab "Creators"
2. Click "Import Creators" button
3. Chọn "Generic CSV/JSON" import method
4. Upload `creators-import-batch.json`
5. Review dữ liệu (handle, owner, status) → confirm

#### Option B: Từ clipboard (nhanh)

```bash
# Copy danh sách handles vào clipboard (mỗi dòng 1 handle)
# Hoặc cách nhau bằng dấu phẩy/space

# Trong app: Import Creators → Paste here
# Mỗi handle sẽ tự động normalize (remove @, lowercase)
```

#### Option C: Từ text file

```bash
# Tạo file handles.txt (mỗi dòng 1 handle):
cat > handles.txt << 'EOF'
melmel.07
_daviontop
_ehlsie
... (thêm các handle khác)
EOF

# Convert sang JSON:
npx ts-node scripts/import-creators.ts --file handles.txt --owner "Tuấn Anh"

# Output: creators-import.json → upload qua UI
```

### 2. Enrich Creator Data (Cào thêm metrics)

#### Via TCM Extension (Khuyên dùng)

1. **Cài extension**: `extension/` folder
   - Chrome: Load unpacked → chọn folder extension
   
2. **Cào từng creator**:
   - Mở chi tiết creator
   - Click "Xem trên TCM" 
   - Extension sẽ auto-scrape: followers, GMV, demographics, category split
   - Data tự save vào database

#### Manual Input (Fallback)

- Mở chi tiết creator
- Nhập metrics: followers, GMV 30d, engagement rate, category
- Save

#### Bulk CSV Import (Kalodata/Cruva)

```bash
# File format: CSV với cột
# handle,followers,gmv30d,engagementRate,category,owner

# Ví dụ:
handle,followers,gmv30d,engagementRate,category
melmel.07,50000,500,3.5,Beauty
_daviontop,100000,1200,4.2,Fashion

# → Import via "Generic CSV" method trong app
```

### 3. Assign to Campaign

1. Tạo/chọn campaign (e.g., "d'Alba Product Q4")
2. Bulk assign creators:
   - Create Campaign Assignment
   - Chọn creators từ list
   - Batch assign (tối đa 50-100 lần)

### 4. Export for Google Sheet

#### Export View (Khuyên dùng)

```
UI Path: Campaigns → Select Campaign → Export View

Bước:
1. Chọn campaign
2. Chọn date (thường là hôm nay)
3. Review 49 cột (status, quote, contract, payment, GMV,...)
4. "Copy" → paste vào Google Sheet
   hoặc "Tải CSV" → open in Excel, adjust, upload
```

#### Programmatic Export

```typescript
// TypeScript/React component:
import { downloadExport, exportToClipboard } from '@/lib/exportCreators';

// Download CSV
downloadExport(creators, 'campaign-export.csv', 'csv');

// Copy TSV to clipboard (paste vào Google Sheet)
await exportToClipboard(creators, 'tsv');
```

## Available Utilities

### `src/lib/creatorScraper.ts`
- `normalizeHandle(handle: string)` - Remove @ prefix, lowercase
- `createCreatorFromHandle(handle, config)` - Create minimal creator record
- `createCreatorsFromHandles(handles, config)` - Batch create
- `parseHandlesFromText(text)` - Parse handles từ clipboard/file

### `src/lib/exportCreators.ts`
- `creatorsToExportRows(creators)` - Map to export format
- `rowsToCsv(headers, rows)` - Format as CSV
- `rowsToTsv(headers, rows)` - Format as TSV
- `downloadExport(creators, filename, format)` - Browser download
- `exportToClipboard(creators, format)` - Copy to clipboard

## Column Mapping (Google Sheet Export)

Export có 49 cột chia thành 8 sections:

```
1. Sourcing (11 cột)
   - Handle, Link, Owner, Email, Category, Demographics, GMV 30d, Why
   
2. Outreach (4 cột)
   - 1st Email Sent, Offer, Reply Status, Reply Date
   
3. Quote & Nego (8 cột)
   - Original Quote, Final Price, Video Count, Commission
   
4. Contract & Approval (7 cột)
   - Contract Draft, Signed, Invoice, Payment Approvals
   
5. Brief (2 cột)
   - Brief Link, Brief Sent Date
   
6. Delivery & Payment (5 cột)
   - Videos Delivered, Payment Method, Paid Amount, Paid Date
   
7. Performance (4 cột)
   - Total GMV, GMV per Video, GMV/Fee Ratio
   
8. Status (2 cột)
   - Stage, Notes
```

**Ghi chú**: 
- Cột [AUTO] (No., Quote per Video, GMV per Video, GMV/Fee, Stage) để trống (formula ở Google Sheet)
- Cột [VN]/[KR] chưa có data → operator tự gõ tay

## File Locations

```
/creators-import-batch.json        ← 170 handles ready to import
/scripts/import-creators.ts        ← CLI tool for custom batch
/src/lib/creatorScraper.ts         ← Core scraper utilities
/src/lib/exportCreators.ts         ← Export formatting
/src/components/export/ExportView.tsx ← UI component (49 cột)
```

## Workflow Example

### Scenario: Import 170 handles + assign to campaign + export

```bash
# Step 1: Import creators
# Upload: creators-import-batch.json via UI

# Step 2: Enrich with TCM (optional, recommended)
# For each creator:
#   - Click "Xem trên TCM"
#   - Extension auto-scrapes metrics
#   - Takes ~2 sec/creator (if Internet stable)

# Step 3: Create campaign
# UI: Campaigns → New Campaign → d'Alba Q4 Beauty Campaign

# Step 4: Assign creators to campaign
# Bulk assign: 170 creators → campaign
# Takes ~5-10 minutes for manual batch

# Step 5: Export for review
# ExportView → Select campaign + date → Copy TSV
# Paste vào Google Sheet → share với team d'Alba

# Step 6: Sync back
# d'Alba điền: quotes, contract links, payment info
# Re-download từ sheet, import updated data qua CSV
```

## Troubleshooting

### Q: Import không nhận handles
**A**: 
- Check format: mỗi dòng 1 handle hoặc cách nhau bằng dấu phẩy
- Remove @ prefix (auto-handled by parser)
- No special characters (đã validate ở normalizeHandle)

### Q: TCM extension không scrape được
**A**:
- Check extension installed + enabled
- Check internet connection
- Try manual refresh: Creator Detail → "Refresh TCM Data"
- Check browser console for errors

### Q: Export có cột trống / không khớp expected format
**A**:
- Verify creators have data (check Creator Detail)
- Export columns có 49 cột cố định (file gốc)
- Cột [AUTO] phải để trống để Google Sheet formula hoạt động
- Nếu cần customize: edit COLUMN_HEADERS ở exportCreators.ts

### Q: Google Sheet paste không hiển thị đúng
**A**:
- Use TSV format (copy to clipboard), không CSV download
- TSV khớp tab-separation của Sheet, CSV cần quote/escape
- Paste Special (⌘V) → thêm tùy chọn "Paste only data" nếu có format issues

## Advanced: Custom Scraper Hook

Để cào từ nguồn khác (Instagram, YouTube, Cruva API), thêm vào:

```typescript
// src/lib/scrapers/customSource.ts
export interface CustomMetrics {
  followers?: number;
  engagementRate?: number;
  category?: string;
  salesMetrics?: {
    gmv?: number;
    categorySplit?: { name: string; value: number }[];
  };
}

export async function scrapeCustomSource(handle: string): Promise<CustomMetrics> {
  // TODO: Implement API call
}

// Use:
const creator = await getCreatorById(id);
const metrics = await scrapeCustomSource(creator.handle);
creator.salesMetrics = metrics.salesMetrics;
await saveCreator(creator);
```

## Notes

- **Automation ready**: Tất cả functions có thể dùng ở server-side (Node.js agents)
- **Batch operations**: Khuyến cáo chia thành batch 50 creators/lần để tránh timeout
- **Data consistency**: Import idempotent (same handle imported 2x → không duplicate)
- **Performance**: Export 170 creators → 10-20MB JSON, ~3-5 sec to render
