/**
 * Helper utility để export creator data theo format Google Sheet
 * Khớp với ExportView.tsx COLUMNS structure
 */

import { Creator } from '../types';

export interface ExportOptions {
  format?: 'csv' | 'tsv'; // tsv dễ copy-paste vào Google Sheet
  includeEmptyColumns?: boolean; // bao gồm cột trống
}

const SECTION_HEADERS = [
  '1. Sourcing',
  '2. Outreach',
  '3. Quote & Nego',
  '4. Contract & Approval',
  '5. Brief',
  '6. Delivery & Payment',
  '7. Performance',
  '8. Status',
];

const COLUMN_HEADERS = [
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

// Map cột index sang section (cho merge cell ở row 1 của file gốc)
const COLUMN_TO_SECTION = [
  '1. Sourcing', // No.
  '1. Sourcing', // Creator ID
  '1. Sourcing', // VN Owner
  '1. Sourcing', // Listed Date
  '1. Sourcing', // TikTok Handle
  '1. Sourcing', // TikTok Link
  '1. Sourcing', // Email
  '1. Sourcing', // Main Category
  '1. Sourcing', // Demographic
  '1. Sourcing', // GMV/Video
  '1. Sourcing', // Why This Creator
  '', // O/X & Reason (không có section)
  '2. Outreach', // 1st Email Sent
  '2. Outreach', // Offer
  '2. Outreach', // Reply Status
  '2. Outreach', // Reply Date
  '3. Quote & Nego', // Quote Total
  '3. Quote & Nego', // Quoted Videos
  '3. Quote & Nego', // Quote per Video
  '3. Quote & Nego', // Quote Terms
  '3. Quote & Nego', // KR Target Price
  '3. Quote & Nego', // Final Price
  '3. Quote & Nego', // Final Videos
  '3. Quote & Nego', // Final per Video
  '3. Quote & Nego', // Commission
  '3. Quote & Nego', // Usage Rights
  '3. Quote & Nego', // KR Approval
  '3. Quote & Nego', // KR Approval Date
  '4. Contract & Approval', // Contract Draft
  '4. Contract & Approval', // Contract Sent
  '4. Contract & Approval', // Signed by d'Alba
  '4. Contract & Approval', // Separate Invoice
  '4. Contract & Approval', // Invoice No.
  '4. Contract & Approval', // KR Payment Req. Filed
  '4. Contract & Approval', // KR Payment Req. Appr.
  '5. Brief', // Brief / Guide Link
  '5. Brief', // Brief Sent
  '6. Delivery & Payment', // Videos Delivered
  '6. Delivery & Payment', // KR Delivery Check
  '6. Delivery & Payment', // Payment Method
  '6. Delivery & Payment', // Payment Account
  '6. Delivery & Payment', // KR Paid Amount
  '6. Delivery & Payment', // KR Paid Date
  '7. Performance', // Total GMV
  '7. Performance', // GMV per Video
  '7. Performance', // GMV / Fee
  '7. Performance', // KR Renewal Call
  '8. Status', // Stage
  '8. Status', // Notes
];

// Khớp creator data vào export columns
function mapCreatorToRow(creator: Creator, index: number): string[] {
  const row: string[] = [];

  COLUMN_HEADERS.forEach((header) => {
    switch (header) {
      case 'No.':
        row.push(String(index + 1));
        break;
      case 'Creator ID':
        row.push(creator.id || '');
        break;
      case 'VN Owner':
        row.push(creator.owner || '');
        break;
      case 'Listed Date':
        row.push(creator.createdAt ? creator.createdAt.split('T')[0] : '');
        break;
      case 'TikTok Handle':
        row.push(creator.handle || '');
        break;
      case 'TikTok Link':
        row.push(creator.profileUrl || '');
        break;
      case 'Email':
        row.push(creator.email || '');
        break;
      case 'Main Category (top 2)':
        row.push(creator.category || '');
        break;
      case 'Demographic':
        row.push(''); // Sẽ điền khi có demographics data
        break;
      case 'GMV/Video, Last 30d ($)':
        row.push(creator.gmv30d ? `$${creator.gmv30d}` : '');
        break;
      case 'Why This Creator':
        row.push(''); // Tính từ metrics
        break;
      case 'Notes':
        row.push(
          creator.notes
            ?.map((n) => n.content)
            .join(' | ') || ''
        );
        break;
      default:
        row.push(''); // Cột trống (để operator điền tay)
    }
  });

  return row;
}

export function creatorsToExportRows(
  creators: Creator[]
): { headers: string[]; sectionHeaders: string[]; rows: string[][] } {
  const headers = COLUMN_HEADERS;
  const sectionHeaders: string[] = [];

  // Khớp section headers (chỉ lặp 1 lần ở cột đầu tiên của mỗi section)
  let prevSection = '';
  COLUMN_TO_SECTION.forEach((section) => {
    if (section && section !== prevSection) {
      sectionHeaders.push(section);
      prevSection = section;
    } else {
      sectionHeaders.push('');
    }
  });

  const rows = creators.map((c, idx) => mapCreatorToRow(c, idx));

  return { headers, sectionHeaders, rows };
}

export function csvEscape(value: string): string {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function rowsToCsv(
  headers: string[],
  sectionHeaders: string[],
  rows: string[][]
): string {
  const lines: string[] = [];

  // Row 1: Section headers (merge cells)
  lines.push(sectionHeaders.map(csvEscape).join(','));

  // Row 2: Column headers
  lines.push(headers.map(csvEscape).join(','));

  // Data rows
  rows.forEach((row) => {
    lines.push(row.map(csvEscape).join(','));
  });

  return lines.join('\n');
}

export function rowsToTsv(
  headers: string[],
  sectionHeaders: string[],
  rows: string[][]
): string {
  const lines: string[] = [];

  // Row 1: Section headers
  lines.push(sectionHeaders.join('\t'));

  // Row 2: Column headers
  lines.push(headers.join('\t'));

  // Data rows (thay \n bằng space để dễ paste vào Google Sheet)
  rows.forEach((row) => {
    const tsvRow = row
      .map((v) => v.replace(/\t/g, ' ').replace(/\n/g, ' '))
      .join('\t');
    lines.push(tsvRow);
  });

  return lines.join('\n');
}

export function downloadExport(
  creators: Creator[],
  filename: string,
  format: 'csv' | 'tsv' = 'csv'
): void {
  const { headers, sectionHeaders, rows } = creatorsToExportRows(creators);

  let content: string;
  let mimeType: string;

  if (format === 'tsv') {
    content = rowsToTsv(headers, sectionHeaders, rows);
    mimeType = 'text/tab-separated-values';
  } else {
    content = rowsToCsv(headers, sectionHeaders, rows);
    mimeType = 'text/csv;charset=utf-8;';
  }

  // BOM để UTF-8 hiển thị đúng ở Excel
  const blob = new Blob(['﻿' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToClipboard(
  creators: Creator[],
  format: 'csv' | 'tsv' = 'tsv'
): Promise<void> {
  const { headers, sectionHeaders, rows } = creatorsToExportRows(creators);

  let content: string;
  if (format === 'tsv') {
    content = rowsToTsv(headers, sectionHeaders, rows);
  } else {
    content = rowsToCsv(headers, sectionHeaders, rows);
  }

  return navigator.clipboard.writeText(content);
}
