import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { api, getUserToken, setUserToken } from '../lib/api';
import { clearSyncState } from '../lib/sync';
import { useLibrary } from './LibraryContext';

interface Auth {
  username: string | null;
  signedIn: boolean;
  register: (username: string, password: string) => Promise<void>;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<Auth | null>(null);
const NAME_KEY = 'user-name';

export function AuthProvider({ children }: { children: ReactNode }) {
  const { applyRemote } = useLibrary();
  const [username, setUsername] = useState<string | null>(() => (getUserToken() ? localStorage.getItem(NAME_KEY) : null));

  const accept = useCallback((r: { token: string; username: string }) => {
    setUserToken(r.token);
    localStorage.setItem(NAME_KEY, r.username);
    setUsername(r.username);
  }, []);

  const signOut = useCallback(() => {
    setUserToken(null);
    localStorage.removeItem(NAME_KEY);
    clearSyncState();
    // Shared devices should not keep one person's favorites and places for the next person.
    applyRemote({ favorites: [], progress: {} });
    setUsername(null);
  }, [applyRemote]);

  const value = useMemo<Auth>(
    () => ({
      username,
      signedIn: !!username,
      register: async (u, p) => accept(await api.register(u, p)),
      signIn: async (u, p) => accept(await api.signIn(u, p)),
      signOut,
    }),
    [username, accept, signOut],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider missing');
  return v;
}
