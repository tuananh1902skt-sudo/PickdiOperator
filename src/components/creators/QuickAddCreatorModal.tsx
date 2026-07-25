import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface QuickAddCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<boolean> | void;
}

export const QuickAddCreatorModal: React.FC<QuickAddCreatorModalProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [handle, setHandle] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [category, setCategory] = useState('Beauty & Skincare');
  const [country, setCountry] = useState('Vietnam');
  const [followers, setFollowers] = useState('');
  const [avgViews, setAvgViews] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const result = await onSubmit({
        handle,
        displayName: displayName || handle,
        category,
        country,
        followers: followers.trim() ? Number(followers) : undefined,
        avgViews: avgViews.trim() ? Number(avgViews) : undefined,
        email: email.trim() || undefined,
        bio,
        notes
      });
      // Only close on confirmed success — keep the form filled in on failure so
      // the user doesn't lose what they typed and can retry.
      if (result !== false) onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
            <Plus className="w-5 h-5 text-indigo-600" />
            Quick Add Creator Profile
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                TikTok Handle *
              </label>
              <input
                type="text"
                required
                placeholder="@handle"
                value={handle}
                onChange={e => setHandle(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                placeholder="Full Name / Brand Name"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              >
                <option value="Beauty & Skincare">Beauty & Skincare</option>
                <option value="Makeup">Makeup</option>
                <option value="Beauty & Lifestyle">Beauty & Lifestyle</option>
                <option value="Fashion & Outfits">Fashion & Outfits</option>
              </select>
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Target Country</label>
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
              >
                <option value="Vietnam">Vietnam 🇻🇳</option>
                <option value="United States">United States 🇺🇸</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Followers Count</label>
              <input
                type="number"
                placeholder="Chưa biết — để trống"
                value={followers}
                onChange={e => setFollowers(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Avg Video Views</label>
              <input
                type="number"
                placeholder="Chưa biết — để trống"
                value={avgViews}
                onChange={e => setAvgViews(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Business Email</label>
            <input
              type="email"
              placeholder="contact@creator.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Bio / Content Angle</label>
            <textarea
              rows={2}
              placeholder="Short bio description..."
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-600 dark:text-slate-400 font-medium hover:bg-slate-100 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs disabled:opacity-60"
            >
              {isSaving ? 'Saving...' : 'Save Creator Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
