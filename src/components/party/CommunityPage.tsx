import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import {
  Send, Image, Paperclip, Globe, User
} from 'lucide-react';

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

const CommunityPage: React.FC = () => {
  const { isAuthenticated, setShowLoginModal, user } = useAppContext();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [messageInput, setMessageInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canChat = isAuthenticated;

  const orderedMessages = useMemo(() => messages, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [orderedMessages.length]);

  useEffect(() => {
    if (!canChat) return;

    let alive = true;
    setLoading(true);
    setError('');

    api
      .authedRequest<{ ok: true; items: ChatMessage[] }>('/api/messages/community?limit=100', 'GET')
      .then((res) => {
        if (!alive) return;
        setMessages(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load community messages');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [canChat]);

  const handleDeleteMessage = async (messageId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; message: ChatMessage }>(`/api/messages/community/${messageId}`, 'DELETE');
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

  useEffect(() => {
    if (!canChat) return;

    const s = connectSocket();
    s.emit('community:join');

    const onNew = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    s.on('community:new', onNew);

    return () => {
      s.off('community:new', onNew);
    };
  }, [canChat]);

  const handleSend = async (media?: ChatMedia) => {
    if (!canChat) {
      setShowLoginModal(true);
      return;
    }
    const text = messageInput.trim();
    if (!text && !media) return;

    const s = connectSocket();
    s.emit('community:send', { text, media });
    setMessageInput('');
  };

  const handlePickFile = async (file: File) => {
    if (!file) return;
    if (!canChat) {
      setShowLoginModal(true);
      return;
    }

    setUploading(true);
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Community Chat</h1>
          <p className="text-gray-500 mt-1">One global chat for all members (history + live)</p>
        </div>
      </div>

      <AIInsightBanner text="This is a single global community chat. Logged-in users can see previous messages, receive live messages, and send text or media." />

      {!isAuthenticated ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Sign in to chat</h3>
          <p className="text-sm text-gray-500 mb-6">Login is required to post in the community chat</p>
          <button onClick={() => setShowLoginModal(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Sign In
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm" style={{ height: '650px' }}>
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white">
                <Globe className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Global Community</h3>
                <p className="text-[10px] text-gray-400 uppercase font-medium">community chat</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50" style={{ height: '520px' }}>
            {loading && <p className="text-sm text-gray-500">Loading...</p>}
            {error && <p className="text-sm text-red-600">{error}</p>}

            {orderedMessages.map((msg) => {
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
                        ? 'bg-green-600 text-white rounded-br-md'
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

          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-center gap-2 w-full">
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
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Upload media"
              >
                <Paperclip className="w-4 h-4 text-gray-400" />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 flex-shrink-0"
                title="Upload image/video"
              >
                <Image className="w-4 h-4 text-gray-400" />
              </button>
              <input
                type="text"
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                placeholder={uploading ? 'Uploading...' : 'Type a message...'}
                className="flex-1 min-w-0 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-green-500 outline-none"
                disabled={uploading}
              />
              <button
                onClick={() => void handleSend()}
                disabled={uploading || !messageInput.trim()}
                className="p-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityPage;
