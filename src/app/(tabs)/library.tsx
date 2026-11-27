import { useProgress } from '@/lib/progress';
import { AppHeader, Screen } from '@/ui/Screen';
import { LibraryList, StreakCard, WeekStrip } from '@/components/daily/Week';

/** The Library tab (the web's `#library`): Streak, the last five days and missed Dailies. */
export default function LibraryScreen() {
  const { reload } = useProgress();
  return (
    <Screen header={<AppHeader />} onRefresh={reload}>
      <StreakCard />
      <WeekStrip />
      <LibraryList />
    </Screen>
  );
}
