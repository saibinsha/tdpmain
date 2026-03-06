type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

type ApiError = {
  status: number;
  message: string;
};

function getDefaultApiBase() {
  try {
    const host = window?.location?.hostname;
    if (host === 'localhost' || host === '127.0.0.1') return 'http://localhost:5000';
  } catch {
    // ignore
  }
  return 'https://telugudeshampartybackend.onrender.com';
}

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ||
  (import.meta as any).env?.VITE_API_URL ||
  getDefaultApiBase();

function getStoredTokens() {
  const raw = localStorage.getItem('tdp_tokens');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { accessToken: string; refreshToken: string };
  } catch {
    return null;
  }
}

function setStoredTokens(tokens: { accessToken: string; refreshToken: string } | null) {
  if (!tokens) {
    localStorage.removeItem('tdp_tokens');
    return;
  }
  localStorage.setItem('tdp_tokens', JSON.stringify(tokens));
}

async function request<T>(path: string, method: HttpMethod, body?: any, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = { status: res.status, message: data?.message || 'Request failed' };
    throw err;
  }
  return data as T;
}

async function authedRequest<T>(path: string, method: HttpMethod, body?: any): Promise<T> {
  const tokens = getStoredTokens();
  if (!tokens?.accessToken) {
    throw { status: 401, message: 'Unauthorized' } as ApiError;
  }

  try {
    return await request<T>(path, method, body, tokens.accessToken);
  } catch (e: any) {
    if (e?.status !== 401 || !tokens.refreshToken) throw e;

    const refreshed = await request<{ ok: true; tokens: { accessToken: string; refreshToken: string } }>(
      '/api/auth/refresh',
      'POST',
      { refreshToken: tokens.refreshToken }
    ).catch(async () => {
      return await request<{ ok: true; tokens: { accessToken: string; refreshToken: string } }>(
        '/api/admin/auth/refresh',
        'POST',
        { refreshToken: tokens.refreshToken }
      );
    });

    setStoredTokens(refreshed.tokens);
    return await request<T>(path, method, body, refreshed.tokens.accessToken);
  }
}

async function uploadSingle(file: File): Promise<{
  ok: true;
  file: { url: string; publicId: string; resourceType: string; bytes: number; originalname: string };
}> {
  const tokens = getStoredTokens();
  if (!tokens?.accessToken) {
    throw { status: 401, message: 'Unauthorized' } as ApiError;
  }

  const fd = new FormData();
  fd.append('file', file);

  const res = await fetch(`${API_BASE}/api/uploads/single`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = { status: res.status, message: data?.message || 'Upload failed' };
    throw err;
  }

  return data as any;
}

async function saveFcmToken(input: { userId: string; fcmToken: string }): Promise<{ ok: true }> {
  return await authedRequest<{ ok: true }>('/api/save-token', 'POST', input);
}

async function uploadCallRecording(input: {
  file: Blob;
  filename: string;
  mimeType: string;
  callId: string;
  scope: 'private' | 'group';
  kind: 'audio' | 'video';
  fromUserId?: string;
  toUserId?: string;
  groupId?: string;
  startedAt?: string;
  endedAt?: string;
  durationSec?: number;
}): Promise<{ ok: true; record: any }> {
  const tokens = getStoredTokens();
  if (!tokens?.accessToken) {
    throw { status: 401, message: 'Unauthorized' } as ApiError;
  }

  const fd = new FormData();
  fd.append('file', input.file, input.filename);
  fd.append('callId', input.callId);
  fd.append('scope', input.scope);
  fd.append('kind', input.kind);
  fd.append('mimeType', input.mimeType);
  if (input.fromUserId) fd.append('fromUserId', input.fromUserId);
  if (input.toUserId) fd.append('toUserId', input.toUserId);
  if (input.groupId) fd.append('groupId', input.groupId);
  if (input.startedAt) fd.append('startedAt', input.startedAt);
  if (input.endedAt) fd.append('endedAt', input.endedAt);
  if (input.durationSec !== undefined) fd.append('durationSec', String(input.durationSec));

  const res = await fetch(`${API_BASE}/api/call-records/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: fd,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: ApiError = { status: res.status, message: data?.message || 'Upload failed' };
    throw err;
  }

  return data as any;
}

export const api = {
  API_BASE,
  getStoredTokens,
  setStoredTokens,
  request,
  authedRequest,
  uploadSingle,
  uploadCallRecording,
  saveFcmToken,
};

export type { ApiError };
