#!/usr/bin/env node

/**
 * Script để import danh sách creator handles vào database
 * Usage: npx ts-node scripts/import-creators.ts --handles "handle1,handle2,..." [--owner "VN Owner"] [--category "Category"]
 */

import * as fs from 'fs';
import * as path from 'path';
import { parseArgs } from 'util';

// Không thể import Supabase trực tiếp ở đây vì không có .env setup
// Thay vào đó, xuất dữ liệu JSON để import qua UI

interface CreatorImportData {
  handle: string;
  displayName: string;
  platform: 'TikTok' | 'Instagram' | 'YouTube';
  profileUrl: string;
  owner: string;
  category?: string;
  status: 'New Lead';
  metricsSource: 'manual';
  tags: string[];
}

function normalizeHandle(handle: string): string {
  return handle.replace(/^@/, '').toLowerCase().trim();
}

function createCreatorData(
  handle: string,
  owner: string,
  category?: string
): CreatorImportData {
  const normalized = normalizeHandle(handle);
  return {
    handle: normalized,
    displayName: normalized,
    platform: 'TikTok',
    profileUrl: `https://www.tiktok.com/@${normalized}`,
    owner,
    category,
    status: 'New Lead',
    metricsSource: 'manual',
    tags: [],
  };
}

async function main() {
  const { values } = parseArgs({
    options: {
      handles: { type: 'string' },
      file: { type: 'string' },
      owner: { type: 'string', default: 'System' },
      category: { type: 'string' },
      output: { type: 'string', default: 'creators-import.json' },
    },
  });

  let handles: string[] = [];

  if (values.file) {
    const filePath = path.resolve(values.file);
    const content = fs.readFileSync(filePath, 'utf-8');
    handles = content
      .split(/[\n,\s]+/)
      .map(h => normalizeHandle(h))
      .filter(Boolean);
    console.log(`✓ Đã đọc ${handles.length} handles từ file: ${filePath}`);
  } else if (values.handles) {
    handles = values.handles
      .split(/[,\s]+/)
      .map(h => normalizeHandle(h))
      .filter(Boolean);
    console.log(`✓ Đã parse ${handles.length} handles từ argument`);
  } else {
    console.error(
      'Error: Cần cung cấp --handles hoặc --file\n' +
      'Usage: npx ts-node scripts/import-creators.ts --handles "handle1,handle2" --owner "Owner Name" [--category "Beauty"]'
    );
    process.exit(1);
  }

  const owner = (values.owner as string) || 'System';
  const category = (values.category as string) || undefined;

  const creatorData = handles.map(h => createCreatorData(h, owner, category));

  const outputPath = path.resolve(values.output as string);
  fs.writeFileSync(outputPath, JSON.stringify(creatorData, null, 2), 'utf-8');

  console.log(`✓ Xuất ${creatorData.length} creators vào: ${outputPath}`);
  console.log('\nBước tiếp theo:');
  console.log('1. Mở ứng dụng và vào Import Creators');
  console.log('2. Chọn "Generic CSV/JSON"');
  console.log(`3. Upload file: ${outputPath}`);
  console.log('4. Kiểm tra và confirm import\n');
}

main().catch(console.error);
