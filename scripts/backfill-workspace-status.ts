// One-time migration — chạy 1 lần sau khi deploy fix "trạng thái creator leak giữa workspace".
//
// Trước fix, Creator.status (field chung, không phân biệt workspace) bị dùng để ghi "Contacted"/
// "Archived"/... nên có thể đang mang giá trị chỉ đúng với 1 workspace cụ thể. Field này giờ chỉ
// còn là fallback hiển thị cho workspace Agency và cho creator CHƯA từng có assignment nào — với
// mọi creator ĐÃ có ít nhất 1 CreatorCampaignAssignment, trạng thái đúng luôn phải đọc từ assignment
// scoped theo workspace, nên giá trị cũ trên Creator.status không còn ý nghĩa và cần reset về
// trung lập để không còn rò rỉ qua đường fallback (đặc biệt là view Agency).
//
// Chạy: npx tsx scripts/backfill-workspace-status.ts
import dotenv from 'dotenv';
dotenv.config();
import { getAllCreators, getAllAssignments, saveCreator } from '../src/db';

async function main() {
  const creators = await getAllCreators();
  const assignments = await getAllAssignments();

  const assignedCreatorIds = new Set(assignments.map(a => a.creatorId));

  let resetCount = 0;
  for (const creator of creators) {
    if (!assignedCreatorIds.has(creator.id)) continue; // chưa có assignment nào — giữ nguyên, đây vẫn là lead chung
    if (creator.status === 'New Lead') continue;

    console.log(`Reset creator @${creator.handle} (${creator.id}): '${creator.status}' -> 'New Lead' (đã có ${assignments.filter(a => a.creatorId === creator.id).length} assignment)`);
    creator.status = 'New Lead';
    await saveCreator(creator);
    resetCount++;
  }

  console.log(`\nDone. Reset ${resetCount}/${creators.length} creator(s) that have at least one workspace assignment.`);
  console.log('Per-workspace status for these creators now comes entirely from CreatorCampaignAssignment.status.');
}

main();
