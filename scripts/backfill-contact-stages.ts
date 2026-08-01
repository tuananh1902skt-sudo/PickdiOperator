// One-time migration — chạy 1 lần sau khi deploy fix "tách stage Contacted thành 3 cột
// Contact lần 1/2/3" trong Kanban.
//
// Trước fix, mọi lần liên hệ (đầu tiên hay nhắc lại) đều ghi status = 'Contacted'. Giờ
// CreatorStatus không còn giá trị 'Contacted' nữa nên các row cũ mang giá trị này sẽ không
// khớp cột nào trên Kanban và biến mất khỏi board. Script này chuyển toàn bộ status =
// 'Contacted' hiện có (ở cả Creator.status lẫn CreatorCampaignAssignment.status) sang
// 'Contact lần 1' — mặc định an toàn nhất vì không có dữ liệu nào cho biết đó là lần liên hệ
// thứ mấy.
//
// Chạy: npx tsx scripts/backfill-contact-stages.ts
import dotenv from 'dotenv';
dotenv.config();
import { getAllCreators, saveCreator, getAllAssignments, saveAssignment } from '../src/db';

const OLD_STATUS = 'Contacted';
const NEW_STATUS = 'Contact lần 1';

async function main() {
  const creators = await getAllCreators();
  let creatorCount = 0;
  for (const creator of creators) {
    if ((creator.status as string) !== OLD_STATUS) continue;
    console.log(`Creator @${creator.handle} (${creator.id}): '${OLD_STATUS}' -> '${NEW_STATUS}'`);
    creator.status = NEW_STATUS;
    await saveCreator(creator);
    creatorCount++;
  }

  const assignments = await getAllAssignments();
  let assignmentCount = 0;
  for (const assignment of assignments) {
    if ((assignment.status as string) !== OLD_STATUS) continue;
    console.log(`Assignment ${assignment.id} (creator ${assignment.creatorId}, campaign ${assignment.campaignId}): '${OLD_STATUS}' -> '${NEW_STATUS}'`);
    assignment.status = NEW_STATUS;
    await saveAssignment(assignment);
    assignmentCount++;
  }

  console.log(`\nDone. Updated ${creatorCount}/${creators.length} creator(s) and ${assignmentCount}/${assignments.length} assignment(s) from '${OLD_STATUS}' to '${NEW_STATUS}'.`);
}

main();
