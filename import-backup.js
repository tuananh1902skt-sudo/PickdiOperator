import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = process.env.SUPABASE_URL;
const DB_PASSWORD = 'U6ddkvUqjMV3/6B';

if (!SUPABASE_URL) {
  console.error('❌ Missing SUPABASE_URL in .env.local');
  process.exit(1);
}

// Extract host from Supabase URL
const hostMatch = SUPABASE_URL.match(/https:\/\/([^.]+)\./);
const host = hostMatch ? `${hostMatch[1]}.supabase.co` : null;

if (!host) {
  console.error('❌ Could not extract host from SUPABASE_URL');
  process.exit(1);
}

const pool = new pg.Pool({
  host,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: DB_PASSWORD,
  ssl: {
    rejectUnauthorized: false,
    sslmode: 'require'
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000
});

const backupDir = path.join(__dirname, 'Database backup');

// Import order (respecting foreign key constraints)
const importOrder = [
  'workspaces_rows.sql',
  'app_config_rows.sql',
  'settings_rows.sql',
  'campaigns_rows.sql',
  'creators_rows.sql',
  'creator_campaign_assignments_rows.sql',
  'bulk_outreach_jobs_rows.sql',
  'conversations_rows.sql',
  'outreach_emails_rows.sql',
  'notifications_rows.sql',
  'activities_rows.sql'
];

async function importBackup() {
  const client = await pool.connect();

  try {
    console.log(`📡 Connecting to: ${host}`);
    console.log(`🔐 Connected successfully!\n`);

    console.log(`📂 Import order:`);
    importOrder.forEach((f, i) => console.log(`   ${i + 1}. ${f}`));
    console.log('\n🚀 Importing data...\n');

    for (const file of importOrder) {
      const filePath = path.join(backupDir, file);

      if (!fs.existsSync(filePath)) {
        console.log(`⏭️  Skipping ${file} (not found)`);
        continue;
      }

      const sql = fs.readFileSync(filePath, 'utf-8');

      if (!sql.trim()) {
        console.log(`⏭️  Skipping ${file} (empty)`);
        continue;
      }

      process.stdout.write(`📥 Importing ${file}... `);

      try {
        await client.query(sql);
        console.log(`✅`);
      } catch (err) {
        console.log(`❌ ${err.message.split('\n')[0]}`);
      }
    }

    console.log('\n✅ Backup import completed!');
  } catch (err) {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

importBackup();
