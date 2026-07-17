import { useState, useEffect, useRef } from 'react';
import type { ClientPhoto, Photo, PhotoMeta } from '../lib/api';
import { getClientPhotos, uploadClientPhoto, deleteClientPhoto, addFromPortfolio, importToPortfolio, getPhotos, setCoverPhoto } from '../lib/api';
import { cfImageUrl } from '../lib/cf-images';
import { MetaForm } from './MetaForm';

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? '';

interface Props {
  galleryId: string;
  onBack: () => void;
}

export function ClientGalleryDetail({ galleryId, onBack }: Props) {
  const [galleryName, setGalleryName] = useState('');
  const [coverPhotoId, setCoverPhotoId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Portfolio picker state
  const [showPortfolioPicker, setShowPortfolioPicker] = useState(false);
  const [portfolioPhotos, setPortfolioPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [addingFromPortfolio, setAddingFromPortfolio] = useState(false);

  // Add-to-portfolio state
  const [addingToPortfolio, setAddingToPortfolio] = useState<ClientPhoto | null>(null);
  const [importMeta, setImportMeta] = useState<PhotoMeta>({ galleries: ['uncategorized'], ratio: 'tall', featured: false });
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    getClientPhotos(galleryId)
      .then(data => {
        setGalleryName(data.gallery.name);
        setCoverPhotoId(data.gallery.cover_photo_id ?? null);
        setPhotos(data.photos);
      })
      .finally(() => setLoading(false));
  }, [galleryId]);

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    setUploading(true);
    setError('');
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      setProgress(`Uploading ${file.name} (${i + 1}/${list.length})…`);
      try {
        const photo = await uploadClientPhoto(galleryId, file);
        setPhotos(prev => [photo, ...prev]);
      } catch (err) {
        setError(`Failed on ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }
    setUploading(false);
    setProgress('');
  }

  async function handleDelete(photo: ClientPhoto) {
    if (!confirm(`Remove "${photo.filename}"?`)) return;
    setDeleting(photo.id);
    try {
      await deleteClientPhoto(galleryId, photo.id);
      setPhotos(prev => prev.filter(p => p.id !== photo.id));
      if (coverPhotoId === photo.id) {
        await setCoverPhoto(galleryId, null);
        setCoverPhotoId(null);
      }
    } catch (err) {
      alert(`Delete failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeleting(null);
    }
  }

  async function handleSetCover(photo: ClientPhoto) {
    const newCover = coverPhotoId === photo.id ? null : photo.id;
    await setCoverPhoto(galleryId, newCover);
    setCoverPhotoId(newCover);
  }

  async function openPortfolioPicker() {
    setSelectedIds(new Set());
    if (portfolioPhotos.length === 0) {
      const all = await getPhotos();
      setPortfolioPhotos(all);
    }
    setShowPortfolioPicker(true);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function confirmAddFromPortfolio() {
    if (!selectedIds.size) return;
    setAddingFromPortfolio(true);
    try {
      await addFromPortfolio(galleryId, [...selectedIds]);
      const data = await getClientPhotos(galleryId);
      setPhotos(data.photos);
      setShowPortfolioPicker(false);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAddingFromPortfolio(false);
    }
  }

  async function handleImportToPortfolio(e: React.FormEvent) {
    e.preventDefault();
    if (!addingToPortfolio) return;
    setImporting(true);
    try {
      await importToPortfolio(addingToPortfolio.id, addingToPortfolio.filename, importMeta);
      setAddingToPortfolio(null);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }

  const favoriteCount = photos.filter(p => p.favorited).length;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="text-neutral-500 hover:text-white transition-colors text-sm">← Back</button>
        <h2 className="text-white font-semibold">{galleryName || galleryId}</h2>
        <span className="text-neutral-600 text-sm">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
        {favoriteCount > 0 && (
          <span className="text-pink-400 text-sm">♥ {favoriteCount} favorite{favoriteCount !== 1 ? 's' : ''}</span>
        )}
        <button
          onClick={openPortfolioPicker}
          className="ml-auto text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors"
        >
          Add from my gallery
        </button>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); uploadFiles(e.dataTransfer.files); }}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? 'border-white bg-white/5' : 'border-neutral-800 hover:border-neutral-600'
        } ${uploading ? 'pointer-events-none' : ''}`}
      >
        <input ref={inputRef} type="file" multiple accept="image/*" className="hidden" onChange={e => uploadFiles(e.target.files)} />
        {uploading
          ? <p className="text-neutral-400 text-sm">{progress}</p>
          : <p className="text-neutral-500 text-sm">Drop images or click to upload new photos</p>
        }
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading && <p className="text-neutral-500 text-sm">Loading…</p>}

      {!loading && photos.length === 0 && (
        <p className="text-neutral-600 text-sm py-8 text-center">No photos yet.</p>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {photos.map(photo => (
          <div key={photo.id} className="group relative rounded-lg overflow-hidden bg-neutral-900 aspect-square">
            <img
              src={cfImageUrl(photo.id, 'thumbnail')}
              alt={photo.filename}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            {/* Favorite badge — always visible if favorited */}
            {photo.favorited && (
              <div className="absolute top-1.5 left-1.5 bg-pink-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center leading-none pointer-events-none">
                ♥
              </div>
            )}
            {/* Cover badge */}
            {coverPhotoId === photo.id && (
              <div className="absolute bottom-1.5 left-1.5 bg-amber-500 text-black text-[10px] font-medium px-1.5 py-0.5 rounded pointer-events-none">
                Cover
              </div>
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2">
              <div className="flex gap-1 justify-end">
                <button
                  onClick={() => { setAddingToPortfolio(photo); setImportMeta({ galleries: ['uncategorized'], ratio: 'tall', featured: false }); }}
                  className="bg-white/10 hover:bg-white/20 text-white text-xs px-2 py-1 rounded transition-colors"
                  title="Add to my portfolio gallery"
                >
                  → My gallery
                </button>
                <button
                  onClick={() => handleDelete(photo)}
                  disabled={deleting === photo.id}
                  className="bg-red-500/80 hover:bg-red-500 text-white text-xs px-2 py-1 rounded transition-colors disabled:opacity-50"
                >
                  {deleting === photo.id ? '…' : 'Del'}
                </button>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleSetCover(photo)}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    coverPhotoId === photo.id
                      ? 'bg-amber-500 text-black'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {coverPhotoId === photo.id ? 'Unset cover' : 'Set cover'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Portfolio picker modal */}
      {showPortfolioPicker && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
              <div>
                <h2 className="text-white font-semibold">Add from my gallery</h2>
                {selectedIds.size > 0 && <p className="text-neutral-500 text-xs">{selectedIds.size} selected</p>}
              </div>
              <button onClick={() => setShowPortfolioPicker(false)} className="text-neutral-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {portfolioPhotos.map(photo => {
                  const selected = selectedIds.has(photo.id);
                  return (
                    <button
                      key={photo.id}
                      onClick={() => toggleSelect(photo.id)}
                      className={`aspect-square rounded-lg overflow-hidden bg-neutral-900 relative transition-all ${
                        selected ? 'ring-2 ring-white' : 'hover:ring-1 hover:ring-white/40'
                      }`}
                    >
                      <img src={cfImageUrl(photo.id, 'thumbnail')} alt={photo.filename} className="w-full h-full object-cover" loading="lazy" />
                      {selected && (
                        <div className="absolute inset-0 bg-white/20 flex items-center justify-center">
                          <span className="text-white text-xl font-bold">✓</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-neutral-800 flex gap-3 shrink-0">
              <button onClick={() => setShowPortfolioPicker(false)} className="flex-1 bg-neutral-900 text-neutral-300 rounded-lg py-2.5 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
              <button
                onClick={confirmAddFromPortfolio}
                disabled={!selectedIds.size || addingFromPortfolio}
                className="flex-1 bg-white text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-neutral-200 transition-colors"
              >
                {addingFromPortfolio ? 'Adding…' : `Add ${selectedIds.size || ''} photo${selectedIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add-to-portfolio modal */}
      {addingToPortfolio && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-neutral-800">
              <h2 className="text-white font-semibold">Add to my gallery</h2>
              <button onClick={() => setAddingToPortfolio(null)} className="text-neutral-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleImportToPortfolio} className="p-5 space-y-5">
              <img
                src={cfImageUrl(addingToPortfolio.id, 'thumbnail')}
                alt={addingToPortfolio.filename}
                className="w-full h-36 object-cover rounded-lg bg-neutral-900"
              />
              <MetaForm meta={importMeta} onChange={setImportMeta} />
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAddingToPortfolio(null)} className="flex-1 bg-neutral-900 text-neutral-300 rounded-lg py-2.5 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
                <button type="submit" disabled={importing} className="flex-1 bg-white text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-neutral-200 transition-colors">
                  {importing ? 'Adding…' : 'Add to my gallery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
