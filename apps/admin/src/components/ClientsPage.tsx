import { useState, useEffect } from 'react';
import type { ClientGallery } from '../lib/api';
import { listClientGalleries, createClientGallery, deleteClientGallery } from '../lib/api';
import { cfImageUrl } from '../lib/cf-images';
import { ClientGalleryDetail } from './ClientGalleryDetail';
import { ClientEditModal } from './ClientEditModal';

const WORKER_URL = import.meta.env.VITE_WORKER_URL ?? '';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function ClientsPage() {
  const [galleries, setGalleries] = useState<ClientGallery[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<ClientGallery | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', id: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    listClientGalleries()
      .then(setGalleries)
      .finally(() => setLoading(false));
  }, []);

  function openCreate() {
    setForm({ name: '', id: '', password: '' });
    setError('');
    setCreating(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const gallery = await createClientGallery(form.id, form.name, form.password);
      setGalleries(prev => [{ ...gallery, photo_count: 0, created_at: new Date().toISOString() }, ...prev]);
      setCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(gallery: ClientGallery) {
    if (!confirm(`Delete "${gallery.name}" and all its photos? This cannot be undone.`)) return;
    await deleteClientGallery(gallery.id);
    setGalleries(prev => prev.filter(g => g.id !== gallery.id));
    if (selected === gallery.id) setSelected(null);
  }

  function copyLink(id: string) {
    const url = `https://juanr.photos/c/?g=${id}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  if (selected) {
    return (
      <ClientGalleryDetail
        galleryId={selected}
        onBack={() => { setSelected(null); listClientGalleries().then(setGalleries); }}
      />
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold">Client Galleries</h2>
          <p className="text-neutral-500 text-sm mt-0.5">Private, password-protected galleries for clients.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-white text-black text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-neutral-200 transition-colors"
        >
          New gallery
        </button>
      </div>

      {loading && <p className="text-neutral-500 text-sm">Loading…</p>}

      {!loading && galleries.length === 0 && (
        <p className="text-neutral-600 text-sm py-16 text-center">No client galleries yet.</p>
      )}

      <div className="space-y-2">
        {galleries.map(g => (
          <div key={g.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex items-center gap-4">
            {g.cover_photo_id ? (
              <img
                src={cfImageUrl(g.cover_photo_id, 'thumbnail')}
                alt={g.name}
                className="w-12 h-12 rounded-lg object-cover shrink-0 bg-neutral-800"
              />
            ) : (
              <div className="w-12 h-12 rounded-lg bg-neutral-800 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium">{g.name}</p>
              <p className="text-neutral-500 text-sm font-mono">/c/{g.id} · {g.photo_count} photo{g.photo_count !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => copyLink(g.id)}
                className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                {copiedId === g.id ? 'Copied!' : 'Copy link'}
              </button>
              <button
                onClick={() => setEditing(g)}
                className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => setSelected(g.id)}
                className="text-xs bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                Manage
              </button>
              <button
                onClick={() => handleDelete(g)}
                className="text-xs bg-red-900/40 hover:bg-red-900/70 text-red-400 px-3 py-1.5 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <ClientEditModal
          gallery={editing}
          onClose={() => setEditing(null)}
          onSaved={updated => {
            setGalleries(prev => prev.map(g => g.id === editing.id ? { ...updated, photo_count: g.photo_count } : g));
            setEditing(null);
          }}
        />
      )}

      {creating && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-950 border border-neutral-800 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-neutral-800">
              <h2 className="text-white font-semibold">New client gallery</h2>
              <button onClick={() => setCreating(false)} className="text-neutral-500 hover:text-white text-lg leading-none">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Client name</label>
                <input
                  type="text"
                  placeholder="Emma Johnson"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value, id: slugify(e.target.value) }))}
                  className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">URL slug</label>
                <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2">
                  <span className="text-neutral-600 text-sm">/c/</span>
                  <input
                    type="text"
                    value={form.id}
                    onChange={e => setForm(f => ({ ...f, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                    placeholder="emma-johnson"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-neutral-400 mb-1">Password <span className="text-neutral-600">(optional)</span></label>
                <input
                  type="text"
                  placeholder="Leave blank for a public link"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
                />
                <p className="text-neutral-600 text-xs mt-1">If set, the client must enter this to view the gallery.</p>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setCreating(false)} className="flex-1 bg-neutral-900 text-neutral-300 rounded-lg py-2.5 text-sm hover:bg-neutral-800 transition-colors">Cancel</button>
                <button type="submit" disabled={!form.id || !form.name || saving} className="flex-1 bg-white text-black rounded-lg py-2.5 text-sm font-medium disabled:opacity-40 hover:bg-neutral-200 transition-colors">
                  {saving ? 'Creating…' : 'Create gallery'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
