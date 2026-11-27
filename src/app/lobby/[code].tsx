import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { useAccount } from '@/lib/account';
import { LiveStandings, PodiumView, QuestionView, RevealView } from '@/components/lobby/Game';
import { useLobby } from '@/components/lobby/useLobby';
import { WaitingRoom } from '@/components/lobby/WaitingRoom';
import { BackBar, Screen } from '@/ui/Screen';
import { Block, Button, ErrorText, Note } from '@/ui/kit';

/** A Lobby (`/lobby/<code>`, FR-27–FR-34): sign-in only; the server sends each player their view. */
export default function LobbyScreen() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = (params.code ?? '').toUpperCase();
  const { status, ready, requireSignIn } = useAccount();
  useEffect(() => {
    // Signed-out players sign in first, then come back here (FR-28).
    if (status === 'signedOut' || status === 'unavailable') requireSignIn(`/lobby/${code}`);
  }, [status, code, requireSignIn]);
  const { connection, send } = useLobby(code, ready);
  const header = <BackBar title={`Lobby ${code}`} onBack={() => router.navigate('/quizzes')} />;

  if (!ready) {
    return (
      <Screen header={header}>
        <Note action={{ label: 'Sign in', onPress: () => requireSignIn(`/lobby/${code}`) }}>Sign in to join this Lobby.</Note>
      </Screen>
    );
  }
  return (
    <Screen header={header}>
      {connection.status === 'joining' && <Note>Joining Lobby {code}…</Note>}
      {connection.status === 'gone' && (
        <Block offset={8} radius={24} border={3} style={{ padding: 18, gap: 14 }}>
          <ErrorText>{connection.message}</ErrorText>
          <Button label="Back to Quizzes" tone="white" onPress={() => router.navigate('/quizzes')} />
        </Block>
      )}
      {connection.status === 'joined' && connection.state.phase === 'waiting' && <WaitingRoom state={connection.state} send={send} />}
      {connection.status === 'joined' && connection.state.phase === 'question' && <QuestionView key={connection.state.question!.index} state={connection.state} send={send} />}
      {connection.status === 'joined' && connection.state.phase === 'reveal' && <RevealView state={connection.state} />}
      {connection.status === 'joined' && (connection.state.phase === 'question' || connection.state.phase === 'reveal') && <LiveStandings state={connection.state} />}
      {connection.status === 'joined' && connection.state.phase === 'podium' && <PodiumView state={connection.state} send={send} />}
    </Screen>
  );
}
