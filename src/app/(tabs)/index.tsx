import { DailyScreen } from '@/components/daily/DailyScreen';
import { useProgress } from '@/lib/progress';

/** Today's Daily (the web's `#today`). */
export default function TodayScreen() {
  const { today } = useProgress();
  return <DailyScreen viewKey={today} />;
}
