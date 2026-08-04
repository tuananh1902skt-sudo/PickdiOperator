// Bảng GMV Tier chính thức của Pickdi (không phải Kalodata) — quyết định hình thức hợp tác:
// L2 chỉ được trả commission, từ L3 trở lên mới được thương lượng commission + flat-fee.
// Ngưỡng dưới đây là mốc DƯỚI (inclusive) của mỗi tier, tính trên gmv30d (USD).
import { Creator, CreatorGmvTier } from '../types';

export const GMV_TIER_ORDER: CreatorGmvTier[] = ['L1', 'L2', 'L3', 'L4', 'L5'];

const GMV_TIER_THRESHOLDS: { tier: CreatorGmvTier; min: number }[] = [
  { tier: 'L5', min: 150_000 },
  { tier: 'L4', min: 60_000 },
  { tier: 'L3', min: 25_000 },
  { tier: 'L2', min: 5_000 },
  { tier: 'L1', min: 0 },
];

// Tự động phân tier theo gmv30d — trả về undefined nếu chưa có số liệu GMV (không suy diễn
// khi thiếu dữ liệu, tránh gắn nhầm L1 cho creator chưa từng có GMV).
export function computeGmvTier(gmv: number | undefined | null): CreatorGmvTier | undefined {
  if (gmv == null || !Number.isFinite(gmv) || gmv < 0) return undefined;
  return GMV_TIER_THRESHOLDS.find(t => gmv >= t.min)!.tier;
}

export type CooperationMode = 'commission_only' | 'commission_or_flat_fee';

// L2 (và dưới) chỉ hợp tác theo commission; từ L3 trở lên có thể thương lượng flat-fee.
export function cooperationModeForTier(tier: CreatorGmvTier | undefined): CooperationMode | undefined {
  if (!tier) return undefined;
  return tier === 'L3' || tier === 'L4' || tier === 'L5' ? 'commission_or_flat_fee' : 'commission_only';
}

export function cooperationModeLabel(mode: CooperationMode | undefined): string {
  if (mode === 'commission_only') return 'Chỉ Commission';
  if (mode === 'commission_or_flat_fee') return 'Commission + Flat-fee';
  return '';
}

// Dùng khi save/import creator — luôn suy ra gmvTier từ gmv30d hiện có, ghi đè giá trị cũ
// (kể cả giá trị từng nhập tay từ Kalodata) để toàn bộ CRM dùng chung 1 định nghĩa tier.
export function withComputedGmvTier<T extends Pick<Creator, 'gmv30d' | 'gmvTier'>>(c: T): T {
  const tier = computeGmvTier(c.gmv30d);
  return tier ? { ...c, gmvTier: tier } : c;
}
