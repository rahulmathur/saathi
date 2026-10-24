import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ApiError, request } from './api';
import { getItem, removeItem, setItem } from './storage';

type Mode = 'loading' | 'signedOut' | 'family' | 'parent';

interface SessionValue {
  mode: Mode;
  token: string | null;
  signIn(token: string, mode: 'family' | 'parent'): Promise<void>;
  signOut(): Promise<void>;
  /** Calls the API with this session's token; signs out if the session has expired. */
  api<T>(method: string, path: string, body?: unknown): Promise<T>;
}

const TOKEN_KEY = 'saathi.token';
const MODE_KEY = 'saathi.mode';

/**
 * Set just before a brand-new account signs in. The sign-in screens disappear as
 * soon as the session changes, so the home screen picks this up and opens setup.
 */
export const onboarding = { pending: false };

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>('loading');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [t, m] = await Promise.all([getItem(TOKEN_KEY), getItem(MODE_KEY)]);
      if (t && (m === 'family' || m === 'parent')) {
        setToken(t);
        setMode(m);
      } else {
        setMode('signedOut');
      }
    })();
  }, []);

  const signIn = useCallback(async (t: string, m: 'family' | 'parent') => {
    await Promise.all([setItem(TOKEN_KEY, t), setItem(MODE_KEY, m)]);
    setToken(t);
    setMode(m);
  }, []);

  const signOut = useCallback(async () => {
    const t = token;
    await Promise.all([removeItem(TOKEN_KEY), removeItem(MODE_KEY)]);
    setToken(null);
    setMode('signedOut');
    if (t) request('POST', '/auth/logout', undefined, t).catch(() => {});
  }, [token]);

  const api = useCallback(
    async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      try {
        return await request<T>(method, path, body, token);
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) await signOut();
        throw e;
      }
    },
    [token, signOut],
  );

  const value = useMemo(() => ({ mode, token, signIn, signOut, api }), [mode, token, signIn, signOut, api]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(SessionContext);
  if (!v) throw new Error('useSession must be used inside SessionProvider');
  return v;
}
