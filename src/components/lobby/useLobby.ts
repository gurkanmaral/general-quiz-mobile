import { useCallback, useEffect, useRef, useState } from 'react';
import { LOBBY_COMMANDS, LOBBY_EVENTS, LOBBY_NAMESPACE, LobbyAckSchema, LobbyRemovedSchema, LobbyStateSchema, type LobbyAck, type LobbyState } from '@/contracts';
import { openSocket } from '@/lib/realtime';

export const JOIN_ERRORS: Record<string, string> = {
  'lobby.notFound': 'This Lobby has closed or the code is wrong.',
  'lobby.full': 'This Lobby is full (20 players).',
  'lobby.inProgress': 'This game has already started. You can join the next one.',
  'lobby.kicked': 'The Host removed you from this Lobby.',
  'lobby.profileIncomplete': 'Finish your profile first.',
};

export type Connection = { status: 'joining' } | { status: 'joined'; state: LobbyState } | { status: 'gone'; message: string };
export type Send = (event: string, payload?: unknown) => Promise<LobbyAck>;

/** The Lobby socket for one code: joins (and rejoins after reconnects), and follows `lobby:state`. */
export function useLobby(code: string, enabled: boolean): { connection: Connection; send: Send } {
  const [connection, setConnection] = useState<Connection>({ status: 'joining' });
  const socketRef = useRef<ReturnType<typeof openSocket> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    setConnection({ status: 'joining' });
    const socket = openSocket(LOBBY_NAMESPACE);
    socketRef.current = socket;
    const join = () =>
      socket.emit(LOBBY_COMMANDS.join, { code }, (reply: unknown) => {
        const ack = LobbyAckSchema.safeParse(reply);
        if (ack.success && !ack.data.ok) setConnection({ status: 'gone', message: JOIN_ERRORS[ack.data.code] ?? "Couldn't join this Lobby." });
      });
    socket.on(LOBBY_EVENTS.state, (payload: unknown) => {
      const state = LobbyStateSchema.safeParse(payload);
      if (state.success) setConnection({ status: 'joined', state: state.data });
    });
    socket.on(LOBBY_EVENTS.removed, (payload: unknown) => {
      const removed = LobbyRemovedSchema.safeParse(payload);
      if (!removed.success) return;
      setConnection({ status: 'gone', message: removed.data.reason === 'kicked' ? JOIN_ERRORS['lobby.kicked']! : 'This Lobby has closed.' });
    });
    // Every (re)connection joins again, so a dropped player continues where the game is (FR-33).
    socket.on('connect', join);
    if (socket.connected) join();
    return () => {
      socketRef.current = null;
      socket.close();
    };
  }, [code, enabled]);

  const send = useCallback<Send>(
    (event, payload) =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket) return resolve({ ok: false, code: 'lobby.notInLobby' });
        socket.emit(event, payload, (reply: unknown) => {
          const ack = LobbyAckSchema.safeParse(reply);
          resolve(ack.success ? ack.data : { ok: false, code: 'lobby.invalid' });
        });
      }),
    [],
  );
  return { connection, send };
}

/** Milliseconds left until a server time, using the offset between server and device clocks. */
export function useCountdown(deadline: string, serverNow: string): number {
  const [offset] = useState(() => Date.parse(serverNow) - Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  return Math.max(0, Date.parse(deadline) - (now + offset));
}
