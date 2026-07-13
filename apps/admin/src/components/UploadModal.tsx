import { useState, useRef } from 'react';
import type { Photo, PhotoMeta } from '../lib/api';
import { uploadPhoto } from '../lib/api';
import { MetaForm } from './MetaForm';

interface Props {
  onClose: () => void;
  onUploaded: (photo: Photo) => void;
}

const DEFAULT_META: PhotoMeta = {
  title: '',
  alt: '',
  galleries: ['uncategorized'],
  ratio: 'tall',
  featured: false,
};

export function UploadModal({ onClose, onUploaded }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [meta, setMeta] = useState<PhotoMeta>(DEFAULT_META);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const images = Array.from(incoming).filter(f => f.type.startsWith('image/'));
    setFiles(prev => [...prev, ...images]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!files.length) return;
    setUploading(true);
    setError('');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress(`Uploading ${file.name} (${i + 1}/${files.length})…`);
      try {
        const photo = await uploadPhoto(file, meta);
        onUploaded(photo);
      } catch (err) {
        setError(`Failed on ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
        setUploading(false);
        return;
      }
    }

    setUploading(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-neutral-800">
          <h2 className="text-white font-semibold">Upload photos</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors text-lg leading-none">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-white bg-white/5' : 'border-neutral-800 hover:border-neutral-600'
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={e => addFiles(e.target.files)}
            />
            {files.length ? (
              <div className="space-y-1">
                {files.map(f => (
                  <p key={f.name} className="text-sm text-neutral-300">{f.name}</p>
                ))}
                <p className="text-xs text-neutral-500 mt-2">Click or drop to add more</p>
              </div>
            ) : (
              <div>
                <p className="text-neutral-400 text-sm">Drop images here or click to browse</p>
                <p className="text-neutral-600 text-xs mt-1">JPG, PNG, WebP, AVIF</p>
              </div>
            )}
          </div>

          <MetaForm meta={meta} onChange={setMeta} />

          {error && <p className="text-red-400 text-sm">{error}</p>}
          {uploading && <p className="text-neutral-400 text-sm">{progress}</p>}

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
              disabled={!files.length || uploading}
              className="flex-1 bg-white text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-neutral-200 transition-colors"
            >
              {uploading ? 'Uploading…' : `Upload ${files.length || ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
