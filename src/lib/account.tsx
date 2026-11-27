import { router, type Href } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { localize, type MeResponse } from '@/contracts';
import { deleteAccount as apiDeleteAccount, fetchMe, signOut as apiSignOut } from './api';
import { loadToken } from './session';

/** `unavailable`: the API could not be reached; the app behaves as signed out (NFR-4). */
export type AccountStatus = 'loading' | 'signedOut' | 'signedIn' | 'unavailable';
export type SignInStep = 'signIn' | 'signUp' | 'checkEmail' | 'profile';

export type AccountContextValue = {
  status: AccountStatus;
  me: MeResponse | null;
  /** True when signed in with a finished profile (Username + avatar). */
  ready: boolean;
  refresh: () => Promise<MeResponse | null>;
  signOut: () => Promise<void>;
  /** Deletes the account (FR-4) and signs out. Rejects when the API refuses. */
  deleteAccount: () => Promise<void>;
  /** Opens the sign-in screen at a step; after signing in the app goes to `returnTo`. */
  openSignIn: (step?: SignInStep, returnTo?: string) => void;
  /**
   * The sign-in gate (FR-5): true when the player may go on; otherwise opens sign-in (or the
   * profile step), remembering where to return, and returns false.
   */
  requireSignIn: (returnTo?: string) => boolean;
  /** A one-line message for the Today screen (e.g. after deleting the account). */
  banner: string | null;
  dismissBanner: () => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AccountStatus>('loading');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const mounted = useRef(true);

  const apply = useCallback((next: MeResponse | null) => {
    if (!mounted.current) return;
    setMe(next);
    setStatus(next ? 'signedIn' : 'signedOut');
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMe();
      apply(next);
      return next;
    } catch {
      if (mounted.current) setStatus((current) => (current === 'signedIn' ? current : 'unavailable'));
      return null;
    }
  }, [apply]);

  useEffect(() => {
    mounted.current = true;
    void loadToken().then(refresh);
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const openSignIn = useCallback((step: SignInStep = 'signIn', returnTo = '') => {
    router.push({ pathname: '/sign-in', params: { step, returnTo } });
  }, []);

  const ready = status === 'signedIn' && Boolean(me?.profileComplete);

  const requireSignIn = useCallback(
    (returnTo = '') => {
      if (ready) return true;
      openSignIn(status === 'signedIn' ? 'profile' : 'signIn', returnTo);
      return false;
    },
    [ready, status, openSignIn],
  );

  const signOut = useCallback(async () => {
    try {
      await apiSignOut();
    } catch {
      // The token is gone locally either way.
    } finally {
      apply(null);
    }
  }, [apply]);

  const deleteAccount = useCallback(async () => {
    await apiDeleteAccount();
    apply(null);
    setBanner('Your account and everything in it were deleted.');
    router.replace('/');
  }, [apply]);

  const dismissBanner = useCallback(() => setBanner(null), []);

  const value = useMemo<AccountContextValue>(
    () => ({ status, me, ready, refresh, signOut, deleteAccount, openSignIn, requireSignIn, banner, dismissBanner }),
    [status, me, ready, refresh, signOut, deleteAccount, openSignIn, requireSignIn, banner, dismissBanner],
  );
  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>;
}

export function useAccount(): AccountContextValue {
  const value = useContext(AccountContext);
  if (!value) throw new Error('useAccount needs <AccountProvider>');
  return value;
}

/** Goes to a remembered in-app location (only app paths like `/quizzes` or `/play/lotr`). */
export function goTo(target: string): void {
  if (/^\/[a-z0-9/_-]*$/i.test(target)) router.push(target as Href);
}

/** "Ada · Gandalf": a name with its equipped Title (FR-18). */
export function nameWithTitle(name: string, title: { name: { en: string; tr?: string } } | null | undefined): string {
  return title ? `${name} · ${localize(title.name)}` : name;
}
