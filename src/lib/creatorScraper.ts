import { Creator } from '../types';

export interface ScraperConfig {
  metricsSource?: 'tcm' | 'manual' | 'kalodata';
  owner?: string;
  category?: string;
  platform?: 'TikTok' | 'Instagram' | 'YouTube';
  country?: string;
}

// Normalize creator handle: remove @ prefix and lowercase
export function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase().trim();
}

// Create minimal creator record từ handle (để chuẩn bị cho cào thêm metrics sau)
export function createCreatorFromHandle(
  handle: string,
  config: ScraperConfig = {}
): Creator {
  const normalizedHandle = normalizeHandle(handle);
  const now = new Date().toISOString();

  return {
    id: `creator-${normalizedHandle}-${Date.now()}`,
    handle: normalizedHandle,
    displayName: normalizedHandle,
    platform: config.platform ?? 'TikTok',
    profileUrl: `https://www.tiktok.com/@${normalizedHandle}`,
    country: config.country,
    category: config.category,
    status: 'New Lead',
    owner: config.owner ?? 'System',
    bio: '',
    notes: [],
    tags: [],
    createdAt: now,
    updatedAt: now,
    metricsSource: config.metricsSource ?? 'manual',
  };
}

// Batch create creators từ danh sách handles
export function createCreatorsFromHandles(
  handles: string[],
  config: ScraperConfig = {}
): Creator[] {
  return handles.map(h => createCreatorFromHandle(h, config));
}

// Export creators thành TSV format (khớp ExportView)
export function creatorsToCsvRow(creators: Creator[]): string[][] {
  // Match cột headers từ ExportView
  const EXPORT_COLUMNS = [
    'No.',
    'Creator ID',
    'VN Owner',
    'Listed Date',
    'TikTok Handle',
    'TikTok Link',
    'Email',
    'Main Category (top 2)',
    'Demographic',
    'GMV/Video, Last 30d ($)',
    'Why This Creator',
    'O/X & Reason',
    '1st Email Sent',
    'Offer',
    'Reply Status',
    'Reply Date',
    'Quote Total ($)',
    'Quoted Videos',
    'Quote per Video ($)',
    'Quote Terms',
    'KR Target Price ($)',
    'Final Price ($)',
    'Final Videos',
    'Final per Video ($)',
    'Commission (%)',
    'Usage Rights (Spark)',
    'KR Approval',
    'KR Approval Date',
    'Contract Draft',
    'Contract Sent',
    "Signed by d'Alba",
    'Separate Invoice',
    'Invoice No.',
    'KR Payment Req. Filed',
    'KR Payment Req. Appr.',
    'Brief / Guide Link',
    'Brief Sent',
    'Videos Delivered',
    'KR Delivery Check',
    'Payment Method',
    'Payment Account',
    'KR Paid Amount ($)',
    'KR Paid Date',
    'Total GMV ($)',
    'GMV per Video ($)',
    'GMV / Fee (x)',
    'KR Renewal Call',
    'Stage',
    'Notes',
  ];

  const rows: string[][] = [];

  creators.forEach((creator, idx) => {
    const row = EXPORT_COLUMNS.map(col => {
      switch (col) {
        case 'No.':
          return String(idx + 1);
        case 'Creator ID':
          return creator.id;
        case 'VN Owner':
          return creator.owner || '';
        case 'TikTok Handle':
          return creator.handle;
        case 'TikTok Link':
          return creator.profileUrl || '';
        case 'Email':
          return creator.email || '';
        case 'Main Category (top 2)':
          return creator.category || '';
        case 'Demographic':
          return '';
        case 'GMV/Video, Last 30d ($)':
          return creator.gmv30d ? `$${creator.gmv30d}` : '';
        case 'Why This Creator':
          return '';
        default:
          return '';
      }
    });
    rows.push(row);
  });

  return rows;
}

// Export TSV format (để copy-paste vào Google Sheet)
export function rowsToTsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.join('\t');
  const dataLines = rows.map(r => r.map(v => v.replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t'));
  return [headerLine, ...dataLines].join('\n');
}

// Đọc danh sách handles từ string (mỗi dòng 1 handle, hoặc cách nhau bằng dấu phẩy/space)
export function parseHandlesFromText(text: string): string[] {
  return text
    .split(/[\n,\s]+/)
    .map(h => normalizeHandle(h))
    .filter(Boolean);
}
