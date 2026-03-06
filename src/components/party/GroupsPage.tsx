import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import { Users, Search, Lock, Globe, Send, Image, Paperclip, User, Plus, X, Phone, Video, ArrowLeft } from 'lucide-react';

import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

type ChatMedia = { url: string; publicId?: string; resourceType?: string } | null;

type ChatMessage = {
  _id: string;
  from: any;
  text: string;
  media?: ChatMedia;
  createdAt: string;
  deletedAt?: string | null;
  deletedBy?: any;
};

function isDeletedMessage(msg: ChatMessage) {
  return Boolean(msg?.deletedAt) || (!msg?.text && !msg?.media);
}

function renderMediaPreview(media: ChatMedia) {
  if (!media?.url) return null;
  const rt = String(media.resourceType || '').toLowerCase();
  const url = media.url;

  if (rt === 'image') {
    return <img src={url} alt="media" className="mt-2 w-44 h-44 object-cover rounded-xl border border-gray-200" />;
  }
  if (rt === 'video') {
    return (
      <video
        src={url}
        controls
        className="mt-2 w-56 max-w-full rounded-xl border border-gray-200"
      />
    );
  }

  return (
    <audio
      src={url}
      controls
      className="mt-2 w-56 max-w-full"
    />
  );
}

type BackendGroup = {
  _id: string;
  name: string;
  description?: string;
  isPublic: boolean;
  members?: Array<{ user: any; role: string; joinedAt: string }>;
  joinRequests?: Array<{ user: any; requestedAt: string }>;
  createdBy?: any;
  createdAt?: string;
};

