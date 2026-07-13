import { useState, useMemo } from 'react';
import type { Photo } from '../lib/api';
import { deletePhoto } from '../lib/api';
import { cfImageUrl } from '../lib/cf-images';
import { EditModal } from './EditModal';
import { UploadModal } from './UploadModal';

const GALLERIES = ['all', 'portraits', 'landscape', 'grad', 'boudoir', 'uncategorized'] as const;
type GalleryTab = typeof GALLERIES[number];
type SortKey = 'newest' | 'oldest' | 'az';

interface Props {
  photos: Photo[];
  dirtyPhotoIds: Set<string>;
  onPhotosChange: (photos: Photo[], dirtyId?: string) => void;
}

export function PhotoGrid({ photos, dirtyPhotoIds, onPhotosChange }: Props) {
  const [editing, setEditing] = useState<Photo | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [gallery, setGallery] = useState<GalleryTab>('all');
  const [sort, setSort] = useState<SortKey>('newest');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  const years = useMemo(() =>
    [...new Set(photos.map(p => p.year))].sort((a, b) => b - a),
  [photos]);

  const visible = useMemo(() => {
    let result = gallery === 'all' ? photos : photos.filter(p => p.galleries.includes(gallery));
    if (featuredOnly) result = result.filter(p => p.featured);
    if (yearFilter)   result = result.filter(p => p.year === yearFilter);
    if (sort === 'newest') result = [...result].sort((a, b) => b.uploaded_at.localeCompare(a.uploaded_at));
    if (sort === 'oldest') result = [...result].sort((a, b) => a.uploaded_at.localeCompare(b.uploaded_at));
    if (sort === 'az')     result = [...result].sort((a, b) => (a.title || a.filename).localeCompare(b.title || b.filename));
    return result;
  }, [photos, gallery, sort, featuredOnly, yearFilter]);

  async function handleDelete(photo: Photo) {
    if (!confirm(`Delete "${photo.filename}"? This cannot be undone.`)) return;
    setDeleting(photo.id);
    try {
      await deletePhoto(photo.id);
      onPhotosChange(photos.filter(p => p.id !== photo.id));
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <>
      <div className="p-6 space-y-4">
        {/* Gallery tabs + upload */}
        <div className="flex items-center gap-1 border-b border-neutral-800 pb-3">
          {GALLERIES.map(g => {
            const count = g === 'all' ? photos.length : photos.filter(p => p.galleries.includes(g)).length;
            return (
              <button
                key={g}
                onClick={() => setGallery(g)}
                className={`text-sm px-3 py-1 rounded-full transition-colors capitalize ${
                  gallery === g ? 'bg-white text-black' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {g} <span className={`text-xs ${gallery === g ? 'text-black/50' : 'text-neutral-600'}`}>{count}</span>
              </button>
            );
          })}
          <button
            onClick={() => setUploading(true)}
            className="ml-auto bg-white text-black text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-neutral-200 transition-colors shrink-0"
          >
            Upload
          </button>
        </div>

        {/* Sort + filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="bg-neutral-900 text-neutral-300 text-sm border border-neutral-800 rounded-lg px-2 py-1.5 focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="az">A → Z</option>
          </select>

          {years.length > 1 && (
            <select
              value={yearFilter ?? ''}
              onChange={e => setYearFilter(e.target.value ? Number(e.target.value) : null)}
              className="bg-neutral-900 text-neutral-300 text-sm border border-neutral-800 rounded-lg px-2 py-1.5 focus:outline-none"
            >
              <option value="">All years</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          )}

          <label className="flex items-center gap-2 text-sm text-neutral-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={featuredOnly}
              onChange={e => setFeaturedOnly(e.target.checked)}
              className="accent-white"
            />
            Featured only
          </label>

          <span className="text-neutral-600 text-sm ml-auto">{visible.length} photo{visible.length !== 1 ? 's' : ''}</span>
        </div>

        {visible.length === 0 && (
          <p className="text-neutral-600 text-sm py-16 text-center">
            {photos.length === 0 ? 'No photos yet — upload some!' : 'No photos match these filters.'}
          </p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {visible.map(photo => {
            const isDirty = dirtyPhotoIds.has(photo.id);
            return (
              <div key={photo.id} className="group relative rounded-lg overflow-hidden bg-neutral-900 aspect-square">
                <img
                  src={cfImageUrl(photo.id, 'thumbnail')}
                  alt={photo.alt || photo.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />

                {isDirty && (
                  <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-amber-400 rounded-full z-10" title="Edited — not yet published" />
                )}

                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
                  <div className="flex gap-1 justify-end">
                    <button
                      onClick={() => setEditing(photo)}
                      className="bg-white/10 hover:bg-white/20 text-white text-xs px-2 py-1 rounded transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(photo)}
                      disabled={deleting === photo.id}
                      className="bg-red-500/80 hover:bg-red-500 text-white text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {deleting === photo.id ? '…' : 'Del'}
                    </button>
                  </div>
                  <div>
                    {photo.galleries.length > 0 && (
                      <p className="text-white/70 text-xs truncate">{photo.galleries.join(', ')}</p>
                    )}
                    {photo.featured && <span className="text-yellow-400 text-xs">★ featured</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {uploading && (
        <UploadModal
          onClose={() => setUploading(false)}
          onUploaded={photo => onPhotosChange([photo, ...photos])}
        />
      )}

      {editing && (
        <EditModal
          photo={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            onPhotosChange(photos.map(p => (p.id === updated.id ? updated : p)), updated.id);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
