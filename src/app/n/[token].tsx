import { useLocalSearchParams } from 'expo-router';
import { InviteOffer } from '@/components/InviteOffer';

/** kno://n/<token>: a Nudge Link opened in the app. */
export default function NudgeLinkScreen() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  return <InviteOffer kind="nudge" token={token} />;
}
