import { io, type Socket } from 'socket.io-client';
import { SOCKET_PATH } from '@/contracts';
import { API_URL } from './config';
import { getToken } from './session';

/**
 * Opens a Socket.IO namespace on the API. Native clients authenticate with the session token in
 * the handshake (`auth.token`); the server turns it into a bearer header (AD-12).
 */
export function openSocket(namespace: string): Socket {
  return io(`${API_URL}${namespace}`, {
    path: SOCKET_PATH,
    transports: ['websocket'],
    // Read the token on every (re)connect so a fresh sign-in is picked up.
    auth: (callback) => callback({ token: getToken() ?? '' }),
  });
}
