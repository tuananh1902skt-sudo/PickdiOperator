import React, { useState } from 'react';
import { X, Target } from 'lucide-react';
import { Campaign } from '../../types';

interface CreateCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (campaignData: any) => void;
  campaign?: Campaign | null;
}

const AGE_GROUP_OPTIONS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55+'];

export const CreateCampaignModal: React.FC<CreateCampaignModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  campaign
}) => {
  const isEditMode = !!campaign;
  const [name, setName] = useState(campaign?.name || '');
  const [brand, setBrand] = useState(campaign?.brand || '');
  const [objective, setObjective] = useState(campaign?.objective || '');
  const [description, setDescription] = useState(campaign?.description || '');
  const [budget, setBudget] = useState(String(campaign?.budget ?? '10000'));
  const [startDate, setStartDate] = useState(campaign?.startDate || new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(campaign?.endDate || new Date(Date.now() + 30*86400000).toISOString().split('T')[0]);
  const [productName, setProductName] = useState(campaign?.products?.[0]?.name || '');
  const [productSku, setProductSku] = useState(campaign?.products?.[0]?.sku || '');
  const [productPrice, setProductPrice] = useState(String(campaign?.products?.[0]?.price ?? '30'));
  const [productImageUrl, setProductImageUrl] = useState(campaign?.products?.[0]?.imageUrl || '');
  const [productUrl, setProductUrl] = useState(campaign?.products?.[0]?.productUrl || '');
  const [productRating, setProductRating] = useState(String(campaign?.products?.[0]?.rating ?? ''));
  const [productReviewCount, setProductReviewCount] = useState(String(campaign?.products?.[0]?.reviewCount ?? ''));
  const [productSoldCount, setProductSoldCount] = useState(campaign?.products?.[0]?.soldCount || '');
  const [productHighlights, setProductHighlights] = useState((campaign?.products?.[0]?.highlights || []).join('\n'));
  const [compensationOffer, setCompensationOffer] = useState(campaign?.products?.[0]?.compensationOffer || '');

  // Target audience — dùng để chấm Audience Fit trong scoreCreator() (src/scoring.ts).
  // Không bắt buộc: bỏ trống thì nhóm Audience Fit tự bị loại khỏi công thức chấm điểm.
  const [targetGender, setTargetGender] = useState<'Any' | 'Male' | 'Female'>(campaign?.targetAudience?.gender || 'Any');
  const [targetAgeGroups, setTargetAgeGroups] = useState<string[]>(campaign?.targetAudience?.ageGroups || []);
  const [targetCountries, setTargetCountries] = useState((campaign?.targetAudience?.countries || []).join(', '));

  if (!isOpen) return null;

  const toggleAgeGroup = (ag: string) => {
    setTargetAgeGroups(prev => prev.includes(ag) ? prev.filter(x => x !== ag) : [...prev, ag]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !brand.trim()) return;
    if (endDate < startDate) {
      alert('Ngày kết thúc phải sau ngày bắt đầu.');
      return;
    }

    const countries = targetCountries.split(',').map(s => s.trim()).filter(Boolean);
    const hasTargetAudience = targetGender !== 'Any' || targetAgeGroups.length > 0 || countries.length > 0;

    onSubmit({
      name,
      brand,
      objective,
      description,
      budget: Number(budget) || 5000,
      startDate,
      endDate,
      ...(isEditMode ? {} : { status: 'Planning' }),
      products: productName ? [{
        id: campaign?.products?.[0]?.id || `p-${Date.now()}`,
        name: productName,
        sku: productSku || 'SKU-001',
        price: Number(productPrice) || 25,
        imageUrl: productImageUrl.trim() || undefined,
        productUrl: productUrl.trim() || undefined,
        rating: productRating.trim() ? Number(productRating) : undefined,
        reviewCount: productReviewCount.trim() ? Number(productReviewCount) : undefined,
        soldCount: productSoldCount.trim() || undefined,
        highlights: productHighlights.split('\n').map(s => s.trim()).filter(Boolean),
        compensationOffer: compensationOffer.trim() || undefined,
      }] : [],
      targetAudience: hasTargetAudience ? {
        gender: targetGender,
        ageGroups: targetAgeGroups,
        countries,
      } : undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            {isEditMode ? 'Edit Campaign' : 'Create New Affiliate Campaign'}
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Campaign Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 2aN Cushion Q3 Viral Launch"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Brand / Client Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Innisfree Vietnam — brand mới sẽ tự tạo workspace"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Campaign Objective</label>
            <input
              type="text"
              placeholder="Target sales units or GMV goal..."
              value={objective}
              onChange={e => setObjective(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Budget ($)</label>
              <input
                type="number"
                value={budget}
                onChange={e => setBudget(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Product Info section */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">Featured TikTok Shop Product</span>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                placeholder="Product Name"
                value={productName}
                onChange={e => setProductName(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="SKU"
                value={productSku}
                onChange={e => setProductSku(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="number"
                placeholder="Retail Price ($)"
                value={productPrice}
                onChange={e => setProductPrice(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <input
                type="url"
                placeholder="Product Image URL (dùng cho email HTML)"
                value={productImageUrl}
                onChange={e => setProductImageUrl(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="url"
                placeholder="Link sản phẩm trên TikTok Shop"
                value={productUrl}
                onChange={e => setProductUrl(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="mt-2">
              <input
                type="text"
                placeholder="Compensation offer, e.g. $100 for a package of 10 videos (open to discussion)"
                value={compensationOffer}
                onChange={e => setCompensationOffer(e.target.value)}
                className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <input
                type="number"
                step="0.1"
                min="0"
                max="5"
                placeholder="Rating (vd: 4.8)"
                value={productRating}
                onChange={e => setProductRating(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="number"
                min="0"
                placeholder="Review count"
                value={productReviewCount}
                onChange={e => setProductReviewCount(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
              <input
                type="text"
                placeholder="Sold count (vd: 2.7K+)"
                value={productSoldCount}
                onChange={e => setProductSoldCount(e.target.value)}
                className="p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
            <div className="mt-2">
              <textarea
                rows={3}
                placeholder={'USP / điểm nổi bật cho email — mỗi dòng 1 ý, vd:\n50,000ppm Volufiline™\nWhite Truffle + Vegan Collagen'}
                value={productHighlights}
                onChange={e => setProductHighlights(e.target.value)}
                className="w-full p-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
              />
            </div>
          </div>

          {/* Target Audience section — dùng để chấm Audience Fit cho creator, không bắt buộc */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
            <span className="font-bold text-slate-800 dark:text-slate-200">Target Audience (optional — used for creator scoring)</span>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">Gender</label>
              <div className="flex gap-2">
                {(['Any', 'Male', 'Female'] as const).map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setTargetGender(g)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${targetGender === g ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">Age groups</label>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUP_OPTIONS.map(ag => (
                  <button
                    key={ag}
                    type="button"
                    onClick={() => toggleAgeGroup(ag)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${targetAgeGroups.includes(ag) ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-600 dark:text-slate-400 mb-1">Countries (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Vietnam, United States"
                value={targetCountries}
                onChange={e => setTargetCountries(e.target.value)}
                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs"
            >
              {isEditMode ? 'Save Changes' : 'Launch Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
