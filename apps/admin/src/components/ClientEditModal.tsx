import { useState } from 'react';
import type { ClientGallery } from '../lib/api';
import { updateClientGallery } from '../lib/api';

interface Props {
  gallery: ClientGallery;
  onClose: () => void;
  onSaved: (updated: ClientGallery) => void;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function ClientEditModal({ gallery, onClose, onSaved }: Props) {
  const [name, setName] = useState(gallery.name);
  const [slug, setSlug] = useState(gallery.id);
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const updates: { name?: string; password?: string; newId?: string } = {};
      if (name !== gallery.name) updates.name = name;
      if (password) updates.password = password;
      if (slug !== gallery.id) updates.newId = slug;
      const result = await updateClientGallery(gallery.id, updates);
      onSaved({ ...gallery, name, id: result.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Edit gallery</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white text-lg leading-none">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs text-neutral-400 mb-1">Client name</label>
            <input
              type="text"
              value={name}
              onChange={e => { setName(e.target.value); if (slug === slugify(gallery.name)) setSlug(slugify(e.target.value)); }}
              className="w-full bg-neutral-900 text-white border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">URL slug</label>
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
              <span className="text-neutral-600 text-sm">/c/</span>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none"
              />
            </div>
            {slug !== gallery.id && (
              <p className="text-amber-400 text-xs mt-1">⚠ The old link will stop working after saving.</p>
            )}
          </div>
          <div>
            <label className="block text-xs text-neutral-400 mb-1">New password <span className="text-neutral-600">(leave blank to keep current)</span></label>
            <input
              type="text"
              placeholder="Enter new password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 bg-neutral-900 text-neutral-300 rounded-lg py-2.5 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="flex-1 bg-white text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-neutral-200 transition-colors">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
