import { useState, useEffect } from 'react';
import type { Photo } from './lib/api';
import { getPhotos } from './lib/api';
import { getToken } from './lib/auth';
import { Login } from './components/Login';
import { Nav } from './components/Nav';
import { PhotoGrid } from './components/PhotoGrid';
import { HeroesPage } from './components/HeroesPage';
import { ClientsPage } from './components/ClientsPage';

type Tab = 'photos' | 'heroes' | 'clients';

export function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [tab, setTab] = useState<Tab>('photos');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasUnpublished, setHasUnpublished] = useState(false);
  const [dirtyPhotoIds, setDirtyPhotoIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!authed) return;
    setLoading(true);
    setError('');
    getPhotos()
      .then(setPhotos)
      .catch(() => setError('Failed to load photos.'))
      .finally(() => setLoading(false));
  }, [authed]);

  function markDirty(photoId?: string) {
    setHasUnpublished(true);
    if (photoId) setDirtyPhotoIds(prev => new Set(prev).add(photoId));
  }

  function handlePublished() {
    setHasUnpublished(false);
    setDirtyPhotoIds(new Set());
  }

  if (!authed) return <Login onLogin={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      <Nav
        tab={tab}
        onTab={setTab}
        onLogout={() => setAuthed(false)}
        hasUnpublished={hasUnpublished}
        onPublished={handlePublished}
      />

      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-neutral-500">Loading…</span>
        </div>
      )}

      {error && (
        <div className="flex-1 flex items-center justify-center">
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          {tab === 'photos' && (
            <PhotoGrid
              photos={photos}
              dirtyPhotoIds={dirtyPhotoIds}
              onPhotosChange={(p, photoId) => { setPhotos(p); markDirty(photoId); }}
            />
          )}
          {tab === 'heroes' && <HeroesPage photos={photos} />}
          {tab === 'clients' && <ClientsPage />}
        </>
      )}
    </div>
  );
}
