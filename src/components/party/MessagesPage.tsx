import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import {
  Send, Search, Image, Paperclip, Smile, Phone, Video, MoreVertical,
  Users, Globe, User, ArrowLeft, Hash
} from 'lucide-react';

import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

type ChatMedia = { url: string; publicId?: string; resourceType?: string } | null;

type ChatMessage = {
  _id: string;
  from: any;
  to?: any;
  text: string;
  media?: ChatMedia;
  createdAt: string;
  deletedAt?: string | null;
  deletedBy?: any;
};

type DirectoryUser = {
  _id: string;
  name: string;
  membershipId?: string;
  profilePicture?: string;
  role?: string;
  status?: string;
};

type ConversationItem = {
  type: 'private';
  otherUser: {
    _id: string;
    name: string;
    membershipId?: string;
    profilePicture?: string;
    role?: string;
    status?: string;
  };
  lastMessage?: {
    _id: string;
    text: string;
    createdAt: string;
    media?: ChatMedia;
  };
};

function inferMediaType(media?: ChatMedia): 'image' | 'video' | 'audio' | 'file' | null {
  if (!media?.url) return null;

  const rt = String(media.resourceType || '').toLowerCase();
  if (rt === 'image' || rt === 'video' || rt === 'audio') return rt as any;

  const url = media.url.toLowerCase();
  if (/(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.bmp|\.svg)(\?|#|$)/.test(url)) return 'image';
  if (/(\.mp4|\.webm|\.mov|\.m4v|\.mkv)(\?|#|$)/.test(url)) return 'video';
  if (/(\.mp3|\.wav|\.m4a|\.aac|\.ogg)(\?|#|$)/.test(url)) return 'audio';
  return 'file';
}

function isDeletedMessage(msg: ChatMessage) {
  return Boolean(msg?.deletedAt) || (!msg?.text && !msg?.media);
}

function renderMediaPreview(media: ChatMedia, isOwn: boolean) {
  const type = inferMediaType(media);
  if (!type || !media?.url) return null;

  const linkClass = `text-xs underline ${isOwn ? 'text-white' : 'text-blue-600'}`;

  if (type === 'image') {
    return (
      <a href={media.url} target="_blank" rel="noreferrer" className="block mt-2">
        <img
          src={media.url}
          alt="Attachment"
          className="w-40 h-40 object-cover rounded-xl border border-white/10"
          loading="lazy"
        />
      </a>
    );
  }

  if (type === 'video') {
    return (
      <div className="mt-2">
        <video src={media.url} controls className="w-56 rounded-xl" />
      </div>
    );
  }

  if (type === 'audio') {
    return (
      <div className="mt-2">
        <audio src={media.url} controls className="w-56" />
      </div>
    );
  }

  return (
    <div className="mt-2">
      <a href={media.url} target="_blank" rel="noreferrer" className={linkClass}>
        View attachment
      </a>
    </div>
  );
}

const MessagesPage: React.FC = () => {
  const { setCurrentPage, isAuthenticated, setShowLoginModal, user, dmTargetUserId, setDmTargetUserId } = useAppContext();
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userResults, setUserResults] = useState<DirectoryUser[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [callOpen, setCallOpen] = useState(false);
  const [callIncoming, setCallIncoming] = useState(false);
  const [callKind, setCallKind] = useState<'audio' | 'video'>('audio');
  const [callId, setCallId] = useState<string | null>(null);
  const [callOther, setCallOther] = useState<{ _id: string; name: string } | null>(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callCamOff, setCallCamOff] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'>('calling');

  const callIdRef = useRef<string | null>(null);

  const [presenceOnline, setPresenceOnline] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('tdp_presence_online');
      return raw ? (JSON.parse(raw) as any) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const sync = () => {
      try {
        const raw = localStorage.getItem('tdp_presence_online');
        setPresenceOnline(raw ? (JSON.parse(raw) as any) : {});
      } catch {
        // ignore
      }
    };

    const onChanged = () => sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'tdp_presence_online') sync();
    };

    window.addEventListener('tdp_presence_changed', onChanged as any);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('tdp_presence_changed', onChanged as any);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const pendingIceRef = useRef<any[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  const recCtxRef = useRef<AudioContext | null>(null);
  const recDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recStartedAtRef = useRef<number | null>(null);
  const recUploadingRef = useRef(false);

  const callSocketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

  const ringtoneRef = useRef<HTMLAudioElement | null>(null);

  const iceServers = useMemo(
    () => {
      const turnUrlsRaw = String((import.meta as any).env?.VITE_TURN_URLS || '').trim();
      const turnUsername = String((import.meta as any).env?.VITE_TURN_USERNAME || '').trim();
      const turnCredential = String((import.meta as any).env?.VITE_TURN_CREDENTIAL || '').trim();

      const ice: any[] = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
      ];

      const turnUrls = turnUrlsRaw
        ? turnUrlsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      if (turnUrls.length && turnUsername && turnCredential) {
        ice.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
      }

      return { iceServers: ice };
    },
    []
  );

  const stopRecording = () => {
    const recorder = recRecorderRef.current;
    if (!recorder) return;

    try {
      if (recorder.state !== 'inactive') recorder.stop();
    } catch {
      // ignore
    }
  };

  const startRecordingIfPossible = () => {
    if (recRecorderRef.current) return;
    if (!callId) return;

    const local = localStreamRef.current;
    const remote = remoteStreamRef.current;
    const localTracks = local?.getAudioTracks?.() || [];
    const remoteTracks = remote?.getAudioTracks?.() || [];
    if (localTracks.length === 0 && remoteTracks.length === 0) return;

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const dest = ctx.createMediaStreamDestination();
      recCtxRef.current = ctx;
      recDestRef.current = dest;

      for (const t of localTracks) {
        const s = new MediaStream([t]);
        const src = ctx.createMediaStreamSource(s);
        src.connect(dest);
      }
      for (const t of remoteTracks) {
        const s = new MediaStream([t]);
        const src = ctx.createMediaStreamSource(s);
        src.connect(dest);
      }

      const stream = dest.stream;
      const preferred = 'audio/webm;codecs=opus';
      const mimeType = (window as any).MediaRecorder?.isTypeSupported?.(preferred) ? preferred : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recRecorderRef.current = recorder;
      recChunksRef.current = [];
      recStartedAtRef.current = Date.now();

      recorder.ondataavailable = (ev: BlobEvent) => {
        if (ev.data && ev.data.size > 0) recChunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const chunks = recChunksRef.current;
        recChunksRef.current = [];

        const startedAt = recStartedAtRef.current;
        recStartedAtRef.current = null;

        try {
          recDestRef.current = null;
          if (recCtxRef.current) await recCtxRef.current.close();
        } catch {
          // ignore
        }
        recCtxRef.current = null;
        recRecorderRef.current = null;

        if (!chunks.length) return;
        if (recUploadingRef.current) return;
        if (!callId) return;
        if (!user?.id) return;
        if (!callOther?._id) return;

        recUploadingRef.current = true;
        try {
          const endedAt = Date.now();
          const durationSec = startedAt ? Math.max(0, Math.round((endedAt - startedAt) / 1000)) : undefined;
          const blob = new Blob(chunks, { type: 'audio/webm' });

          await api.uploadCallRecording({
            file: blob,
            filename: `call-${callId}.webm`,
            mimeType: 'audio/webm',
            callId,
            scope: 'private',
            kind: callKind,
            fromUserId: String(user.id),
            toUserId: String(callOther._id),
            startedAt: startedAt ? new Date(startedAt).toISOString() : undefined,
            endedAt: new Date(endedAt).toISOString(),
            durationSec,
          });
        } catch {
          // ignore
        } finally {
          recUploadingRef.current = false;
        }
      };

      recorder.start(1000);
    } catch {
      // ignore
    }
  };

  const cleanupCall = () => {
    stopRecording();

    pendingIceRef.current = [];

    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      ringtoneRef.current = null;
    }

    try {
      pcRef.current?.close();
    } catch {
      // ignore
    }
    pcRef.current = null;

    for (const s of [localStreamRef.current, remoteStreamRef.current]) {
      if (s) {
        for (const t of s.getTracks()) {
          try {
            t.stop();
          } catch {
            // ignore
          }
        }
      }
    }
    localStreamRef.current = null;
    remoteStreamRef.current = null;

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

    setCallOpen(false);
    setCallIncoming(false);
    setCallId(null);
    callIdRef.current = null;
    setCallOther(null);
    setCallMuted(false);
    setCallCamOff(false);
    setCallStatus('ended');
  };

  useEffect(() => {
    callIdRef.current = callId;
  }, [callId]);

  const startTone = (_mode: 'ring' | 'ringback') => {
    if (ringtoneRef.current) return;
    const a = new Audio(_mode === 'ring' ? '/ringtone.mp3' : '/ring.mp3');
    a.loop = true;
    ringtoneRef.current = a;
    a.play().catch(() => {
      // ignore
    });
  };

  const stopTone = () => {
    if (!ringtoneRef.current) return;
    try {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    } catch {
      // ignore
    }
    ringtoneRef.current = null;
  };

  const ensurePc = (sock: any, id: string) => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection(iceServers);
    pcRef.current = pc;

    pendingIceRef.current = [];

    setCallStatus('connecting');

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'connected') {
        setCallStatus('connected');
        stopTone();
        startRecordingIfPossible();
      } else if (st === 'connecting' || st === 'new') {
        setCallStatus('connecting');
      } else if (st === 'failed' || st === 'disconnected') {
        setCallStatus('ended');
        stopRecording();
      }
    };

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState;
      if (st === 'connected' || st === 'completed') {
        setCallStatus('connected');
        stopTone();
        startRecordingIfPossible();
      } else if (st === 'checking') {
        setCallStatus('connecting');
      } else if (st === 'failed' || st === 'disconnected') {
        setCallStatus('ended');
        stopRecording();
      }
    };

    const remote = new MediaStream();
    remoteStreamRef.current = remote;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;

    pc.ontrack = (ev) => {
      for (const track of ev.streams?.[0]?.getTracks?.() || []) {
        if (!remote.getTracks().some((t) => t.id === track.id)) remote.addTrack(track);
      }
      for (const track of ev.track ? [ev.track] : []) {
        if (!remote.getTracks().some((t) => t.id === track.id)) remote.addTrack(track);
      }
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      sock.emit('call:ice', { callId: id, candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate });
    };

    return pc;
  };

  const startLocalMedia = async (kind: 'audio' | 'video') => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video',
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const toggleMute = () => {
    const next = !callMuted;
    setCallMuted(next);
    const s = localStreamRef.current;
    if (!s) return;
    for (const t of s.getAudioTracks()) t.enabled = !next;
  };

  const toggleCam = () => {
    const next = !callCamOff;
    setCallCamOff(next);
    const s = localStreamRef.current;
    if (!s) return;
    for (const t of s.getVideoTracks()) t.enabled = !next;
  };

  const hangup = () => {
    const s = callSocketRef.current;
    if (s && callId) {
      s.emit('call:hangup', { callId });
    }
    cleanupCall();
  };

  const placeCall = async (kind: 'audio' | 'video', opts?: { autoAnswer?: boolean }) => {
    if (!activeConversation?.otherUser?._id) return;
    const otherId = String(activeConversation.otherUser._id);
    const otherName = String(activeConversation.otherUser.name || 'Member');

    const isAdmin = user?.role === 'admin';

    const sock = connectSocket();
    callSocketRef.current = sock;

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setCallKind(kind);
    setCallId(id);
    callIdRef.current = id;
    setCallOther({ _id: otherId, name: otherName });
    setCallIncoming(false);
    setCallOpen(true);
    setCallStatus('calling');
    startTone('ringback');

    await startLocalMedia(kind);
    const pc = ensurePc(sock, id);
    for (const track of localStreamRef.current?.getTracks() || []) {
      pc.addTrack(track, localStreamRef.current as MediaStream);
    }
    sock.emit('call:invite', { toUserId: otherId, callId: id, kind, autoAnswer: Boolean(opts?.autoAnswer) || isAdmin });
  };

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const raw = localStorage.getItem('tdp_admin_auto_call');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const toUserId = String(parsed?.toUserId || '').trim();
      const kind = parsed?.kind === 'video' ? 'video' : 'audio';
      const autoAnswer = Boolean(parsed?.autoAnswer);
      if (!toUserId) return;

      localStorage.removeItem('tdp_admin_auto_call');

      // If messages page hasn't yet selected the conversation, allow existing dmTargetUserId effect to run.
      setTimeout(() => {
        if (String(activeUserId || '') !== toUserId) {
          setActiveUserId(toUserId);
          setShowMobileChat(true);
        }
        setTimeout(() => {
          void placeCall(kind, { autoAnswer });
        }, 150);
      }, 50);
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  const acceptIncoming = async (incomingCallId?: string) => {
    const id = String(incomingCallId || callId || '').trim();
    if (!id) return;

    const sock = callSocketRef.current || connectSocket();
    if (!callSocketRef.current) callSocketRef.current = sock;

    setCallId(id);
    callIdRef.current = id;
    setCallIncoming(false);
    setCallOpen(true);
    setCallStatus('connecting');
    stopTone();

    await startLocalMedia(callKind);
    const pc = ensurePc(sock, id);
    for (const track of localStreamRef.current?.getTracks() || []) {
      pc.addTrack(track, localStreamRef.current as MediaStream);
    }

    sock.emit('call:accept', { callId: id });
  };

  const rejectIncoming = () => {
    const sock = callSocketRef.current || connectSocket();
    if (!callSocketRef.current) callSocketRef.current = sock;
    if (callId) sock.emit('call:reject', { callId });
    cleanupCall();
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const name = c?.otherUser?.name || '';
      return name.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [conversations, searchQuery]);

  const activeConversation = useMemo(() => {
    if (!activeUserId) return null;
    return conversations.find((c) => String(c.otherUser._id) === String(activeUserId)) || null;
  }, [activeUserId, conversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeUserId, messages.length]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let alive = true;
    setLoadingConversations(true);
    setError('');

    api
      .authedRequest<{ ok: true; items: ConversationItem[] }>('/api/messages/conversations?limit=50', 'GET')
      .then((res) => {
        if (!alive) return;
        setConversations(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load conversations');
      })
      .finally(() => {
        if (!alive) return;
        setLoadingConversations(false);
      });

    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!dmTargetUserId) return;
    setActiveUserId(dmTargetUserId);
    setShowMobileChat(true);
  }, [dmTargetUserId, isAuthenticated]);

  useEffect(() => {
    if (!activeUserId) {
      setShowMobileChat(false);
    }
  }, [activeUserId]);

  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const raw = localStorage.getItem('tdp_pending_incoming_call');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.scope !== 'private') return;
      if (!parsed.callId || !parsed.fromUserId) return;

      setCallId(String(parsed.callId));
      setCallKind(parsed.kind === 'video' ? 'video' : 'audio');
      setCallOther({ _id: String(parsed.fromUserId), name: String(parsed.fromName || 'Member') });

      const aa = Boolean(parsed?.autoAnswer) || String(parsed?.autoAnswer || '') === '1';
      if (aa) {
        setCallIncoming(false);
        setCallOpen(true);
        setCallStatus('connecting');
        stopTone();
        setTimeout(() => {
          void acceptIncoming(String(parsed.callId));
        }, 50);
      } else {
        setCallIncoming(true);
        setCallOpen(true);
        setCallStatus('ringing');
        startTone('ring');
      }

      localStorage.removeItem('tdp_pending_incoming_call');
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const s = connectSocket();
    callSocketRef.current = s;

    const onPresenceState = (payload: any) => {
      const ids: string[] = Array.isArray(payload?.onlineUserIds) ? payload.onlineUserIds.map((x: any) => String(x)) : [];
      setPresenceOnline(() => {
        const next: Record<string, boolean> = {};
        for (const id of ids) next[String(id)] = true;
        return next;
      });
    };

    const onPresenceUpdate = (payload: any) => {
      const uid = String(payload?.userId || '').trim();
      if (!uid) return;
      const online = Boolean(payload?.online);
      setPresenceOnline((prev) => ({ ...prev, [uid]: online }));
    };

    const onNew = (msg: ChatMessage) => {
      const fromId = String(msg?.from?._id || msg?.from);
      const toId = String(msg?.to?._id || msg?.to);
      const me = String(user?.id);

      const other = fromId === me ? toId : fromId;
      if (!other) return;

      setConversations((prev) => {
        const idx = prev.findIndex((c) => String(c.otherUser._id) === String(other));
        const updated: ConversationItem = idx >= 0 ? prev[idx] : ({
          type: 'private',
          otherUser: { _id: other, name: 'Member' },
        } as any);

        const nextItem: ConversationItem = {
          ...updated,
          lastMessage: {
            _id: msg._id,
            text: msg.text,
            createdAt: msg.createdAt,
            media: msg.media,
          },
        };

        const rest = prev.filter((_, i) => i !== idx);
        return [nextItem, ...rest];
      });

      if (String(activeUserId) === String(other)) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    s.on('private:new', onNew);
    s.on('presence:state', onPresenceState);
    s.on('presence:update', onPresenceUpdate);

    const onIncoming = (payload: any) => {
      const me = String(user?.id);
      const fromId = String(payload?.from?._id || '');
      if (!fromId || fromId === me) return;

      setCallId(String(payload.callId));
      setCallKind(payload.kind === 'video' ? 'video' : 'audio');
      setCallOther({ _id: fromId, name: String(payload?.from?.name || 'Member') });

      const isAdminCaller = String(payload?.from?.role || '').toLowerCase() === 'admin';
      const aa = isAdminCaller || Boolean(payload?.autoAnswer) || String(payload?.autoAnswer || '') === '1';
      if (aa) {
        setCallIncoming(false);
        setCallOpen(true);
        setCallStatus('connecting');
        stopTone();
        setTimeout(() => {
          void acceptIncoming(String(payload.callId));
        }, 50);
        return;
      }

      setCallIncoming(true);
      setCallOpen(true);
      setCallStatus('ringing');
      startTone('ring');
    };

    const onAccepted = async (payload: any) => {
      const id = String(payload?.callId || '');
      if (!id || id !== String(callIdRef.current || '')) return;
      const sock = callSocketRef.current;
      if (!sock) return;
      const pc = pcRef.current;
      if (!pc) return;

      setCallStatus('connecting');
      stopTone();

      if (pc.signalingState !== 'stable') {
        try {
          await pc.setLocalDescription({ type: 'rollback' } as any);
        } catch {
          // ignore
        }
      }

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sock.emit('call:offer', { callId: id, sdp: offer });
    };

    const onRejected = (payload: any) => {
      const id = String(payload?.callId || '');
      if (!id || id !== String(callIdRef.current || '')) return;
      cleanupCall();
    };

    const onOffer = async (payload: any) => {
      const id = String(payload?.callId || '');
      if (!id) return;
      if (String(callIdRef.current || '') !== id) return;
      const sock = callSocketRef.current;
      if (!sock) return;

      const pc = ensurePc(sock, id);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

      if (pendingIceRef.current.length) {
        const queued = [...pendingIceRef.current];
        pendingIceRef.current = [];
        for (const c of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {
            // ignore
          }
        }
      }

      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      sock.emit('call:answer', { callId: id, sdp: ans });
    };

    const onAnswer = async (payload: any) => {
      const id = String(payload?.callId || '');
      if (!id || id !== String(callIdRef.current || '')) return;
      const pc = pcRef.current;
      if (!pc) return;
      if (pc.currentRemoteDescription) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));

      if (pendingIceRef.current.length) {
        const queued = [...pendingIceRef.current];
        pendingIceRef.current = [];
        for (const c of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {
            // ignore
          }
        }
      }
    };

    const onIce = async (payload: any) => {
      const id = String(payload?.callId || '');
      if (!id || id !== String(callIdRef.current || '')) return;
      const pc = pcRef.current;
      if (!pc) return;

      const cand = payload?.candidate;
      if (!cand) return;

      if (!pc.remoteDescription) {
        pendingIceRef.current.push(cand);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch {
        // ignore
      }
    };

    const onHangup = (payload: any) => {
      const id = String(payload?.callId || '');
      if (!id || id !== String(callIdRef.current || '')) return;
      cleanupCall();
    };

    s.on('call:incoming', onIncoming);
    s.on('call:accepted', onAccepted);
    s.on('call:rejected', onRejected);
    s.on('call:offer', onOffer);
    s.on('call:answer', onAnswer);
    s.on('call:ice', onIce);
    s.on('call:hangup', onHangup);

    return () => {
      s.off('private:new', onNew);
      s.off('presence:state', onPresenceState);
      s.off('presence:update', onPresenceUpdate);
      s.off('call:incoming', onIncoming);
      s.off('call:accepted', onAccepted);
      s.off('call:rejected', onRejected);
      s.off('call:offer', onOffer);
      s.off('call:answer', onAnswer);
      s.off('call:ice', onIce);
      s.off('call:hangup', onHangup);
    };
  }, [isAuthenticated, user?.id, activeUserId, callId, iceServers]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!activeUserId) return;

    let alive = true;
    setLoadingMessages(true);
    setError('');

    const s = connectSocket();
    s.emit('private:join', { otherUserId: activeUserId });

    api
      .authedRequest<{ ok: true; items: ChatMessage[] }>(`/api/messages/private/${activeUserId}?limit=200`, 'GET')
      .then((res) => {
        if (!alive) return;
        setMessages(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load messages');
      })
      .finally(() => {
        if (!alive) return;
        setLoadingMessages(false);
      });

    return () => {
      alive = false;
    };
  }, [activeUserId, isAuthenticated]);

  const runUserSearch = async () => {
    const q = userSearch.trim();
    if (!q) {
      setUserResults([]);
      return;
    }

    setSearchingUsers(true);
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; items: DirectoryUser[] }>(
        `/api/users/directory?q=${encodeURIComponent(q)}&limit=20`,
        'GET'
      );
      const me = String(user?.id);
      setUserResults((res.items || []).filter((u) => String(u._id) !== me));
    } catch (e: any) {
      setError(e?.message || 'Failed to search users');
    } finally {
      setSearchingUsers(false);
    }
  };

  const openChatWithUser = (u: DirectoryUser) => {
    const otherId = String(u._id);
    setActiveUserId(otherId);
    setDmTargetUserId(null);
    setShowMobileChat(true);

    setConversations((prev) => {
      const idx = prev.findIndex((c) => String(c.otherUser._id) === otherId);
      if (idx === 0) return prev;

      const existing: ConversationItem | null = idx >= 0 ? prev[idx] : null;
      const nextItem: ConversationItem = existing || {
        type: 'private',
        otherUser: {
          _id: otherId,
          name: u.name,
          membershipId: u.membershipId,
          profilePicture: u.profilePicture,
          role: u.role,
          status: u.status,
        },
      };
      const rest = prev.filter((_, i) => i !== idx);
      return [nextItem, ...rest];
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-black text-gray-900 mb-4">Messages</h1>
        <AIInsightBanner text="Secure communication empowers coordination between members. Real-time messaging enables instant collaboration on party initiatives." />
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Sign in to access messages</h3>
          <p className="text-sm text-gray-500 mb-6">Connect with party members through secure messaging</p>
          <button onClick={() => setShowLoginModal(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Sign In
          </button>
        </div>
      </div>
    );
  }

  const handleSend = async (media?: ChatMedia) => {
    if (!messageInput.trim() && !media) return;
    if (!activeUserId) return;

    const text = messageInput.trim();
    const s = connectSocket();
    s.emit('private:send', { toUserId: activeUserId, text, media: media || null });
    setMessageInput('');
  };

  const handlePickFile = async (file: File) => {
    if (!file) return;
    if (!activeUserId) return;

    setUploading(true);
    setError('');
    try {
      const uploaded = await api.uploadSingle(file);
      await handleSend({
        url: uploaded.file.url,
        publicId: uploaded.file.publicId,
        resourceType: uploaded.file.resourceType,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; message: ChatMessage }>(`/api/messages/private/${messageId}`, 'DELETE');
      const returned = res.message;
      const isAdmin = user?.role === 'admin';
      const sanitized: ChatMessage = {
        ...returned,
        text: !isAdmin && returned?.deletedAt ? '' : returned.text,
        media: !isAdmin && returned?.deletedAt ? null : returned.media,
      };
      setMessages((prev) => prev.map((m) => (String(m._id) === String(messageId) ? { ...m, ...sanitized } : m)));
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'community': return <Globe className="w-4 h-4" />;
      case 'group': return <Users className="w-4 h-4" />;
      default: return <User className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'community': return 'from-green-500 to-green-600';
      case 'group': return 'from-purple-500 to-purple-600';
      default: return 'from-blue-500 to-blue-600';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-4">
        <h1 className="text-3xl font-black text-gray-900">Messages</h1>
      </div>
      <AIInsightBanner text="Secure communication empowers coordination between members. Real-time messaging enables instant collaboration on party initiatives and governance." />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ height: '600px' }}>
        <div className="flex h-full">
          {/* Sidebar */}
          <div className={`w-full md:w-80 border-r border-gray-200 flex flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search conversations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                />
              </div>

              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="Search users to chat..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void runUserSearch()}
                  className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                />
                <button
                  onClick={() => void runUserSearch()}
                  disabled={searchingUsers}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  Search
                </button>
              </div>

              {userResults.length > 0 && (
                <div className="mt-3 bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
                  {userResults.map((u) => (
                    <button
                      key={u._id}
                      onClick={() => openChatWithUser(u)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-100 flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{u.name}</p>
                        <p className="text-[10px] text-gray-500 truncate">{u.membershipId || ''}</p>
                      </div>
                      <span className="text-[10px] font-bold text-blue-700">Chat</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingConversations && <p className="px-4 py-3 text-sm text-gray-500">Loading...</p>}
              {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}

              {filteredConversations.map((c) => (
                <button
                  key={c.otherUser._id}
                  onClick={() => {
                    setDmTargetUserId(c.otherUser._id);
                    setActiveUserId(c.otherUser._id);
                    setShowMobileChat(true);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                    String(activeUserId) === String(c.otherUser._id) ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getTypeColor('private')} flex items-center justify-center text-white flex-shrink-0`}>
                    {getTypeIcon('private')}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{c.otherUser.name}</h4>
                    </div>
                    <p className="text-xs text-gray-400 truncate">{c.lastMessage?.text || ''}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Area */}
          <div className={`flex-1 flex flex-col ${!showMobileChat && !activeUserId ? 'hidden md:flex' : 'flex'}`}>
            {activeConversation ? (
              <>
                {/* Chat Header */}
                <div className="flex items-center justify-between px-2 sm:px-3 md:px-5 py-3 border-b border-gray-100 gap-2 w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setShowMobileChat(false)} className="md:hidden p-1">
                      <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br ${getTypeColor('private')} flex items-center justify-center text-white flex-shrink-0`}>
                      {getTypeIcon('private')}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{activeConversation.otherUser.name}</h3>
                      <p className="text-[10px] text-gray-400 uppercase font-medium">
                        private chat
                        {' • '}
                        {presenceOnline[String(activeConversation.otherUser._id)] ? 'online' : 'offline'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => void placeCall('audio')}
                      disabled={!activeConversation?.otherUser?._id}
                      className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      title="Voice call"
                    >
                      <Phone className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => void placeCall('video')}
                      disabled={!activeConversation?.otherUser?._id}
                      className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                      title="Video call"
                    >
                      <Video className="w-4 h-4 text-gray-400" />
                    </button>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
                  {loadingMessages && <p className="text-sm text-gray-500">Loading...</p>}
                  {messages.map((msg) => {
                    const senderId = String(msg?.from?._id || msg?.from);
                    const isOwn = senderId === String(user?.id);
                    const senderName = msg?.from?.name || (isOwn ? 'You' : 'Member');
                    const isAdmin = user?.role === 'admin';
                    const canDelete = isAdmin || isOwn;
                    const deleted = !isAdmin && isDeletedMessage(msg);
                    const time = msg?.createdAt ? new Date(msg.createdAt) : new Date();
                    return (
                      <div key={msg._id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] ${isOwn ? 'order-1' : ''}`}>
                          {!isOwn && (
                            <p className="text-[10px] text-gray-400 font-medium mb-1 ml-1">{senderName}</p>
                          )}
                          <div className={`px-4 py-2.5 rounded-2xl text-sm relative group ${
                            isOwn
                              ? 'bg-blue-600 text-white rounded-br-md'
                              : 'bg-white text-gray-800 rounded-bl-md border border-gray-100 shadow-sm'
                          }`}>
                            {canDelete && (
                              <button
                                onClick={() => void handleDeleteMessage(msg._id)}
                                className={`absolute -top-2 -right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity ${
                                  isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-gray-100 hover:bg-gray-200'
                                }`}
                                title="Delete for everyone"
                              >
                                <span className={`text-[10px] font-black ${isOwn ? 'text-white' : 'text-gray-700'}`}>DEL</span>
                              </button>
                            )}

                            {deleted ? (
                              <span className={`${isOwn ? 'text-white/80' : 'text-gray-400'} italic`}>Message deleted</span>
                            ) : (
                              <>
                                {isAdmin && msg?.deletedAt ? (
                                  <span className={`block text-[10px] font-bold mb-1 ${isOwn ? 'text-white/80' : 'text-gray-500'}`}>Deleted</span>
                                ) : null}
                                {msg.text}
                                {msg.media?.url ? renderMediaPreview(msg.media, isOwn) : null}
                              </>
                            )}
                          </div>
                          <p className={`text-[10px] text-gray-400 mt-1 ${isOwn ? 'text-right mr-1' : 'ml-1'}`}>
                            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="px-2 sm:px-4 py-3 border-t border-gray-100 bg-white">
                  <div className="flex items-center gap-1.5 sm:gap-2 w-full">
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handlePickFile(f);
                      }}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <Paperclip className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0 hidden sm:inline-flex"
                    >
                      <Image className="w-4 h-4 text-gray-400" />
                    </button>
                    <input
                      type="text"
                      value={messageInput}
                      onChange={e => setMessageInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && void handleSend()}
                      placeholder="Type a message..."
                      className="flex-1 min-w-0 px-3 sm:px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                      disabled={uploading}
                    />
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors hidden sm:inline-flex flex-shrink-0">
                      <Smile className="w-4 h-4 text-gray-400" />
                    </button>
                    <button
                      onClick={() => void handleSend()}
                      disabled={uploading || !messageInput.trim()}
                      className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex-shrink-0"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                  <button
                    onClick={() => setShowMobileChat(false)}
                    className="md:hidden mb-4 px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold"
                  >
                    Back
                  </button>
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Hash className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Select a conversation</h3>
                  <p className="text-sm text-gray-500">Choose a chat from the sidebar to start messaging</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {callOpen && callId && callOther && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">
                  {callIncoming ? 'Incoming call' : 'Call'}
                  {callStatus === 'calling' ? ' • Calling…' : ''}
                  {callStatus === 'ringing' ? ' • Ringing…' : ''}
                  {callStatus === 'connecting' ? ' • Connecting…' : ''}
                  {callStatus === 'connected' ? ' • Connected' : ''}
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {callOther.name} • {callKind === 'video' ? 'Video' : 'Voice'}
                </p>
              </div>
              <button onClick={hangup} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700">
                Hang up
              </button>
            </div>

            <div className="p-4 bg-gray-50">
              {callKind === 'video' ? (
                <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <div className="absolute bottom-3 right-3 w-28 h-40 sm:w-36 sm:h-24 md:w-44 md:h-28 bg-black rounded-lg overflow-hidden border border-white/20">
                    <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  </div>
                </div>
              ) : (
                <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                  <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-3">
                    <Phone className="w-10 h-10 text-green-600" />
                  </div>
                  <p className="text-lg font-black text-gray-900">{callOther.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {callIncoming ? 'Incoming voice call' : 'Voice call'}
                    {callStatus === 'calling' ? ' • Calling…' : ''}
                    {callStatus === 'ringing' ? ' • Ringing…' : ''}
                    {callStatus === 'connecting' ? ' • Connecting…' : ''}
                    {callStatus === 'connected' ? ' • Connected' : ''}
                  </p>
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <div className="flex gap-2">
                  <button onClick={toggleMute} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold hover:bg-gray-100">
                    {callMuted ? 'Unmute' : 'Mute'}
                  </button>
                  {callKind === 'video' && (
                    <button onClick={toggleCam} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm font-bold hover:bg-gray-100">
                      {callCamOff ? 'Camera on' : 'Camera off'}
                    </button>
                  )}
                </div>

                {callIncoming && (
                  <div className="flex gap-2">
                    <button onClick={rejectIncoming} className="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-bold hover:bg-gray-300">
                      Reject
                    </button>
                    <button onClick={() => void acceptIncoming()} className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700">
                      Accept
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessagesPage;
