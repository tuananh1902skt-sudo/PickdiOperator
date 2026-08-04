// One-time migration — chạy 1 lần sau khi đổi định nghĩa GMV Tier sang bảng chính thức của
// Pickdi (L1 ~5K, L2 5K-25K, L3 25K-60K, L4 60K-150K, L5 150K+, xem src/lib/gmvTier.ts).
//
// saveCreator() giờ tự suy ra gmvTier từ gmv30d mỗi lần lưu, nhưng các creator đã có trong DB
// từ trước (gmvTier nhập tay từ Kalodata, hoặc chưa từng được set) cần được tính lại 1 lần.
//
// Chạy: npx tsx scripts/backfill-gmv-tiers.ts
import dotenv from 'dotenv';
dotenv.config();
import { getAllCreators, saveCreator } from '../src/db';
import { computeGmvTier } from '../src/lib/gmvTier';

async function main() {
  const creators = await getAllCreators();
  let updated = 0;

  for (const creator of creators) {
    const newTier = computeGmvTier(creator.gmv30d);
    if (newTier === creator.gmvTier) continue;
    console.log(`Creator @${creator.handle} (${creator.id}): gmv30d=${creator.gmv30d ?? 'n/a'} tier '${creator.gmvTier ?? 'n/a'}' -> '${newTier ?? 'n/a'}'`);
    creator.gmvTier = newTier;
    await saveCreator(creator);
    updated++;
  }

  console.log(`\nDone. Updated ${updated}/${creators.length} creator(s).`);
}

main();
