import { useState, useEffect } from 'react';
import type { HeroPage, Photo } from '../lib/api';
import { getHero, setHero } from '../lib/api';
import { cfImageUrl } from '../lib/cf-images';

const PAGES: { key: HeroPage; label: string }[] = [
  { key: 'landing', label: 'Landing' },
  { key: 'portraits', label: 'Portraits' },
  { key: 'landscape', label: 'Landscape' },
  { key: 'grad', label: 'Graduation' },
  { key: 'boudoir', label: 'Boudoir' },
];

interface Props {
  photos: Photo[];
}

interface HeroState {
  photoId: string | null;
  loading: boolean;
  saving: boolean;
}

export function HeroesPage({ photos }: Props) {
  const [heroes, setHeroes] = useState<Record<HeroPage, HeroState>>({
    landing:   { photoId: null, loading: true, saving: false },
    portraits: { photoId: null, loading: true, saving: false },
    landscape: { photoId: null, loading: true, saving: false },
    grad:      { photoId: null, loading: true, saving: false },
    boudoir:   { photoId: null, loading: true, saving: false },
  });
  const [picking, setPicking] = useState<HeroPage | null>(null);

  useEffect(() => {
    PAGES.forEach(async ({ key }) => {
      const photoId = await getHero(key);
      setHeroes(prev => ({ ...prev, [key]: { photoId, loading: false, saving: false } }));
    });
  }, []);

  async function handlePick(page: HeroPage, photoId: string) {
    setHeroes(prev => ({ ...prev, [page]: { ...prev[page], saving: true } }));
    setPicking(null);
    try {
      await setHero(page, photoId);
      setHeroes(prev => ({ ...prev, [page]: { photoId, loading: false, saving: false } }));
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : String(err)}`);
      setHeroes(prev => ({ ...prev, [page]: { ...prev[page], saving: false } }));
    }
  }

  return (
    <div className="p-6 space-y-4">
      <p className="text-neutral-400 text-sm">Set the hero image for each gallery page.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PAGES.map(({ key, label }) => {
          const { photoId, loading, saving } = heroes[key];
          const photo = photos.find(p => p.id === photoId);

          return (
            <div key={key} className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden">
              <div className="aspect-video bg-neutral-950 relative">
                {loading || saving ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-neutral-600 text-sm">{saving ? 'Saving…' : 'Loading…'}</span>
                  </div>
                ) : photoId ? (
                  <img
                    src={cfImageUrl(photoId, 'thumbnail')}
                    alt={photo?.alt || label}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-neutral-600 text-sm">No hero set</span>
                  </div>
                )}
              </div>

              <div className="p-3 flex items-center justify-between">
                <span className="text-white text-sm font-medium">{label}</span>
                <button
                  onClick={() => setPicking(key)}
                  className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors"
                >
                  {photoId ? 'Change' : 'Set hero'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Photo picker modal */}
      {picking && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800 shrink-0">
              <h2 className="text-white font-semibold">
                Pick hero for {PAGES.find(p => p.key === picking)?.label}
              </h2>
              <button onClick={() => setPicking(null)} className="text-neutral-500 hover:text-white transition-colors text-lg leading-none">✕</button>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {photos.map(photo => (
                  <button
                    key={photo.id}
                    onClick={() => handlePick(picking, photo.id)}
                    className="aspect-square rounded-lg overflow-hidden bg-neutral-900 hover:ring-2 hover:ring-white transition-all"
                  >
                    <img
                      src={cfImageUrl(photo.id, 'thumbnail')}
                      alt={photo.alt || photo.filename}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
