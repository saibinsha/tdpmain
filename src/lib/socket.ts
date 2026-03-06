import { io, type Socket } from 'socket.io-client';
import { api as apiHelpers } from '@/lib/api';

let socket: Socket | null = null;
let lastToken: string | null = null;

export function getSocket(): Socket | null {
  return socket;
}

export function connectSocket(): Socket {
  const tokens = apiHelpers.getStoredTokens();
  const token = tokens?.accessToken;
  if (!token) {
    throw new Error('Unauthorized');
  }

  if (socket && socket.connected && lastToken === token) return socket;

  const baseUrl = String(apiHelpers.API_BASE || '').replace(/\/+$/, '');

  const isAndroidWebView = (() => {
    try {
      const ua = navigator?.userAgent || '';
      return Boolean((window as any).Android) || /; wv\)/i.test(ua) || /Version\/[\d.]+.*Chrome\/[\d.]+/i.test(ua);
    } catch {
      return false;
    }
  })();

  const transports: any = isAndroidWebView ? ['websocket'] : ['websocket', 'polling'];

  socket = io(baseUrl, {
    transports,
    auth: { token },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
  });

  lastToken = token;

  socket.io.on('reconnect_attempt', () => {
    try {
      const t = apiHelpers.getStoredTokens()?.accessToken;
      if (t) {
        socket!.auth = { token: t } as any;
        lastToken = t;
      }
    } catch {
      // ignore
    }
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
