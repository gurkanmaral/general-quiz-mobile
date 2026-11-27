import { router, useLocalSearchParams, useNavigation, usePreventRemove } from 'expo-router';
import { useEffect } from 'react';
import { LOBBY_COMMANDS } from '@/contracts';
import { useAccount } from '@/lib/account';
import { confirm } from '@/lib/confirm';
import { LiveStandings, PodiumActions, PodiumView, QuestionTimer, QuestionView, RevealView } from '@/components/lobby/Game';
import { useLobby } from '@/components/lobby/useLobby';
import { WaitingActions, WaitingRoom } from '@/components/lobby/WaitingRoom';
import { BackBar, Screen } from '@/ui/Screen';
import { Block, Button, ErrorText, Note, Skeleton } from '@/ui/kit';

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
  const navigation = useNavigation();
  const joined = connection.status === 'joined';
  const phase = joined ? connection.state.phase : null;

  // Swiping back, the Android back button, the back arrow and Leave all ask first, then leave the Lobby.
  usePreventRemove(joined, ({ data }) => {
    const playing = phase === 'question' || phase === 'reveal';
    void confirm({
      title: playing ? 'Leave the game?' : 'Leave the Lobby?',
      message: playing ? 'The game goes on without you.' : 'You can rejoin with the link while the Lobby is open.',
      action: 'Leave',
      cancel: 'Stay',
    }).then((leave) => {
      if (!leave) return;
      void send(LOBBY_COMMANDS.leave);
      navigation.dispatch(data.action);
    });
  });

  const header = (
    <BackBar
      title={phase === 'question' || phase === 'reveal' ? 'Live game' : `Lobby ${code}`}
      onBack={() => router.navigate('/quizzes')}
      right={joined && phase === 'question' ? <QuestionTimer state={connection.state} /> : undefined}
    />
  );
  const footer = !joined ? undefined : phase === 'waiting' ? <WaitingActions state={connection.state} send={send} /> : phase === 'podium' ? <PodiumActions state={connection.state} send={send} /> : undefined;

  if (!ready) {
    return (
      <Screen header={header}>
        <Note action={{ label: 'Sign in', onPress: () => requireSignIn(`/lobby/${code}`) }}>Sign in to join this Lobby.</Note>
      </Screen>
    );
  }
  return (
    <Screen header={header} footer={footer}>
      {connection.status === 'joining' && <Skeleton count={2} height={200} label={`Joining Lobby ${code}`} />}
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
      {connection.status === 'joined' && connection.state.phase === 'podium' && <PodiumView state={connection.state} />}
    </Screen>
  );
}
