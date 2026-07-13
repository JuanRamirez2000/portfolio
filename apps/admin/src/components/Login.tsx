import { useState } from 'react';
import { setToken } from '../lib/auth';
import { getPhotos } from '../lib/api';

interface Props {
  onLogin: () => void;
}

export function Login({ onLogin }: Props) {
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setToken(secret);
    try {
      await getPhotos();
      onLogin();
    } catch {
      setError('Wrong secret — try again.');
      setToken('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-8">
        <h1 className="text-white text-2xl font-semibold">Photos Admin</h1>
        <input
          type="password"
          placeholder="Upload secret"
          value={secret}
          onChange={e => setSecret(e.target.value)}
          className="w-full bg-neutral-900 text-white placeholder-neutral-500 border border-neutral-800 rounded-lg px-4 py-2.5 focus:outline-none focus:border-neutral-600"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={!secret || loading}
          className="w-full bg-white text-black rounded-lg py-2.5 font-medium disabled:opacity-40 hover:bg-neutral-200 transition-colors"
        >
          {loading ? 'Checking…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
