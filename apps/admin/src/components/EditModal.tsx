import { useState } from 'react';
import type { Photo, PhotoMeta } from '../lib/api';
import { updatePhoto } from '../lib/api';
import { cfImageUrl } from '../lib/cf-images';
import { MetaForm } from './MetaForm';

interface Props {
  photo: Photo;
  onClose: () => void;
  onSaved: (updated: Photo) => void;
}

export function EditModal({ photo, onClose, onSaved }: Props) {
  const [meta, setMeta] = useState<PhotoMeta>({
    title: photo.title,
    alt: photo.alt,
    ratio: photo.ratio,
    galleries: photo.galleries,
    featured: photo.featured,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updatePhoto(photo.id, meta);
      onSaved({ ...photo, ...meta } as Photo);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Edit photo</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <img
            src={cfImageUrl(photo.id, 'thumbnail')}
            alt={photo.alt || photo.filename}
            className="w-full h-40 object-cover rounded-lg bg-neutral-900"
          />

          <p className="text-xs text-neutral-500 font-mono break-all">{photo.id}</p>

          <MetaForm meta={meta} onChange={setMeta} />

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-neutral-900 text-neutral-300 rounded-lg py-2.5 text-sm hover:bg-neutral-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-white text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-neutral-200 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
