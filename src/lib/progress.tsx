import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAccount } from './account';
import { localDateKey } from './knowledge';
import { useDailyProgress, type DailyProgress } from './useDailyProgress';

type ProgressValue = DailyProgress & { today: string };

const ProgressContext = createContext<ProgressValue | null>(null);

/** The local date, refreshed when the app comes back to the foreground (a new day may have begun). */
function useToday(): string {
  const [today, setToday] = useState(() => localDateKey(new Date()));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(localDateKey(new Date()));
    });
    return () => sub.remove();
  }, []);
  return today;
}

/** One Daily history for the whole app: Today, the Library and past days share it. */
export function ProgressProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const today = useToday();
  const progress = useDailyProgress({ userId: account.status === 'signedIn' ? (account.me?.id ?? null) : null, today });
  return <ProgressContext.Provider value={{ ...progress, today }}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressValue {
  const value = useContext(ProgressContext);
  if (!value) throw new Error('useProgress needs <ProgressProvider>');
  return value;
}
