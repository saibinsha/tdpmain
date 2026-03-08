import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/lib/api';

export default function GoogleAuthCallback() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const payloadB64 = sp.get('payload');
    if (!payloadB64) {
      setError('Missing payload');
      return;
    }

    try {
      const json = atob(payloadB64);
      const parsed = JSON.parse(json) as {
        ok: boolean;
        user?: any;
        tokens?: { accessToken: string; refreshToken: string };
        message?: string;
      };

      if (!parsed?.ok || !parsed.user || !parsed.tokens?.accessToken) {
        setError(parsed?.message || 'Google login failed');
        return;
      }

      api.setStoredTokens(parsed.tokens);
      localStorage.setItem('tdp_user', JSON.stringify(parsed.user));

      navigate('/', { replace: true });
      window.location.reload();
    } catch (e: any) {
      setError(e?.message || 'Google login failed');
    }
  }, [navigate, sp]);

  if (!error) return null;

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-6 text-center">
        <div className="text-lg font-semibold text-gray-900">Login failed</div>
        <div className="mt-2 text-sm text-gray-600">{error}</div>
        <button
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium"
          onClick={() => navigate('/', { replace: true })}
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
