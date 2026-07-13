import { useState } from 'react';
import { clearToken } from '../lib/auth';
import { redeploy } from '../lib/api';

type Tab = 'photos' | 'heroes' | 'clients';
type PublishState = 'idle' | 'publishing' | 'done' | 'error';

interface Props {
  tab: Tab;
  onTab: (t: Tab) => void;
  onLogout: () => void;
  hasUnpublished: boolean;
  onPublished: () => void;
}

export function Nav({ tab, onTab, onLogout, hasUnpublished, onPublished }: Props) {
  const [publishState, setPublishState] = useState<PublishState>('idle');

  async function handlePublish() {
    setPublishState('publishing');
    try {
      await redeploy();
      setPublishState('done');
      onPublished();
      setTimeout(() => setPublishState('idle'), 4000);
    } catch {
      setPublishState('error');
      setTimeout(() => setPublishState('idle'), 4000);
    }
  }

  const publishLabel = {
    idle: 'Publish',
    publishing: 'Publishing…',
    done: 'Published ✓',
    error: 'Failed ✗',
  }[publishState];

  return (
    <nav className="border-b border-neutral-800 px-6 flex items-center gap-6 h-12 shrink-0">
      <span className="text-white font-semibold text-sm mr-2">Photos Admin</span>
      {(['photos', 'heroes', 'clients'] as Tab[]).map(t => (
        <button
          key={t}
          onClick={() => onTab(t)}
          className={`text-sm capitalize transition-colors ${
            tab === t ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
          }`}
        >
          {t}
        </button>
      ))}
      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={handlePublish}
          disabled={publishState === 'publishing'}
          className={`relative text-sm px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60 ${
            publishState === 'done'  ? 'bg-green-600 text-white' :
            publishState === 'error' ? 'bg-red-600 text-white' :
            'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
          }`}
        >
          {publishLabel}
          {hasUnpublished && publishState === 'idle' && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
          )}
        </button>
        <a
          href="https://portfolio-photos.pages.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          View site ↗
        </a>
        <button
          onClick={() => { clearToken(); onLogout(); }}
          className="text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