const GroupsPage: React.FC = () => {
  const { isAuthenticated, setShowLoginModal, user } = useAppContext();
  const [groups, setGroups] = useState<BackendGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [error, setError] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [callOpen, setCallOpen] = useState(false);
  const [callIncoming, setCallIncoming] = useState(false);
  const [callKind, setCallKind] = useState<'audio' | 'video'>('audio');
  const [callId, setCallId] = useState<string | null>(null);
  const [callFrom, setCallFrom] = useState<{ _id: string; name: string } | null>(null);
  const [callMuted, setCallMuted] = useState(false);
  const [callCamOff, setCallCamOff] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'ringing' | 'connecting' | 'connected' | 'ended'>('calling');

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [remoteStreams, setRemoteStreams] = useState<Array<{ userId: string; stream: MediaStream }>>([]);
  const remoteVideoElsRef = useRef<Map<string, HTMLVideoElement | null>>(new Map());

  const recCtxRef = useRef<AudioContext | null>(null);
  const recDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recRecorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<BlobPart[]>([]);
  const recStartedAtRef = useRef<number | null>(null);
  const recUploadingRef = useRef(false);

  const groupCallSocketRef = useRef<ReturnType<typeof connectSocket> | null>(null);

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

  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupIsPublic, setNewGroupIsPublic] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    try {
      const gid = localStorage.getItem('tdp_open_group_id');
      if (!gid) return;
      setActiveGroupId(String(gid));
      setShowMobileChat(true);
      localStorage.removeItem('tdp_open_group_id');
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    try {
      const raw = localStorage.getItem('tdp_pending_incoming_call');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.scope !== 'group') return;
      if (!parsed.callId || !parsed.groupId) return;

      setActiveGroupId(String(parsed.groupId));
      setShowMobileChat(true);

      setCallId(String(parsed.callId));
      setCallKind(parsed.kind === 'video' ? 'video' : 'audio');
      setCallFrom({ _id: String(parsed.fromUserId || 'member'), name: String(parsed.fromName || 'Member') });
      setCallIncoming(true);
      setCallOpen(true);
      setCallStatus('ringing');
      startTone('ring');

      localStorage.removeItem('tdp_pending_incoming_call');
    } catch {
      // ignore
    }
  }, [isAuthenticated]);

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
    if (!activeGroupId) return;

    const local = localStreamRef.current;
    const localTracks = local?.getAudioTracks?.() || [];
    const remoteTracks = (remoteStreams || []).flatMap((x) => x.stream?.getAudioTracks?.() || []);
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
        if (!activeGroupId) return;
        if (!user?.id) return;

        recUploadingRef.current = true;
        try {
          const endedAt = Date.now();
          const durationSec = startedAt ? Math.max(0, Math.round((endedAt - startedAt) / 1000)) : undefined;
          const blob = new Blob(chunks, { type: 'audio/webm' });

          await api.uploadCallRecording({
            file: blob,
            filename: `groupcall-${activeGroupId}-${callId}.webm`,
            mimeType: 'audio/webm',
            callId,
            scope: 'group',
            kind: callKind,
            fromUserId: String(user.id),
            groupId: String(activeGroupId),
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

  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return groups.filter((g) => {
      const name = String(g.name || '').toLowerCase();
      const desc = String(g.description || '').toLowerCase();
      return !q || name.includes(q) || desc.includes(q);
    });
  }, [groups, searchQuery]);

  const activeGroup = useMemo(() => {
    if (!activeGroupId) return null;
    return groups.find((g) => String(g._id) === String(activeGroupId)) || null;
  }, [activeGroupId, groups]);

  const isJoined = useMemo(() => {
    if (!activeGroup) return false;
    const ms = activeGroup.members || [];
    return ms.some((m) => String(m.user?._id || m.user) === String(user?.id));
  }, [activeGroup, user?.id]);

  const isOwnerOrAdmin = useMemo(() => {
    if (!activeGroup) return false;
    if (user?.role === 'admin') return true;
    const createdById = activeGroup?.createdBy?._id || activeGroup?.createdBy;
    if (createdById && String(createdById) === String(user?.id)) return true;
    const ms = activeGroup.members || [];
    const me = ms.find((m) => String(m.user?._id || m.user) === String(user?.id));
    return me?.role === 'owner';
  }, [activeGroup, user?.id, user?.role]);

  const hasRequested = useMemo(() => {
    if (!activeGroup) return false;
    const rs = activeGroup.joinRequests || [];
    return rs.some((r) => String(r.user?._id || r.user) === String(user?.id));
  }, [activeGroup, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeGroupId, messages.length]);

  const cleanupGroupCall = () => {
    stopRecording();

    if (ringtoneRef.current) {
      try {
        ringtoneRef.current.pause();
        ringtoneRef.current.currentTime = 0;
      } catch {
        // ignore
      }
      ringtoneRef.current = null;
    }

    for (const pc of pcsRef.current.values()) {
      try {
        pc.close();
      } catch {
        // ignore
      }
    }
    pcsRef.current.clear();

    const s = localStreamRef.current;
    if (s) {
      for (const t of s.getTracks()) {
        try {
          t.stop();
        } catch {
          // ignore
        }
      }
    }
    localStreamRef.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;

    setRemoteStreams([]);
    setCallOpen(false);
    setCallIncoming(false);
    setCallId(null);
    setCallFrom(null);
    setCallMuted(false);
    setCallCamOff(false);
    setCallStatus('ended');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; message: ChatMessage }>(`/api/messages/groups/message/${messageId}`, 'DELETE');
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

  const startLocalMedia = async (kind: 'audio' | 'video') => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: kind === 'video',
    });
    localStreamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    return stream;
  };

  const upsertRemoteStream = (userId: string, stream: MediaStream) => {
    setRemoteStreams((prev) => {
      const idx = prev.findIndex((x) => String(x.userId) === String(userId));
      if (idx >= 0) {
        const next = prev.slice();
        next[idx] = { userId, stream };
        return next;
      }
      return [...prev, { userId, stream }];
    });

    const el = remoteVideoElsRef.current.get(String(userId));
    if (el && el.srcObject !== stream) el.srcObject = stream;
  };

  const ensurePcForPeer = (sock: any, peerUserId: string) => {
    const pid = String(peerUserId);
    const existing = pcsRef.current.get(pid);
    if (existing) return existing;

    const pc = new RTCPeerConnection(iceServers);
    pcsRef.current.set(pid, pc);

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
    upsertRemoteStream(pid, remote);

    pc.ontrack = (ev) => {
      const stream = remote;
      for (const track of ev.streams?.[0]?.getTracks?.() || []) {
        if (!stream.getTracks().some((t) => t.id === track.id)) stream.addTrack(track);
      }
      if (ev.track && !stream.getTracks().some((t) => t.id === ev.track.id)) stream.addTrack(ev.track);
      upsertRemoteStream(pid, stream);
    };

    pc.onicecandidate = (ev) => {
      if (!ev.candidate) return;
      if (!callId) return;
      sock.emit('groupcall:ice', {
        callId,
        toUserId: pid,
        candidate: ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate,
      });
    };

    for (const track of localStreamRef.current?.getTracks() || []) {
      pc.addTrack(track, localStreamRef.current as MediaStream);
    }

    return pc;
  };

  const createOfferToPeer = async (peerUserId: string) => {
    const sock = groupCallSocketRef.current || connectSocket();
    groupCallSocketRef.current = sock;
    if (!callId) return;
    const pc = ensurePcForPeer(sock, peerUserId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sock.emit('groupcall:offer', { callId, toUserId: String(peerUserId), sdp: offer });
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

  const hangupGroupCall = () => {
    const sock = groupCallSocketRef.current || connectSocket();
    groupCallSocketRef.current = sock;
    if (callId && activeGroupId && localStreamRef.current) {
      sock.emit('groupcall:leave', { callId, groupId: activeGroupId });
    }
    cleanupGroupCall();
  };

  const startGroupCall = async (kind: 'audio' | 'video') => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (!activeGroupId) return;
    if (!isJoined && user?.role !== 'admin') return;

    const sock = connectSocket();
    groupCallSocketRef.current = sock;

    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setCallKind(kind);
    setCallId(id);
    setCallFrom({ _id: String(user?.id), name: String(user?.name || 'You') });
    setCallIncoming(false);
    setCallOpen(true);
    setCallStatus('calling');
    startTone('ringback');

    await startLocalMedia(kind);
    sock.emit('groupcall:invite', { groupId: activeGroupId, callId: id, kind });
    sock.emit('groupcall:join', { groupId: activeGroupId, callId: id });
  };

  const acceptIncomingCall = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (!activeGroupId || !callId) return;

    const sock = connectSocket();
    groupCallSocketRef.current = sock;
    setCallIncoming(false);
    setCallOpen(true);

    stopTone();

    await startLocalMedia(callKind);
    sock.emit('groupcall:join', { groupId: activeGroupId, callId });
  };

  const rejectIncomingCall = () => {
    hangupGroupCall();
  };

  useEffect(() => {
    let alive = true;
    setLoadingGroups(true);
    setError('');

    api
      .request<{ ok: true; items: BackendGroup[] }>('/api/groups?limit=200', 'GET')
      .then((res) => {
        if (!alive) return;
        setGroups(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load groups');
      })
      .finally(() => {
        if (!alive) return;
        setLoadingGroups(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const handleCreateGroup = async () => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (!newGroupName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; group: BackendGroup }>('/api/groups', 'POST', {
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        isPublic: newGroupIsPublic,
      });
      setGroups((prev) => [res.group, ...prev]);
      setShowCreate(false);
      setNewGroupName('');
      setNewGroupDescription('');
      setNewGroupIsPublic(true);
    } catch (e: any) {
      setError(e?.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleRequestAccess = async (groupId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; group: BackendGroup }>(`/api/groups/${groupId}/request`, 'POST', {});
      setGroups((prev) => prev.map((g) => (String(g._id) === String(groupId) ? res.group : g)));
    } catch (e: any) {
      setError(e?.message || 'Request failed');
    }
  };

  const handleApprove = async (groupId: string, userId: string) => {
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; group: BackendGroup }>(
        `/api/groups/${groupId}/requests/${userId}/approve`,
        'POST',
        {}
      );
      setGroups((prev) => prev.map((g) => (String(g._id) === String(groupId) ? res.group : g)));
    } catch (e: any) {
      setError(e?.message || 'Approve failed');
    }
  };

  const handleDeny = async (groupId: string, userId: string) => {
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; group: BackendGroup }>(
        `/api/groups/${groupId}/requests/${userId}`,
        'DELETE'
      );
      setGroups((prev) => prev.map((g) => (String(g._id) === String(groupId) ? res.group : g)));
    } catch (e: any) {
      setError(e?.message || 'Deny failed');
    }
  };

  const handleBlock = async (groupId: string, userId: string) => {
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; group: BackendGroup }>(
        `/api/groups/${groupId}/requests/${userId}/block`,
        'POST',
        {}
      );
      setGroups((prev) => prev.map((g) => (String(g._id) === String(groupId) ? res.group : g)));
    } catch (e: any) {
      setError(e?.message || 'Block failed');
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    const s = connectSocket();
    const onNew = (msg: ChatMessage) => {
      if (!activeGroupId) return;
      const groupId = (msg as any)?.group?._id || (msg as any)?.group;
      if (String(groupId) !== String(activeGroupId)) return;
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    };

    s.on('group:new', onNew);
    return () => {
      s.off('group:new', onNew);
    };
  }, [isAuthenticated, activeGroupId]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const s = connectSocket();
    groupCallSocketRef.current = s;

    const onIncoming = (payload: any) => {
      if (!payload?.callId || !payload?.groupId) return;
      if (!activeGroupId) return;
      if (String(payload.groupId) !== String(activeGroupId)) return;
      if (!isJoined && user?.role !== 'admin') return;

      const fromId = String(payload?.from?._id || '');
      if (fromId && String(fromId) === String(user?.id)) return;

      setCallId(String(payload.callId));
      setCallKind(payload.kind === 'video' ? 'video' : 'audio');
      setCallFrom({ _id: fromId || 'member', name: String(payload?.from?.name || 'Member') });
      setCallIncoming(true);
      setCallOpen(true);
      setCallStatus('ringing');
      startTone('ring');
    };

    const onParticipantJoined = async (payload: any) => {
      if (!payload?.callId || !payload?.groupId || !payload?.user?._id) return;
      if (!callId || String(payload.callId) !== String(callId)) return;
      if (!activeGroupId || String(payload.groupId) !== String(activeGroupId)) return;

      const peerId = String(payload.user._id);
      if (peerId === String(user?.id)) return;
      if (!localStreamRef.current) return;

      setCallStatus('connecting');

      const me = String(user?.id);
      const iInitiate = me < peerId;
      if (iInitiate) {
        try {
          await createOfferToPeer(peerId);
        } catch {
          // ignore
        }
      }
    };

    const onOffer = async (payload: any) => {
      if (!payload?.callId || !payload?.fromUserId || !payload?.sdp) return;
      if (!callId || String(payload.callId) !== String(callId)) return;
      if (!localStreamRef.current) return;
      const fromUserId = String(payload.fromUserId);

      const pc = ensurePcForPeer(s, fromUserId);
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const ans = await pc.createAnswer();
      await pc.setLocalDescription(ans);
      s.emit('groupcall:answer', { callId, toUserId: fromUserId, sdp: ans });
    };

    const onAnswer = async (payload: any) => {
      if (!payload?.callId || !payload?.fromUserId || !payload?.sdp) return;
      if (!callId || String(payload.callId) !== String(callId)) return;
      const fromUserId = String(payload.fromUserId);
      const pc = pcsRef.current.get(fromUserId);
      if (!pc) return;
      if (pc.currentRemoteDescription) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    };

    const onIce = async (payload: any) => {
      if (!payload?.callId || !payload?.fromUserId || !payload?.candidate) return;
      if (!callId || String(payload.callId) !== String(callId)) return;
      const fromUserId = String(payload.fromUserId);
      const pc = pcsRef.current.get(fromUserId);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        // ignore
      }
    };

    const onParticipantLeft = (payload: any) => {
      if (!payload?.callId || !payload?.userId) return;
      if (!callId || String(payload.callId) !== String(callId)) return;
      const leftId = String(payload.userId);

      const pc = pcsRef.current.get(leftId);
      if (pc) {
        try {
          pc.close();
        } catch {
          // ignore
        }
        pcsRef.current.delete(leftId);
      }
      setRemoteStreams((prev) => prev.filter((x) => String(x.userId) !== String(leftId)));
    };

    s.on('groupcall:incoming', onIncoming);
    s.on('groupcall:participant-joined', onParticipantJoined);
    s.on('groupcall:offer', onOffer);
    s.on('groupcall:answer', onAnswer);
    s.on('groupcall:ice', onIce);
    s.on('groupcall:participant-left', onParticipantLeft);

    return () => {
      s.off('groupcall:incoming', onIncoming);
      s.off('groupcall:participant-joined', onParticipantJoined);
      s.off('groupcall:offer', onOffer);
      s.off('groupcall:answer', onAnswer);
      s.off('groupcall:ice', onIce);
      s.off('groupcall:participant-left', onParticipantLeft);
    };
  }, [isAuthenticated, activeGroupId, callId, isJoined, user?.id, user?.role, iceServers]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!activeGroupId) return;

    let alive = true;
    setLoadingMessages(true);
    setError('');
    setMessages([]);

    const s = connectSocket();
    s.emit('group:join', { groupId: activeGroupId });

    api
      .authedRequest<{ ok: true; items: ChatMessage[] }>(`/api/messages/groups/${activeGroupId}?limit=200`, 'GET')
      .then((res) => {
        if (!alive) return;
        setMessages(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load group messages');
      })
      .finally(() => {
        if (!alive) return;
        setLoadingMessages(false);
      });

    return () => {
      alive = false;
    };
  }, [activeGroupId, isAuthenticated]);

  const handleJoin = async (groupId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; group: BackendGroup }>(`/api/groups/${groupId}/join`, 'POST', {});
      setGroups((prev) => prev.map((g) => (String(g._id) === String(groupId) ? res.group : g)));
    } catch (e: any) {
      setError(e?.message || 'Join failed');
    }
  };

  const handleSend = async (media?: ChatMedia) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (!activeGroupId) return;
    if (!messageInput.trim() && !media) return;

    const text = messageInput.trim();
    const s = connectSocket();
    s.emit('group:send', { groupId: activeGroupId, text, media: media || null }, (ack: any) => {
      if (!ack?.ok) {
        setError(ack?.message || 'Failed to send');
        return;
      }
      const msg = ack.message as ChatMessage;
      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [...prev, msg];
      });
    });
    setMessageInput('');
  };

  const handlePickFile = async (file: File) => {
    if (!file) return;
    if (!activeGroupId) return;

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

  return (
    <>
      <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Groups</h1>
        <p className="text-gray-500 mt-1">Browse groups on the left and chat inside a group on the right</p>
      </div>

      <AIInsightBanner text="Groups have a left-side list with search. After joining, you can see previous messages and chat live with media support." />

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ height: '650px' }}>
        <div className="flex h-full">
          {/* Left group list */}
          <div className={`w-full md:w-96 border-r border-gray-200 flex-col ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-gray-100">
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-xs font-bold text-gray-500 uppercase">Groups</p>
                {isAuthenticated && (
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create
                  </button>
                )}
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search groups..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            {showCreate && (
              <div className="p-4 border-b border-gray-100 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold text-gray-900">Create Group</p>
                  <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="space-y-3">
                  <input
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <input
                    value={newGroupDescription}
                    onChange={(e) => setNewGroupDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  />
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-700">Visibility</label>
                    <select
                      value={newGroupIsPublic ? 'public' : 'private'}
                      onChange={(e) => setNewGroupIsPublic(e.target.value === 'public')}
                      className="px-2 py-2 border border-gray-200 rounded-lg text-xs bg-white"
                    >
                      <option value="public">Public</option>
                      <option value="private">Private</option>
                    </select>
                  </div>
                  <button
                    disabled={creating || !newGroupName.trim()}
                    onClick={() => void handleCreateGroup()}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto">
              {loadingGroups && <p className="p-4 text-sm text-gray-500">Loading...</p>}
              {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}

              {filteredGroups.map((g) => {
                const joined = (g.members || []).some((m) => String(m.user?._id || m.user) === String(user?.id));
                return (
                  <button
                    key={g._id}
                    onClick={() => {
                      setActiveGroupId(g._id);
                      setShowMobileChat(true);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 ${
                      String(activeGroupId) === String(g._id) ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${g.isPublic ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} flex items-center justify-center text-white flex-shrink-0`}>
                      {g.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-gray-900 truncate">{g.name}</h4>
                        {joined && (
                          <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">Joined</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{g.description || ''}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{(g.members || []).length} members</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right group chat */}
          <div className={`flex-1 flex flex-col ${activeGroup ? (showMobileChat ? 'flex' : 'hidden md:flex') : 'hidden md:flex'}`}>
            {!activeGroup ? (
              <div className="flex-1 flex items-center justify-center bg-gray-50">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-gray-300" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Select a group</h3>
                  <p className="text-sm text-gray-500">Choose a group from the left to view or join</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-2 sm:px-3 md:px-5 py-3 border-b border-gray-100 gap-2 w-full">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <button
                      onClick={() => setShowMobileChat(false)}
                      className="md:hidden p-1.5 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                      title="Back"
                    >
                      <ArrowLeft className="w-4 h-4 text-gray-500" />
                    </button>
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-gradient-to-br ${activeGroup.isPublic ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600'} flex items-center justify-center text-white flex-shrink-0`}>
                      {activeGroup.isPublic ? <Globe className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-gray-900 truncate">{activeGroup.name}</h3>
                      <p className="text-[10px] text-gray-400 uppercase font-medium">{activeGroup.isPublic ? 'public' : 'private'} group</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
                    {(isJoined || user?.role === 'admin') && (
                      <>
                        <button
                          onClick={() => void startGroupCall('audio')}
                          className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                          title="Group voice call"
                        >
                          <Phone className="w-4 h-4 text-gray-400" />
                        </button>
                        <button
                          onClick={() => void startGroupCall('video')}
                          className="p-1 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
                          title="Group video call"
                        >
                          <Video className="w-4 h-4 text-gray-400" />
                        </button>
                      </>
                    )}

                    {!isJoined && activeGroup.isPublic && (
                      <button
                        onClick={() => void handleJoin(activeGroup._id)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>

                {!isAuthenticated ? (
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <User className="w-8 h-8 text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Sign in to join and chat</h3>
                      <button onClick={() => setShowLoginModal(true)} className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
                        Sign In
                      </button>
                    </div>
                  </div>
                ) : (!activeGroup.isPublic && !isJoined && user?.role !== 'admin') ? (
                  <div className="flex-1 flex items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-gray-300" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">Private group</h3>
                      <p className="text-sm text-gray-500">Request access. Group creator/admin can approve.</p>

                      <button
                        onClick={() => void handleRequestAccess(activeGroup._id)}
                        disabled={hasRequested}
                        className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {hasRequested ? 'Requested' : 'Request Access'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {isOwnerOrAdmin && (activeGroup.joinRequests || []).length > 0 && (
                      <div className="px-5 py-3 border-b border-gray-100 bg-white">
                        <p className="text-xs font-bold text-gray-700 mb-2">Pending requests</p>
                        <div className="flex flex-wrap gap-2">
                          {(activeGroup.joinRequests || []).map((r) => {
                            const rid = String(r.user?._id || r.user);
                            const rname = r.user?.name || 'Member';
                            return (
                              <div key={rid} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl">
                                <span className="text-xs text-gray-700 font-medium">{rname}</span>
                                <button
                                  onClick={() => void handleApprove(activeGroup._id, rid)}
                                  className="px-2 py-1 text-[10px] font-bold bg-green-600 text-white rounded-lg hover:bg-green-700"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => void handleDeny(activeGroup._id, rid)}
                                  className="px-2 py-1 text-[10px] font-bold bg-red-600 text-white rounded-lg hover:bg-red-700"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => void handleBlock(activeGroup._id, rid)}
                                  className="px-2 py-1 text-[10px] font-bold bg-gray-900 text-white rounded-lg hover:bg-black"
                                >
                                  Block
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
                      {loadingMessages && <p className="text-sm text-gray-500">Loading...</p>}
                      {error && <p className="text-sm text-red-600">{error}</p>}

                      {messages.map((msg) => {
                        const senderId = msg?.from?._id || msg?.from;
                        const isOwn = String(senderId) === String(user?.id);
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
                                  ? 'bg-purple-600 text-white rounded-br-md'
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
                                    {msg.media?.url && (
                                      <div className="mt-2">
                                        {renderMediaPreview(msg.media)}
                                        <a href={msg.media.url} target="_blank" rel="noreferrer" className={`block mt-1 text-xs underline ${isOwn ? 'text-white' : 'text-blue-600'}`}>
                                          Open
                                        </a>
                                      </div>
                                    )}
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

                    <div className="px-2 sm:px-4 py-3 border-t border-gray-100 bg-white">
                      <div className="flex items-center gap-1 sm:gap-2 w-full">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*,video/*,audio/*"
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
                          className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          <Image className="w-4 h-4 text-gray-400" />
                        </button>
                        <input
                          type="text"
                          value={messageInput}
                          onChange={(e) => setMessageInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                          placeholder={uploading ? 'Uploading...' : 'Type a message...'}
                          className="flex-1 min-w-0 px-3 sm:px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-purple-500 outline-none"
                          disabled={uploading}
                        />
                        <button
                          onClick={() => void handleSend()}
                          disabled={uploading || !messageInput.trim()}
                          className="p-2 sm:p-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 flex-shrink-0"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>

    {callOpen && callId && activeGroupId && (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden shadow-2xl">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">
                {callIncoming ? 'Incoming group call' : 'Group call'}
                {callStatus === 'calling' ? ' • Calling…' : ''}
                {callStatus === 'ringing' ? ' • Ringing…' : ''}
                {callStatus === 'connecting' ? ' • Connecting…' : ''}
                {callStatus === 'connected' ? ' • Connected' : ''}
              </p>
              <p className="text-sm font-bold text-gray-900">
                {activeGroup?.name || 'Group'} • {callKind === 'video' ? 'Video' : 'Voice'}
                {callFrom?.name ? ` • ${callFrom.name}` : ''}
              </p>
            </div>
            <button onClick={hangupGroupCall} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700">
              Hang up
            </button>
          </div>

          <div className="p-4 bg-gray-50">
            {callKind === 'video' ? (
              <div className="relative bg-black rounded-xl overflow-hidden aspect-video flex items-center justify-center">
                {remoteStreams.length > 0 ? (
                  <video
                    ref={(el) => {
                      const uid = remoteStreams[0]?.userId;
                      if (!uid) return;
                      remoteVideoElsRef.current.set(String(uid), el);
                      const rs = remoteStreams.find((x) => String(x.userId) === String(uid));
                      if (el && rs?.stream && el.srcObject !== rs.stream) el.srcObject = rs.stream;
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                )}

                <div className="absolute bottom-3 right-3 w-28 h-40 sm:w-36 sm:h-24 md:w-44 md:h-28 bg-black rounded-lg overflow-hidden border border-white/20">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
              </div>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-3">
                  <Phone className="w-10 h-10 text-green-600" />
                </div>
                <p className="text-lg font-black text-gray-900">{activeGroup?.name || 'Group'}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {callIncoming ? 'Incoming voice call' : 'Voice call'}
                  {callStatus === 'calling' ? ' • Calling…' : ''}
                  {callStatus === 'ringing' ? ' • Ringing…' : ''}
                  {callStatus === 'connecting' ? ' • Connecting…' : ''}
                  {callStatus === 'connected' ? ' • Connected' : ''}
                </p>
              </div>
            )}

            {callKind === 'video' && remoteStreams.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {remoteStreams.slice(1).map(({ userId: uid }) => (
                  <div key={uid} className="bg-black rounded-lg overflow-hidden w-28 h-20 flex-shrink-0">
                    <video
                      ref={(el) => {
                        remoteVideoElsRef.current.set(String(uid), el);
                        const rs = remoteStreams.find((x) => String(x.userId) === String(uid));
                        if (el && rs?.stream && el.srcObject !== rs.stream) el.srcObject = rs.stream;
                      }}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
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
                  <button onClick={rejectIncomingCall} className="px-4 py-2 rounded-xl bg-gray-200 text-gray-900 text-sm font-bold hover:bg-gray-300">
                    Reject
                  </button>
                  <button onClick={() => void acceptIncomingCall()} className="px-4 py-2 rounded-xl bg-green-600 text-white text-sm font-bold hover:bg-green-700">
                    Accept
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default GroupsPage;
