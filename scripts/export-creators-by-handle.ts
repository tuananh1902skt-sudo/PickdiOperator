// Truy xuất data creator đã có trong DB theo danh sách handle cho trước, rồi xuất ra CSV
// đúng format 49 cột của module Export (src/components/export/ExportView.tsx) — không tạo
// data giả, chỉ điền những gì hệ thống đã có; cột nào chưa có data (chưa cào TCM, chưa gán
// campaign, chưa có quote/contract/payment...) để trống đúng như hành vi của ExportView.
//
// Chạy: npx tsx scripts/export-creators-by-handle.ts
import dotenv from 'dotenv';
dotenv.config();
import * as fs from 'fs';
import * as path from 'path';
import { getCreatorByHandle, getAllAssignments, getAllOutreach, getAllPostedVideos, getAllConversations } from '../src/db';
import { Creator, CreatorCampaignAssignment, OutreachEmail, PostedVideo, Conversation } from '../src/types';

const HANDLES = `
.melmel.07
_daviontop
_ehlsie
aaliyaahja
abadora_
adamrayokay
akerns_yo
alanamolden
alexatiziani
alienmeir
alishamarie
alissa.ashley
alyinamichelle
alyssamascarello
amandacardinal17
amaniwortham
amber.nic0lle
anthonypert
antoniagorgaa
ariellecalimquim
armanifaun
aroseslimes
ashleynicolequiroz
ashleytheebarroness
august_skyz
avalahey
beautybarcosmetics
beautyboutiquelive
beautysellerlive
bellarmrz
bentleymescall.2
bettyyannhill
bigsisofanime
blondie.fro
bmotheprince
boujeebehindbars
brianjordanalvarez
brooklynn_mullins
bulletproof.l0v3
bunnydayoff
bybluety
calleighpaige07
camfant
carlyrivlin
cassidybriannagrace
certainlynotcammy
certifiedyesmaam
chanelleadjei
charleighmoriss
chrissydumpster
chynauniqueasmr
creationsbynellyslashes
dakitista
dananozime
danessyauguste
ddp8792
derekscents
dewylouie
donniip
drabby6
edenrees.1
eloisedufka
emskingg
evessortiz
florencedure
flourishinglydifferent
gemzeez
genbthegem
glambyjerr
hannahcorallo
hollybeaves
hoperyangrwm
humble_beginnings26
iamava.d
ibbydadoll
imanisarzo
inatalieking
itsalyssaeells
itsnaomimarie
ivy4evr
jaderainbeauty
jessilynnsta
joiya.brown
kaavikiwi
kawaiiicoco
kealohilxni
keyajames
lahony69
laurenrbarnwell
lauu_kzallaz
lebaneseangel22
lex.delarosa
lexiehulll
lexx_masee1029
lifewith_nicolasa
lifewithadrienne
lillianphan
literallykeeks
luckyjjanga
maccosmeticsusa
maddiegmua
madisynmenchaca
mallorieworkman
malyorie_10
mamaandherdaughters
marcus.dipaola
matt.do.it
maydelisgonzalez0
mayra_arreola
meaganandjonathan
meimonte1
miharu_ahhui05
milkydew
mirasingh524
missprettygirl
miyswag
monica.raviii
morganhsears
officialericaaam
oldfashonedhussle
orphicbeautyofficial
paigelorenze
pattiandjoanne
pcos_babe
perfumeprincess
rhegancoursey
rickaelll
ricotaquito
rogerwh0
rupaulofficial
sagethomass
samanthalynn_xo
sammyyohh
sanrizzle
sarasimone101
seductiveexcellence
sophiagracekellyy
spencewuah
spookyseasonftw
ssophiaquintero
susanims
sxrahferg
sydneycleavy
teamessenceee
thatastrogirlie
thebriannabalram
thelaratoma
themarianasmith
theosburnfamily
underbrushjosh
viclasala
victoriavillarroell
wasanalobeidi
waxingqueenadventures
wh0s.naniiii
xonajsaaa_
yinxairy
yohanaortizzz
yungtiffonthebeat
`
  .split('\n')
  .map(h => h.replace(/^@/, '').trim())
  .filter(Boolean);

