// One-time data migration — run locally, once, before cutting over to Supabase.
// Reads the existing local SQLite file (data/pickdi.db) directly with better-sqlite3
// (a devDependency kept only for this script — never bundled into the deployed app) and
// re-inserts every row into Supabase via the new src/db.ts functions.
//
// Usage: npx tsx scripts/migrate-sqlite-to-supabase.ts
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment (.env.local),
// and supabase/schema.sql already applied to the target Supabase project.
import dotenv from 'dotenv';
dotenv.config();

import path from 'path';
import fs from 'fs';
import Database from 'better-sqlite3';
import {
  rowToWorkspace,
  rowToCreator,
  rowToCampaign,
  rowToOutreach,
  rowToBulkOutreachJob,
  rowToConversation,
  rowToReview,
  rowToTask,
  rowToNotification,
  rowToActivity,
  rowToAssignment,
  rowToUnmatchedInboundEmail,
  saveWorkspace,
  saveCreator,
  saveCampaign,
  saveOutreach,
  saveBulkOutreachJob,
  saveConversation,
  saveReview,
  saveTask,
  saveNotification,
  saveActivity,
  saveAssignment,
  saveUnmatchedInboundEmail,
  setKpis,
  saveAgentPromptOverride,
  getAllWorkspaces,
  getAllCreators,
  getAllCampaigns,
  getAllOutreach,
  getAllConversations,
  getAllReviews,
  getAllTasks,
  getAllNotifications,
  getAllActivities,
  getAllAssignments,
  getUnresolvedUnmatchedInboundEmails,
} from '../src/db';
import { DashboardKPIs } from '../src/types';

const DB_PATH = path.join(process.cwd(), 'data', 'pickdi.db');

async function migrateTable<T>(
  label: string,
  rows: any[],
  mapRow: (row: any) => T,
  save: (item: T) => Promise<void>
) {
  let count = 0;
  for (const row of rows) {
    await save(mapRow(row));
    count++;
  }
  console.log(`  ${label}: migrated ${count} row(s)`);
}

async function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.error(`No local SQLite database found at ${DB_PATH} — nothing to migrate.`);
    process.exit(1);
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.example).');
    process.exit(1);
  }

  const sqlite = new Database(DB_PATH, { readonly: true });

  console.log(`Migrating ${DB_PATH} -> Supabase (${process.env.SUPABASE_URL})`);

  await migrateTable('workspaces', sqlite.prepare('SELECT * FROM workspaces').all(), rowToWorkspace, saveWorkspace);
  await migrateTable('creators', sqlite.prepare('SELECT * FROM creators').all(), rowToCreator, saveCreator);
  await migrateTable('campaigns', sqlite.prepare('SELECT * FROM campaigns').all(), rowToCampaign, saveCampaign);
  await migrateTable('outreach_emails', sqlite.prepare('SELECT * FROM outreach_emails').all(), rowToOutreach, saveOutreach);
  await migrateTable(
    'bulk_outreach_jobs',
    sqlite.prepare('SELECT * FROM bulk_outreach_jobs').all(),
    rowToBulkOutreachJob,
    saveBulkOutreachJob
  );
  await migrateTable('conversations', sqlite.prepare('SELECT * FROM conversations').all(), rowToConversation, saveConversation);
  await migrateTable('content_reviews', sqlite.prepare('SELECT * FROM content_reviews').all(), rowToReview, saveReview);
  await migrateTable('tasks', sqlite.prepare('SELECT * FROM tasks').all(), rowToTask, saveTask);
  await migrateTable('notifications', sqlite.prepare('SELECT * FROM notifications').all(), rowToNotification, saveNotification);
  await migrateTable('activities', sqlite.prepare('SELECT * FROM activities').all(), rowToActivity, saveActivity);
  await migrateTable(
    'creator_campaign_assignments',
    sqlite.prepare('SELECT * FROM creator_campaign_assignments').all(),
    rowToAssignment,
    saveAssignment
  );
  await migrateTable(
    'unmatched_inbound_emails',
    sqlite.prepare('SELECT * FROM unmatched_inbound_emails').all(),
    rowToUnmatchedInboundEmail,
    saveUnmatchedInboundEmail
  );

  // settings KV — kpis + agentPromptOverrides
  const kpisRow = sqlite.prepare("SELECT value FROM settings WHERE key = 'kpis'").get() as { value: string } | undefined;
  if (kpisRow?.value) {
    const kpis: DashboardKPIs = JSON.parse(kpisRow.value);
    await setKpis(kpis);
    console.log('  settings.kpis: migrated');
  }

  const overridesRow = sqlite.prepare("SELECT value FROM settings WHERE key = 'agentPromptOverrides'").get() as
    | { value: string }
    | undefined;
  if (overridesRow?.value) {
    const overrides: Record<string, string> = JSON.parse(overridesRow.value);
    for (const [agentId, customInstructions] of Object.entries(overrides)) {
      await saveAgentPromptOverride(agentId, customInstructions);
    }
    console.log(`  settings.agentPromptOverrides: migrated ${Object.keys(overrides).length} override(s)`);
  }

  // Verify row counts match between source and destination.
  console.log('\nVerifying row counts...');
  const checks: [string, number, () => Promise<{ length: number }>][] = [
    ['workspaces', (sqlite.prepare('SELECT COUNT(*) as c FROM workspaces').get() as any).c, getAllWorkspaces],
    ['creators', (sqlite.prepare('SELECT COUNT(*) as c FROM creators').get() as any).c, getAllCreators],
    ['campaigns', (sqlite.prepare('SELECT COUNT(*) as c FROM campaigns').get() as any).c, getAllCampaigns],
    ['outreach_emails', (sqlite.prepare('SELECT COUNT(*) as c FROM outreach_emails').get() as any).c, getAllOutreach],
    ['conversations', (sqlite.prepare('SELECT COUNT(*) as c FROM conversations').get() as any).c, getAllConversations],
    ['content_reviews', (sqlite.prepare('SELECT COUNT(*) as c FROM content_reviews').get() as any).c, getAllReviews],
    ['tasks', (sqlite.prepare('SELECT COUNT(*) as c FROM tasks').get() as any).c, getAllTasks],
    ['notifications', (sqlite.prepare('SELECT COUNT(*) as c FROM notifications').get() as any).c, getAllNotifications],
    ['activities', (sqlite.prepare('SELECT COUNT(*) as c FROM activities').get() as any).c, getAllActivities],
    ['creator_campaign_assignments', (sqlite.prepare('SELECT COUNT(*) as c FROM creator_campaign_assignments').get() as any).c, getAllAssignments as any],
    ['unmatched_inbound_emails', (sqlite.prepare('SELECT COUNT(*) as c FROM unmatched_inbound_emails').get() as any).c, getUnresolvedUnmatchedInboundEmails as any],
  ];
  let allOk = true;
  for (const [label, sourceCount, getDest] of checks) {
    const destCount = (await getDest()).length;
    const ok = destCount === sourceCount;
    if (!ok) allOk = false;
    console.log(`  ${label}: sqlite=${sourceCount} supabase=${destCount} ${ok ? 'OK' : 'MISMATCH'}`);
  }

  sqlite.close();
  console.log(allOk ? '\nDone — all row counts match.' : '\nDone — some row counts do not match, review above.');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
