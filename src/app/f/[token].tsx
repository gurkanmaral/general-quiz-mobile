import { useLocalSearchParams } from 'expo-router';
import { InviteOffer } from '@/components/InviteOffer';

/** kno://f/<token>: a friend link opened in the app. */
export default function FriendLinkScreen() {
  const { token = '' } = useLocalSearchParams<{ token: string }>();
  return <InviteOffer kind="friend" token={token} />;
}