function toLocalDateStr(iso: string | undefined | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fmt(v: string | number | boolean | undefined | null): string {
  if (v === undefined || v === null) return '';
  if (typeof v === 'boolean') return v ? 'x' : '';
  return String(v);
}

function roundPct(v: number, digits: number): string {
  const rounded = Number(v.toFixed(digits));
  return String(rounded);
}

function categoryTop2(creator?: Creator): string {
  const split = creator?.salesMetrics?.categorySplit?.filter(c => c.name !== '-1');
  if (split && split.length > 0) {
    return [...split]
      .sort((a, b) => b.value - a.value)
      .slice(0, 2)
      .map((c, i) => `${i + 1}. ${c.name} ${roundPct(c.value, 1)}%`)
      .join('\n');
  }
  return fmt(creator?.category);
}

function demographicStr(creator?: Creator): string {
  const demo = creator?.demographics;
  if (!demo?.topGender) return '';
  const pct = demo.topGender === 'Female' ? demo.genderFemale : demo.topGender === 'Male' ? demo.genderMale : undefined;
  return pct !== undefined ? `${demo.topGender} ${roundPct(pct, 2)}%` : demo.topGender;
}

function formatUsdShort(v: number | undefined | null): string {
  if (v === undefined || v === null || Number.isNaN(v)) return '';
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  let short: string;
  if (abs >= 1e9) short = `${Math.round(abs / 1e9)}b`;
  else if (abs >= 1e6) short = `${Math.round(abs / 1e6)}m`;
  else if (abs >= 1e3) short = `${Math.round(abs / 1e3)}k`;
  else short = String(Math.round(abs));
  return `${sign}$${short}`;
}

function whyThisCreator(creator?: Creator): string {
  if (!creator) return '';
  const facts: string[] = [];

  const gmv = creator.gmv30d;
  if (gmv !== undefined && gmv > 0) facts.push(`GMV 30d ${formatUsdShort(gmv)}`);

  const beautyRatio = creator.beautyCategoryRatio
    ?? creator.salesMetrics?.categorySplit?.find(c => c.name.toLowerCase().includes('beauty'))?.value;
  if (beautyRatio !== undefined) facts.push(`${roundPct(beautyRatio, 0)}% revenue from beauty category`);

  const demo = creator.demographics;
  if (demo?.topGender && demo?.topAgeGroup) {
    facts.push(`top audience ${demo.topGender} ${demo.topAgeGroup}${demo.topCountry ? ` in ${demo.topCountry}` : ''}`);
  }

  if (creator.engagementRate !== undefined && creator.engagementRate >= 7) {
    facts.push(`engagement ${roundPct(creator.engagementRate, 1)}% above average`);
  }

  if (facts.length === 0) return '';

  const collabCount = creator.collabMetrics?.brandCollabCount;
  const isTopTier = creator.gmvTier === 'L4' || creator.gmvTier === 'L5';

  let conclusion = '';
  if (isTopTier) {
    conclusion = collabCount ? `safe pick, already collabed with ${collabCount} other brands` : 'safe pick';
  } else if (beautyRatio !== undefined && beautyRatio >= 50) {
    conclusion = 'strong fit for the category';
  } else if ((gmv === undefined || gmv < 5000) && creator.engagementRate !== undefined && creator.engagementRate >= 7) {
    conclusion = 'good candidate to test a new product';
  }

  return conclusion ? `${facts.slice(0, 3).join(', ')} — ${conclusion}.` : `${facts.slice(0, 3).join(', ')}.`;
}

interface RowContext {
  creator?: Creator;
  assignment?: CreatorCampaignAssignment;
  emails: OutreachEmail[];
  totalGmv?: number;
  conversation?: Conversation;
}

type ExportColumn = { section?: string; header: string; get: (ctx: RowContext) => string };

const COLUMNS: ExportColumn[] = [
  { section: '1. Sourcing', header: 'No.', get: () => '' },
  { section: '1. Sourcing', header: 'Creator ID', get: ({ creator }) => fmt(creator?.id) },
  { section: '1. Sourcing', header: 'VN Owner', get: ({ creator }) => fmt(creator?.owner) },
  { section: '1. Sourcing', header: 'Listed Date', get: ({ assignment, creator }) => toLocalDateStr(assignment?.assignedAt ?? creator?.createdAt) },
  { section: '1. Sourcing', header: 'TikTok Handle', get: ({ creator }) => fmt(creator?.handle) },
  { section: '1. Sourcing', header: 'TikTok Link', get: ({ creator }) => fmt(creator?.profileUrl) },
  { section: '1. Sourcing', header: 'Email', get: ({ creator }) => fmt(creator?.email) },
  { section: '1. Sourcing', header: 'Main Category (top 2)', get: ({ creator }) => categoryTop2(creator) },
  { section: '1. Sourcing', header: 'Demographic', get: ({ creator }) => demographicStr(creator) },
  { section: '1. Sourcing', header: 'GMV/Video, Last 30d ($)', get: ({ creator }) => formatUsdShort(creator?.gmv30d) },
  { section: '1. Sourcing', header: 'Why This Creator', get: ({ creator }) => whyThisCreator(creator) },
  { header: 'O/X & Reason', get: () => '' },
  { section: '2. Outreach', header: '1st Email Sent', get: ({ emails }) => {
    const first = [...emails].filter(e => e.sentAt).sort((a, b) => new Date(a.sentAt!).getTime() - new Date(b.sentAt!).getTime())[0];
    return toLocalDateStr(first?.sentAt);
  } },
  { section: '2. Outreach', header: 'Offer', get: () => '' },
  { section: '2. Outreach', header: 'Reply Status', get: ({ emails, conversation }) => {
    if (conversation?.status === 'Negotiating') return 'Negotiating';
    const latest = [...emails].sort((a, b) => new Date(a.sentAt || 0).getTime() - new Date(b.sentAt || 0).getTime()).pop();
    return fmt(latest?.status);
  } },
  { section: '2. Outreach', header: 'Reply Date', get: ({ emails }) => {
    const replied = emails.filter(e => e.repliedAt).sort((a, b) => new Date(a.repliedAt!).getTime() - new Date(b.repliedAt!).getTime()).pop();
    return toLocalDateStr(replied?.repliedAt);
  } },
  { section: '3. Quote & Nego', header: 'Quote Total ($)', get: ({ assignment }) => fmt(assignment?.originalPrice) },
  { section: '3. Quote & Nego', header: 'Quoted Videos', get: () => '' },
  { section: '3. Quote & Nego', header: 'Quote per Video ($)', get: () => '' },
  { section: '3. Quote & Nego', header: 'Quote Terms', get: () => '' },
  { section: '3. Quote & Nego', header: 'KR Target Price ($)', get: () => '' },
  { section: '3. Quote & Nego', header: 'Final Price ($)', get: ({ assignment }) => fmt(assignment?.negotiatedPrice) },
  { section: '3. Quote & Nego', header: 'Final Videos', get: ({ assignment }) => fmt(assignment?.contractedVideoCount) },
  { section: '3. Quote & Nego', header: 'Final per Video ($)', get: () => '' },
  { section: '3. Quote & Nego', header: 'Commission (%)', get: ({ assignment }) =>
    assignment?.commissionPercent !== undefined ? fmt(assignment.commissionPercent / 100) : '' },
  { section: '3. Quote & Nego', header: 'Usage Rights (Spark)', get: () => '' },
  { section: '3. Quote & Nego', header: 'KR Approval', get: () => '' },
  { section: '3. Quote & Nego', header: 'KR Approval Date', get: () => '' },
  { section: '4. Contract & Approval', header: 'Contract Draft', get: ({ assignment }) =>
    assignment?.contractUrl && assignment.castingStage !== 'Signed' && assignment.castingStage !== 'Confirmed' ? assignment.contractUrl : '' },
  { section: '4. Contract & Approval', header: 'Contract Sent', get: () => '' },
  { section: '4. Contract & Approval', header: "Signed by d'Alba", get: ({ assignment }) =>
    assignment?.contractUrl && (assignment.castingStage === 'Signed' || assignment.castingStage === 'Confirmed') ? assignment.contractUrl : '' },
  { section: '4. Contract & Approval', header: 'Separate Invoice', get: () => '' },
  { section: '4. Contract & Approval', header: 'Invoice No.', get: () => '' },
  { section: '4. Contract & Approval', header: 'KR Payment Req. Filed', get: () => '' },
  { section: '4. Contract & Approval', header: 'KR Payment Req. Appr.', get: () => '' },
  { section: '5. Brief', header: 'Brief / Guide Link', get: () => '' },
  { section: '5. Brief', header: 'Brief Sent', get: () => '' },
  { section: '6. Delivery & Payment', header: 'Videos Delivered', get: () => '' },
  { section: '6. Delivery & Payment', header: 'KR Delivery Check', get: () => '' },
  { section: '6. Delivery & Payment', header: 'Payment Method', get: () => '' },
  { section: '6. Delivery & Payment', header: 'Payment Account', get: () => '' },
  { section: '6. Delivery & Payment', header: 'KR Paid Amount ($)', get: () => '' },
  { section: '6. Delivery & Payment', header: 'KR Paid Date', get: () => '' },
  { section: '7. Performance', header: 'Total GMV ($)', get: ({ totalGmv }) => fmt(totalGmv) },
  { section: '7. Performance', header: 'GMV per Video ($)', get: () => '' },
  { section: '7. Performance', header: 'GMV / Fee (x)', get: () => '' },
  { section: '7. Performance', header: 'KR Renewal Call', get: () => '' },
  { section: '8. Status', header: 'Stage', get: () => '' },
  { section: '8. Status', header: 'Notes', get: ({ assignment, creator }) =>
    fmt(assignment?.notes) || fmt(creator?.notes?.map(n => n.content).join(' | ')) },
];

function groupHeaderLine(): string[] {
  const line: string[] = [];
  let prevSection: string | undefined;
  COLUMNS.forEach(col => {
    if (col.section && col.section !== prevSection) line.push(col.section);
    else line.push('');
    prevSection = col.section;
  });
  return line;
}

function csvEscape(v: string): string {
  if (v.includes(',') || v.includes('"') || v.includes('\n')) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function rowsToCsv(headerLines: string[][], rows: string[][]): string {
  const headerText = headerLines.map(line => line.map(csvEscape).join(','));
  const dataLines = rows.map(r => r.map(csvEscape).join(','));
  return [...headerText, ...dataLines].join('\n');
}

async function main() {
  console.log(`Đang truy vấn ${HANDLES.length} handle từ DB...`);

  const [assignments, outreach, postedVideos, conversations] = await Promise.all([
    getAllAssignments(),
    getAllOutreach(),
    getAllPostedVideos(),
    getAllConversations(),
  ]);

  const found: Creator[] = [];
  const notFound: string[] = [];

  for (const handle of HANDLES) {
    const creator = await getCreatorByHandle(handle);
    if (creator) found.push(creator);
    else notFound.push(handle);
  }

  console.log(`✓ Tìm thấy ${found.length}/${HANDLES.length} creator trong DB.`);
  if (notFound.length > 0) {
    console.log(`✗ Không tìm thấy ${notFound.length} handle (chưa có trong hệ thống):`);
    notFound.forEach(h => console.log(`  - ${h}`));
  }

  if (found.length === 0) {
    console.log('\nKhông có creator nào để xuất. Dừng.');
    return;
  }

  const conversationByCreatorId = new Map(conversations.map(c => [c.creatorId, c]));
  const assignmentByCreatorId = new Map<string, CreatorCampaignAssignment>();
  for (const a of assignments) {
    // Nếu creator có nhiều assignment (nhiều campaign), lấy assignment mới nhất.
    const existing = assignmentByCreatorId.get(a.creatorId);
    if (!existing || new Date(a.assignedAt).getTime() > new Date(existing.assignedAt).getTime()) {
      assignmentByCreatorId.set(a.creatorId, a);
    }
  }

  const rows = found.map(creator => {
    const assignment = assignmentByCreatorId.get(creator.id);
    const emails = outreach.filter(o => o.creatorId === creator.id && (!assignment || o.campaignId === assignment.campaignId));
    const posted = postedVideos.filter(v => v.creatorId === creator.id && (!assignment || v.campaignId === assignment.campaignId));
    const totalGmv = posted.length > 0 ? posted.reduce((sum, v) => sum + (v.totalRevenue || 0), 0) : undefined;
    const conversation = conversationByCreatorId.get(creator.id);
    const ctx: RowContext = { creator, assignment, emails, totalGmv, conversation };
    return COLUMNS.map(col => col.get(ctx));
  });

  const headerLines = [groupHeaderLine(), COLUMNS.map(c => c.header)];
  const csv = rowsToCsv(headerLines, rows);

  const outputPath = path.resolve('creators-export.csv');
  fs.writeFileSync(outputPath, '﻿' + csv, 'utf-8');

  console.log(`\n✓ Đã xuất ${found.length} creator vào: ${outputPath}`);
  console.log('  Copy nội dung file này (hoặc mở bằng Excel/Sheets) rồi paste vào Google Sheet.');
}

main().catch(err => {
  console.error('Lỗi:', err);
  process.exit(1);
});
