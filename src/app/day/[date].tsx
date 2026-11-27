import { Redirect, useLocalSearchParams } from 'expo-router';
import { isCalendarDate } from '@/contracts';
import { DailyScreen } from '@/components/daily/DailyScreen';
import { useProgress } from '@/lib/progress';

/** A Library day (`/day/2026-11-24`): the same Daily, for a past date. */
export default function DayScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { today } = useProgress();
  if (!date || !isCalendarDate(date) || date > today) return <Redirect href="/" />;
  return <DailyScreen viewKey={date} />;
}
