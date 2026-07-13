import type { PhotoMeta, Ratio } from '../lib/api';

const GALLERIES = ['portraits', 'landscape', 'grad', 'boudoir', 'uncategorized'];
const RATIOS: Ratio[] = ['tall', 'wide', 'square'];

interface Props {
  meta: PhotoMeta;
  onChange: (meta: PhotoMeta) => void;
}

export function MetaForm({ meta, onChange }: Props) {
  function set<K extends keyof PhotoMeta>(key: K, value: PhotoMeta[K]) {
    onChange({ ...meta, [key]: value });
  }

  function toggleGallery(slug: string) {
    const current = meta.galleries ?? [];
    const next = current.includes(slug)
      ? current.filter(g => g !== slug)
      : [...current, slug];
    set('galleries', next);
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-neutral-400 mb-1">Title</label>
        <input
          type="text"
          value={meta.title ?? ''}
          onChange={e => set('title', e.target.value)}
          placeholder="Optional display title"
          className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-400 mb-1">Alt text</label>
        <input
          type="text"
          value={meta.alt ?? ''}
          onChange={e => set('alt', e.target.value)}
          placeholder="Describe the image for accessibility"
          className="w-full bg-neutral-900 text-white placeholder-neutral-600 border border-neutral-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-600"
        />
      </div>

      <div>
        <label className="block text-xs text-neutral-400 mb-1.5">Galleries</label>
        <div className="flex flex-wrap gap-2">
          {GALLERIES.map(g => {
            const active = (meta.galleries ?? []).includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGallery(g)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  active
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-neutral-400 border-neutral-700 hover:border-neutral-500'
                }`}
              >
                {g}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label className="block text-xs text-neutral-400 mb-1.5">Ratio</label>
        <div className="flex gap-2">
          {RATIOS.map(r => (
            <button
              key={r}
              type="button"
              onClick={() => set('ratio', r)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                meta.ratio === r
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-neutral-400 border-neutral-700 hover:border-neutral-500'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={meta.featured ?? false}
          onChange={e => set('featured', e.target.checked)}
          className="accent-white"
        />
        <span className="text-sm text-neutral-300">Featured</span>
      </label>
    </div>
  );
}
