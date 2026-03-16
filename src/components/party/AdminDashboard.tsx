import React, { useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import {
  Users, FileText, BarChart3, Briefcase, MessageCircle, Shield, Bell,
  TrendingUp, TrendingDown, Eye, Trash2, Ban, CheckCircle, XCircle,
  Search, Filter, Download, RefreshCw, AlertTriangle, Activity, Mail, Globe, Phone, Video
} from 'lucide-react';
import { api } from '@/lib/api';
import { connectSocket } from '@/lib/socket';

const AdminDashboard: React.FC = () => {
  const { currentPage, setCurrentPage, setDmTargetUserId, isAuthenticated } = useAppContext();
  const [activeTab, setActiveTab] = useState(currentPage === 'admin-dashboard' ? 'users' : currentPage.replace('admin-', ''));

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [blogs, setBlogs] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [surveys, setSurveys] = useState<any[]>([]);
  const [works, setWorks] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [blogComments, setBlogComments] = useState<any[]>([]);

  const [groupRequests, setGroupRequests] = useState<any[]>([]);
  const [communityMessages, setCommunityMessages] = useState<any[]>([]);
  const [callRecords, setCallRecords] = useState<any[]>([]);

  const [adminChatUserQuery, setAdminChatUserQuery] = useState('');
  const [adminChatUsers, setAdminChatUsers] = useState<any[]>([]);
  const [adminChatTargetUserId, setAdminChatTargetUserId] = useState<string | null>(null);
  const [adminChatConversations, setAdminChatConversations] = useState<any[]>([]);
  const [adminChatActiveOtherUserId, setAdminChatActiveOtherUserId] = useState<string | null>(null);
  const [adminChatMessages, setAdminChatMessages] = useState<any[]>([]);
  const [loadingAdminChat, setLoadingAdminChat] = useState(false);

  const [presenceOnline, setPresenceOnline] = React.useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem('tdp_presence_online');
      return raw ? (JSON.parse(raw) as any) : {};
    } catch {
      return {};
    }
  });

  const [autoAnswerQuery, setAutoAnswerQuery] = useState('');
  const [autoAnswerUsers, setAutoAnswerUsers] = useState<any[]>([]);
  const [loadingAutoAnswer, setLoadingAutoAnswer] = useState(false);

  const [viewingGroup, setViewingGroup] = useState<any | null>(null);
  const [groupPreviewMessages, setGroupPreviewMessages] = useState<any[]>([]);
  const [loadingGroupPreview, setLoadingGroupPreview] = useState(false);

  const [blogTitle, setBlogTitle] = useState('');
  const [blogContent, setBlogContent] = useState('');

  const [pollDrafts, setPollDrafts] = useState<Array<{ question: string; options: string[] }>>([
    { question: '', options: ['', ''] },
  ]);

  const [surveyTitle, setSurveyTitle] = useState('');
  const [surveyDraftQuestions, setSurveyDraftQuestions] = useState<Array<{ type: 'text' | 'mcq'; prompt: string; options: string[] }>>([
    { type: 'text', prompt: '', options: [] },
  ]);

  const [workTitle, setWorkTitle] = useState('');
  const [workDescription, setWorkDescription] = useState('');

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupPublic, setGroupPublic] = useState(true);

  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'blogs', label: 'Blogs', icon: FileText },
    { id: 'comments', label: 'Comments', icon: MessageCircle },
    { id: 'polls', label: 'Polls', icon: BarChart3 },
    { id: 'surveys', label: 'Surveys', icon: BarChart3 },
    { id: 'works', label: 'Works', icon: Briefcase },
    { id: 'groups', label: 'Groups', icon: Users },
    { id: 'group-requests', label: 'Group Requests', icon: Shield },
    { id: 'community', label: 'Community', icon: Globe },
    { id: 'call-records', label: 'Call Records', icon: Activity },
    { id: 'auto-answer', label: 'Auto Answer', icon: Phone },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'reports', label: 'Reports', icon: Shield },
    { id: 'contacts', label: 'Contacts', icon: Bell },
    { id: 'newsletter', label: 'Newsletter', icon: Mail },
    { id: 'chats', label: 'Chats', icon: MessageCircle },
  ];

  React.useEffect(() => {
    if (currentPage.startsWith('admin-')) {
      const tab = currentPage.replace('admin-', '');
      setActiveTab(tab === 'dashboard' ? 'users' : tab);
    }
  }, [currentPage]);

  React.useEffect(() => {
    if (!isAuthenticated) return;

    let s: any;
    try {
      s = connectSocket();
    } catch {
      return;
    }

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

    s.on('presence:state', onPresenceState);
    s.on('presence:update', onPresenceUpdate);
    return () => {
      s.off('presence:state', onPresenceState);
      s.off('presence:update', onPresenceUpdate);
    };
  }, [isAuthenticated]);

  const runAutoAnswerSearch = async () => {
    const q = autoAnswerQuery.trim();
    if (!q) {
      setAutoAnswerUsers([]);
      return;
    }
    setError('');
    setLoadingAutoAnswer(true);
    try {
      const res = await api.authedRequest<{ ok: true; items: any[] }>(`/api/users/directory?q=${encodeURIComponent(q)}&limit=20`, 'GET');
      setAutoAnswerUsers(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to search users');
    } finally {
      setLoadingAutoAnswer(false);
    }
  };

  const startAdminAutoAnswerCall = (toUserId: string, kind: 'audio' | 'video') => {
    try {
      localStorage.setItem(
        'tdp_admin_auto_call',
        JSON.stringify({
          toUserId: String(toUserId),
          kind,
          autoAnswer: true,
        })
      );
    } catch {
      // ignore
    }

    setDmTargetUserId(String(toUserId));
    setCurrentPage('messages');
  };

  const renderAutoAnswer = () => (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Auto Answer Calls</h3>
          <p className="text-sm text-gray-500">Search a member and place a call that auto-answers on their side (admin-only).</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={autoAnswerQuery}
              onChange={(e) => setAutoAnswerQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runAutoAnswerSearch()}
              placeholder="Search by name / membership id"
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <button
            disabled={loadingAutoAnswer}
            onClick={() => void runAutoAnswerSearch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            Search
          </button>
        </div>

        {loadingAutoAnswer && <p className="mt-3 text-sm text-gray-500">Searching...</p>}

        <div className="mt-4 space-y-2">
          {(autoAnswerUsers || []).map((u) => {
            const uid = String(u?._id || '');
            const name = String(u?.name || 'Member');
            const mid = String(u?.membershipId || '');
            const online = Boolean(presenceOnline[uid]);
            return (
              <div key={uid} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-gray-100 bg-gray-50">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {mid ? `ID: ${mid} • ` : ''}
                    {online ? 'online' : 'offline'}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => startAdminAutoAnswerCall(uid, 'audio')}
                    className="px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-black hover:bg-green-700"
                    title="Auto-answer voice call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => startAdminAutoAnswerCall(uid, 'video')}
                    className="px-3 py-2 rounded-lg bg-purple-600 text-white text-xs font-black hover:bg-purple-700"
                    title="Auto-answer video call"
                  >
                    <Video className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {!loadingAutoAnswer && autoAnswerQuery.trim() && (autoAnswerUsers || []).length === 0 && (
            <p className="text-sm text-gray-500">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );

  const loadTabData = React.useCallback(async (tabId: string) => {
    setError('');
    setLoading(true);
    try {
      if (tabId === 'blogs') {
        const res = await api.request<{ ok: true; items: any[] }>('/api/blogs', 'GET');
        setBlogs(res.items || []);
      }

      if (tabId === 'comments') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/admin/blog-comments?limit=200', 'GET');
        setBlogComments(res.items || []);
      }

      if (tabId === 'polls') {
        const res = await api.request<{ ok: true; items: any[] }>('/api/polls', 'GET');
        setPolls(res.items || []);
      }

      if (tabId === 'surveys') {
        const res = await api.request<{ ok: true; items: any[] }>('/api/surveys', 'GET');
        setSurveys(res.items || []);
      }

      if (tabId === 'works') {
        const res = await api.request<{ ok: true; items: any[] }>('/api/works', 'GET');
        setWorks(res.items || []);
      }

      if (tabId === 'users') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/users?limit=50', 'GET');
        setUsers(res.items || []);
      }

      if (tabId === 'groups') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/groups?limit=200', 'GET');
        setGroups(res.items || []);
      }

      if (tabId === 'group-requests') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/groups/requests', 'GET');
        setGroupRequests(res.items || []);
      }

      if (tabId === 'community') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/messages/community?limit=200', 'GET');
        setCommunityMessages(res.items || []);
      }

      if (tabId === 'call-records') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/call-records?limit=200', 'GET');
        setCallRecords(res.items || []);
      }

      if (tabId === 'alerts') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/alerts', 'GET');
        setAlerts(res.items || []);
      }

      if (tabId === 'reports') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/reports?limit=50', 'GET');
        setReports(res.items || []);
      }

      if (tabId === 'contacts') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/contact?limit=100', 'GET');
        setContacts(res.items || []);
      }

      if (tabId === 'newsletter') {
        const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/newsletter?limit=200', 'GET');
        setSubscribers(res.items || []);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleApproveGroupRequest = async (groupId: string, userId: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/groups/${groupId}/requests/${userId}/approve`, 'POST', {});
      const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/groups/requests', 'GET');
      setGroupRequests(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Approve failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectGroupRequest = async (groupId: string, userId: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/groups/${groupId}/requests/${userId}`, 'DELETE');
      const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/groups/requests', 'GET');
      setGroupRequests(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Reject failed');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockGroupRequest = async (groupId: string, userId: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/groups/${groupId}/requests/${userId}/block`, 'POST', {});
      const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/groups/requests', 'GET');
      setGroupRequests(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Block failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCommunityMessageAdmin = async (messageId: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/messages/community/${messageId}`, 'DELETE');
      const res = await api.authedRequest<{ ok: true; items: any[] }>('/api/messages/community?limit=200', 'GET');
      setCommunityMessages(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateContactStatus = async (id: string, status: 'new' | 'in_progress' | 'closed') => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/contact/${id}/status`, 'PATCH', { status });
      await loadTabData('contacts');
    } catch (e: any) {
      setError(e?.message || 'Failed to update contact');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBlogComment = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/admin/blog-comments/${id}`, 'DELETE');
      await loadTabData('comments');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete comment');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContact = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/contact/${id}`, 'DELETE');
      await loadTabData('contacts');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete contact');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!activeTab) return;
    if (activeTab === 'dashboard' || activeTab === 'chats') return;
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const runAdminChatUserSearch = async () => {
    const q = adminChatUserQuery.trim();
    if (!q) {
      setAdminChatUsers([]);
      return;
    }
    setError('');
    setLoadingAdminChat(true);
    try {
      const res = await api.authedRequest<{ ok: true; items: any[] }>(`/api/users/directory?q=${encodeURIComponent(q)}&limit=20`, 'GET');
      setAdminChatUsers(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to search users');
    } finally {
      setLoadingAdminChat(false);
    }
  };

  const openAdminChatUser = async (uid: string) => {
    setAdminChatTargetUserId(uid);
    setAdminChatActiveOtherUserId(null);
    setAdminChatMessages([]);
    setError('');
    setLoadingAdminChat(true);
    try {
      const res = await api.authedRequest<{ ok: true; items: any[] }>(
        `/api/admin/chats/private/conversations?userId=${encodeURIComponent(uid)}&limit=50`,
        'GET'
      );
      setAdminChatConversations(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load conversations');
    } finally {
      setLoadingAdminChat(false);
    }
  };

  const renderCallRecords = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Call Records</h3>
        <button
          onClick={() => loadTabData('call-records')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="space-y-3">
        {callRecords.map((r) => {
          const created = r?.createdAt ? new Date(r.createdAt) : null;
          const uploaderName = r?.uploader?.name || 'Member';
          const scope = r?.scope || 'private';
          const kind = r?.kind || 'audio';
          const url = r?.file?.url || '';
          const duration = r?.durationSec ? `${r.durationSec}s` : '—';

          return (
            <div key={r._id} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {scope.toUpperCase()} • {kind.toUpperCase()} • {duration}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Uploaded by: {uploaderName}
                    {created ? ` • ${created.toLocaleString()}` : ''}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1 break-all">CallId: {String(r.callId || '')}</p>
                </div>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200"
                    title="Download"
                  >
                    <Download className="w-4 h-4" /> Download
                  </a>
                )}
              </div>

              {url && (
                <div className="mt-3">
                  <audio controls preload="none" className="w-full">
                    <source src={url} />
                  </audio>
                </div>
              )}
            </div>
          );
        })}

        {callRecords.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-100 p-6 text-sm text-gray-500">No recordings found.</div>
        )}
      </div>
    </div>
  );

  const openAdminChatThread = async (otherUserId: string) => {
    if (!adminChatTargetUserId) return;
    setAdminChatActiveOtherUserId(otherUserId);
    setError('');
    setLoadingAdminChat(true);
    try {
      const res = await api.authedRequest<{ ok: true; items: any[] }>(
        `/api/admin/chats/private/${adminChatTargetUserId}/${otherUserId}?limit=200`,
        'GET'
      );
      setAdminChatMessages(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoadingAdminChat(false);
    }
  };

  const openGroupPreview = async (g: any) => {
    setViewingGroup(g);
    setGroupPreviewMessages([]);
    setError('');
    setLoadingGroupPreview(true);
    try {
      const res = await api.authedRequest<{ ok: true; items: any[] }>(`/api/messages/groups/${g._id}?limit=200`, 'GET');
      setGroupPreviewMessages(res.items || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load group messages');
    } finally {
      setLoadingGroupPreview(false);
    }
  };

  const stats = useMemo(() => {
    const pollResponses = 0;
    return [
      { label: 'Total Users', value: users.length ? users.length.toString() : '—', change: '+12.5%', up: true, icon: Users, color: 'from-blue-500 to-blue-600' },
      { label: 'Active Blogs', value: blogs.length.toString(), change: '+8.2%', up: true, icon: FileText, color: 'from-green-500 to-green-600' },
      { label: 'Poll Responses', value: pollResponses.toLocaleString(), change: '+23.1%', up: true, icon: BarChart3, color: 'from-purple-500 to-purple-600' },
      { label: 'Open Works', value: works.filter(w => w.status === 'Open').length.toString(), change: '-5.3%', up: false, icon: Briefcase, color: 'from-orange-500 to-orange-600' },
      { label: 'Pending Reports', value: reports.filter((r) => r.status === 'open').length.toString(), change: '+2', up: true, icon: Shield, color: 'from-red-500 to-red-600' },
      { label: 'Active Chats', value: '—', change: '+15.7%', up: true, icon: MessageCircle, color: 'from-teal-500 to-teal-600' },
    ];
  }, [blogs.length, reports, users.length, works]);

  const handleCreateBlog = async () => {
    setError('');
    if (!blogTitle || !blogContent) {
      setError('Title and content required');
      return;
    }
    setLoading(true);
    try {
      await api.authedRequest('/api/blogs', 'POST', { title: blogTitle, content: blogContent, tags: [], media: [] });
      setBlogTitle('');
      setBlogContent('');
      await loadTabData('blogs');
    } catch (e: any) {
      setError(e?.message || 'Failed to create blog');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBlog = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/blogs/${id}`, 'DELETE');
      await loadTabData('blogs');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete blog');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoll = async () => {
    // legacy handler no longer used
  };

  const handleCreatePollAt = async (idx: number) => {
    const draft = pollDrafts[idx];
    setError('');
    if (!draft?.question?.trim()) {
      setError('Question required');
      return;
    }
    const options = (draft.options || []).map((s) => String(s || '').trim()).filter(Boolean);
    if (options.length < 2) {
      setError('Add at least 2 options');
      return;
    }

    setLoading(true);
    try {
      await api.authedRequest('/api/polls', 'POST', { question: draft.question.trim(), options: options.map((text) => ({ text })) });
      setPollDrafts((prev) => prev.map((p, i) => (i === idx ? { question: '', options: ['', ''] } : p)));
      await loadTabData('polls');
    } catch (e: any) {
      setError(e?.message || 'Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAllPolls = async () => {
    setError('');
    const ready = pollDrafts
      .map((d, idx) => ({
        idx,
        question: String(d.question || '').trim(),
        options: (d.options || []).map((s) => String(s || '').trim()).filter(Boolean),
      }))
      .filter((x) => x.question && x.options.length >= 2);

    if (ready.length === 0) {
      setError('Add at least one valid poll (question + 2 options)');
      return;
    }

    setLoading(true);
    try {
      for (const p of ready) {
        await api.authedRequest('/api/polls', 'POST', { question: p.question, options: p.options.map((text) => ({ text })) });
      }
      setPollDrafts([{ question: '', options: ['', ''] }]);
      await loadTabData('polls');
    } catch (e: any) {
      setError(e?.message || 'Failed to create polls');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePoll = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/polls/${id}`, 'DELETE');
      await loadTabData('polls');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete poll');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSurvey = async () => {
    setError('');
    if (!surveyTitle) {
      setError('Survey title required');
      return;
    }

    const normalized = (surveyDraftQuestions || [])
      .map((q, idx) => {
        const prompt = String(q.prompt || '').trim();
        const type = q.type === 'mcq' ? 'mcq' : 'text';
        const options = type === 'mcq'
          ? (q.options || []).map((s) => String(s || '').trim()).filter(Boolean)
          : [];
        return { order: idx, type, prompt, options };
      })
      .filter((q) => q.prompt);

    if (normalized.length === 0) {
      setError('Add at least one question');
      return;
    }
    for (const q of normalized) {
      if (q.type === 'mcq' && (!q.options || q.options.length < 2)) {
        setError('Each options question needs at least 2 options');
        return;
      }
    }

    setLoading(true);
    try {
      await api.authedRequest('/api/surveys', 'POST', { title: surveyTitle, questions: normalized });
      setSurveyTitle('');
      setSurveyDraftQuestions([{ type: 'text', prompt: '', options: [] }]);
      await loadTabData('surveys');
    } catch (e: any) {
      setError(e?.message || 'Failed to create survey');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSurvey = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/surveys/${id}`, 'DELETE');
      await loadTabData('surveys');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete survey');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWork = async () => {
    setError('');
    if (!workTitle || !workDescription) {
      setError('Title and description required');
      return;
    }
    setLoading(true);
    try {
      await api.authedRequest('/api/works', 'POST', { title: workTitle, description: workDescription });
      setWorkTitle('');
      setWorkDescription('');
      await loadTabData('works');
    } catch (e: any) {
      setError(e?.message || 'Failed to create work');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWork = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/works/${id}`, 'DELETE');
      await loadTabData('works');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete work');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateWorkStatus = async (id: string, status: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/works/${id}`, 'PATCH', { status });
      await loadTabData('works');
    } catch (e: any) {
      setError(e?.message || 'Failed to update work');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    setError('');
    if (!newUserName || !newUserEmail) {
      setError('Name and email required');
      return;
    }
    setLoading(true);
    try {
      await api.authedRequest('/api/users', 'POST', {
        name: newUserName,
        email: newUserEmail,
        password: newUserPassword || undefined,
        role: 'user',
      });
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      await loadTabData('users');
    } catch (e: any) {
      setError(e?.message || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUser = async (id: string, status: 'active' | 'blocked') => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/users/${id}/status`, 'PATCH', { status });
      await loadTabData('users');
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/users/${id}`, 'DELETE');
      await loadTabData('users');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete user');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    setError('');
    if (!groupName) {
      setError('Group name required');
      return;
    }
    setLoading(true);
    try {
      await api.authedRequest('/api/groups', 'POST', { name: groupName, isPublic: groupPublic });
      setGroupName('');
      setGroupPublic(true);
      await loadTabData('groups');
    } catch (e: any) {
      setError(e?.message || 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/groups/${id}`, 'DELETE');
      await loadTabData('groups');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete group');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAlert = async () => {
    setError('');
    if (!alertTitle || !alertMessage) {
      setError('Title and message required');
      return;
    }
    setLoading(true);
    try {
      await api.authedRequest('/api/alerts', 'POST', { title: alertTitle, message: alertMessage });
      setAlertTitle('');
      setAlertMessage('');
      await loadTabData('alerts');
    } catch (e: any) {
      setError(e?.message || 'Failed to create alert');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/alerts/${id}`, 'DELETE');
      await loadTabData('alerts');
    } catch (e: any) {
      setError(e?.message || 'Failed to delete alert');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (id: string, action: 'resolve' | 'ignore') => {
    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/reports/${id}/handle`, 'PATCH', { action });
      await loadTabData('reports');
    } catch (e: any) {
      setError(e?.message || 'Failed to update report');
    } finally {
      setLoading(false);
    }
  };

  const renderOverview = () => (
    <div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <span className={`flex items-center gap-1 text-xs font-bold ${stat.up ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-black text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm mb-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Export Users', icon: Download, color: 'bg-blue-50 text-blue-600 hover:bg-blue-100' },
            { label: 'Send Alert', icon: Bell, color: 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' },
            { label: 'Review Reports', icon: Shield, color: 'bg-red-50 text-red-600 hover:bg-red-100' },
            { label: 'Refresh Data', icon: RefreshCw, color: 'bg-green-50 text-green-600 hover:bg-green-100' },
          ].map((action, i) => {
            const Icon = action.icon;
            return (
              <button key={i} className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${action.color}`}>
                <Icon className="w-4 h-4" /> {action.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity Chart Placeholder */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">User Growth (Last 7 Days)</h3>
          <div className="space-y-3">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => {
              const width = [65, 72, 58, 80, 90, 95, 85][i];
              return (
                <div key={day} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-8">{day}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className="bg-gradient-to-r from-blue-500 to-blue-600 h-2.5 rounded-full transition-all duration-500" style={{ width: `${width}%` }} />
                  </div>
                  <span className="text-xs font-medium text-gray-600 w-8">{Math.round(width * 3.5)}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Content Distribution</h3>
          <div className="space-y-4">
            {[
              { label: 'Blog Posts', count: blogs.length, total: 50, color: 'bg-blue-500' },
              { label: 'Active Polls', count: polls.length, total: 20, color: 'bg-green-500' },
              { label: 'Work Requests', count: works.length, total: 30, color: 'bg-orange-500' },
              { label: 'Groups', count: 8, total: 15, color: 'bg-purple-500' },
              { label: 'Reports', count: 4, total: 10, color: 'bg-red-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-600 font-medium">{item.label}</span>
                  <span className="text-gray-400">{item.count}/{item.total}</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2">
                  <div className={`${item.color} h-2 rounded-full`} style={{ width: `${(item.count / item.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderGroupRequests = () => (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-900">Group Access Requests</h3>
        <button
          disabled={loading}
          onClick={() => void loadTabData('group-requests')}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Group', 'Requester', 'Requested At', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(groupRequests || []).map((it) => {
              const groupId = String(it?.group?._id || '');
              const groupName = String(it?.group?.name || '—');
              const rUser = it?.request?.user;
              const userId = String(rUser?._id || it?.request?.user || '');
              const userName = String(rUser?.name || '—');
              const requestedAt = String(it?.request?.requestedAt || '').slice(0, 19).replace('T', ' ');
              return (
                <tr key={`${groupId}:${userId}`} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{groupName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{userName}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{requestedAt || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        disabled={loading}
                        onClick={() => void handleApproveGroupRequest(groupId, userId)}
                        className="px-3 py-1.5 text-xs font-black bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => void handleRejectGroupRequest(groupId, userId)}
                        className="px-3 py-1.5 text-xs font-black bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        disabled={loading}
                        onClick={() => void handleBlockGroupRequest(groupId, userId)}
                        className="px-3 py-1.5 text-xs font-black bg-gray-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
                      >
                        Block
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {(groupRequests || []).length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">No pending requests</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderCommunityModeration = () => (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-bold text-gray-900">Community Moderation</h3>
        <button
          disabled={loading}
          onClick={() => void loadTabData('community')}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50 disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['From', 'Message', 'Created', 'Status', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(communityMessages || []).map((m) => {
              const fromName = String(m?.from?.name || 'Member');
              const created = String(m?.createdAt || '').slice(0, 19).replace('T', ' ');
              const isDeleted = Boolean(m?.deletedAt);
              return (
                <tr key={m._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{fromName}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 max-w-[520px] truncate">{String(m?.text || '')}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{created || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isDeleted ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                    }`}>{isDeleted ? 'deleted' : 'active'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      disabled={loading}
                      onClick={() => void handleDeleteCommunityMessageAdmin(m._id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}

            {(communityMessages || []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">No messages found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderComments = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Blog Comments</h3>
        <button onClick={() => loadTabData('comments')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Blog', 'User', 'Comment', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {blogComments.map((c) => (
              <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.blog?.title || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.user?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.text}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(c.createdAt || '').slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <button
                    disabled={loading}
                    onClick={() => void handleDeleteBlogComment(c._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}

            {blogComments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">No comments found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContacts = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Contact Submissions</h3>
          <p className="text-sm text-gray-500">Messages submitted from the Contact page</p>
        </div>
        <button
          disabled={loading}
          onClick={() => loadTabData('contacts')}
          className="flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Name', 'Email', 'Category', 'Subject', 'Status', 'Date', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c._id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.category || 'General'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{c.subject || '—'}</td>
                <td className="px-4 py-3">
                  <select
                    value={c.status}
                    disabled={loading}
                    onChange={(e) => handleUpdateContactStatus(c._id, e.target.value as any)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white disabled:opacity-50"
                  >
                    <option value="new">new</option>
                    <option value="in_progress">in_progress</option>
                    <option value="closed">closed</option>
                  </select>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(c.createdAt || '').slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button
                      disabled={loading}
                      onClick={() => handleDeleteContact(c._id)}
                      className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {contacts.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm text-gray-500">No contact submissions yet.</p>
          </div>
        )}
      </div>

      {contacts.length > 0 && (
        <div className="mt-4 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Latest Message</p>
          <div className="text-sm text-gray-700 whitespace-pre-wrap">
            {String(contacts[0]?.message || '')}
          </div>
        </div>
      )}
    </div>
  );

  const renderUsers = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">User Management</h3>
        <button onClick={() => loadTabData('users')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="grid md:grid-cols-3 gap-3">
          <input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="Email" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <input value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} placeholder="Password (optional)" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="mt-3 flex justify-end">
          <button disabled={loading} onClick={handleCreateUser} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Add User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['User', 'Email', 'Role', 'Status', 'Joined', 'Posts', 'Actions'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">{u.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>{u.status}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{String(u.createdAt || '').slice(0, 10)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">—</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => handleBlockUser(u._id, u.status === 'active' ? 'blocked' : 'active')} className="p-1.5 hover:bg-red-50 rounded-lg" title="Block/Unblock"><Ban className="w-3.5 h-3.5 text-red-400" /></button>
                      <button onClick={() => handleDeleteUser(u._id)} className="p-1.5 hover:bg-red-50 rounded-lg" title="Delete"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderBlogs = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Blog Management</h3>
        <button onClick={() => loadTabData('blogs')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="grid gap-3">
          <input value={blogTitle} onChange={(e) => setBlogTitle(e.target.value)} placeholder="Blog title" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <textarea value={blogContent} onChange={(e) => setBlogContent(e.target.value)} placeholder="Blog content" className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-h-[100px]" />
        </div>
        <div className="mt-3 flex justify-end">
          <button disabled={loading} onClick={handleCreateBlog} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Add Blog
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {blogs.map(blog => (
          <div key={blog._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-4 flex-1">
              {blog?.media?.[0]?.url && <img src={blog.media[0].url} alt="" className="w-16 h-12 rounded-lg object-cover" />}
              <div>
                <h4 className="text-sm font-bold text-gray-900">{blog.title}</h4>
                <p className="text-xs text-gray-400">{String(blog.createdAt || '').slice(0, 10)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button className="p-2 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4 text-gray-400" /></button>
              <button disabled={loading} onClick={() => handleDeleteBlog(blog._id)} className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderPolls = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Poll Management</h3>
        <button onClick={() => loadTabData('polls')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-gray-900">Create Polls</h4>
            <p className="text-xs text-gray-500">Add multiple questions and options using the buttons</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={loading}
              onClick={() => setPollDrafts((prev) => [...prev, { question: '', options: ['', ''] }])}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              Add Poll
            </button>
            <button
              disabled={loading}
              onClick={() => void handleCreateAllPolls()}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Create All
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-4">
          {pollDrafts.map((draft, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-700">Poll #{idx + 1}</p>
                <button
                  disabled={loading || pollDrafts.length === 1}
                  onClick={() => setPollDrafts((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>

              <input
                value={draft.question}
                onChange={(e) =>
                  setPollDrafts((prev) => prev.map((p, i) => (i === idx ? { ...p, question: e.target.value } : p)))
                }
                placeholder="Poll question"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />

              <div className="mt-3 space-y-2">
                {(draft.options || []).map((opt, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={(e) =>
                        setPollDrafts((prev) =>
                          prev.map((p, i) => {
                            if (i !== idx) return p;
                            const next = [...(p.options || [])];
                            next[j] = e.target.value;
                            return { ...p, options: next };
                          })
                        )
                      }
                      placeholder={`Option ${j + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    />
                    <button
                      disabled={loading || (draft.options || []).length <= 2}
                      onClick={() =>
                        setPollDrafts((prev) =>
                          prev.map((p, i) => {
                            if (i !== idx) return p;
                            const next = (p.options || []).filter((_, k) => k !== j);
                            return { ...p, options: next };
                          })
                        )
                      }
                      className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  disabled={loading}
                  onClick={() =>
                    setPollDrafts((prev) =>
                      prev.map((p, i) => (i === idx ? { ...p, options: [...(p.options || []), ''] } : p))
                    )
                  }
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                >
                  Add Option
                </button>
                <button
                  disabled={loading}
                  onClick={() => void handleCreatePollAt(idx)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {polls.map((p) => (
          <div key={p._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">{p.question}</h4>
              <p className="text-xs text-gray-400">{String(p.createdAt || '').slice(0, 10)}</p>
            </div>
            <button disabled={loading} onClick={() => handleDeletePoll(p._id)} className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderSurveys = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Survey Management</h3>
        <button onClick={() => loadTabData('surveys')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h4 className="text-sm font-bold text-gray-900">Create Survey</h4>
            <p className="text-xs text-gray-500">Add any number of questions. Question type can be Text or Options.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={loading}
              onClick={() => setSurveyDraftQuestions((prev) => [...prev, { type: 'text', prompt: '', options: [] }])}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              Add Question
            </button>
            <button
              disabled={loading}
              onClick={handleCreateSurvey}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              Add Survey
            </button>
          </div>
        </div>

        <div className="mt-3 grid gap-3">
          <input value={surveyTitle} onChange={(e) => setSurveyTitle(e.target.value)} placeholder="Survey title" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>

        <div className="mt-4 space-y-4">
          {surveyDraftQuestions.map((q, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-bold text-gray-700">Question #{idx + 1}</p>
                <button
                  disabled={loading || surveyDraftQuestions.length === 1}
                  onClick={() => setSurveyDraftQuestions((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-xs font-bold text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>

              <div className="grid md:grid-cols-3 gap-3">
                <select
                  value={q.type}
                  onChange={(e) =>
                    setSurveyDraftQuestions((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, type: e.target.value === 'mcq' ? 'mcq' : 'text', options: e.target.value === 'mcq' ? (x.options?.length ? x.options : ['', '']) : [] } : x))
                    )
                  }
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
                >
                  <option value="text">Text Answer</option>
                  <option value="mcq">Options</option>
                </select>
                <input
                  value={q.prompt}
                  onChange={(e) => setSurveyDraftQuestions((prev) => prev.map((x, i) => (i === idx ? { ...x, prompt: e.target.value } : x)))}
                  placeholder="Question prompt"
                  className="md:col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
              </div>

              {q.type === 'mcq' && (
                <div className="mt-3">
                  <div className="space-y-2">
                    {(q.options || []).map((opt, j) => (
                      <div key={j} className="flex items-center gap-2">
                        <input
                          value={opt}
                          onChange={(e) =>
                            setSurveyDraftQuestions((prev) =>
                              prev.map((x, i) => {
                                if (i !== idx) return x;
                                const next = [...(x.options || [])];
                                next[j] = e.target.value;
                                return { ...x, options: next };
                              })
                            )
                          }
                          placeholder={`Option ${j + 1}`}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                        <button
                          disabled={loading || (q.options || []).length <= 2}
                          onClick={() =>
                            setSurveyDraftQuestions((prev) =>
                              prev.map((x, i) => {
                                if (i !== idx) return x;
                                const next = (x.options || []).filter((_, k) => k !== j);
                                return { ...x, options: next };
                              })
                            )
                          }
                          className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <button
                      disabled={loading}
                      onClick={() => setSurveyDraftQuestions((prev) => prev.map((x, i) => (i === idx ? { ...x, options: [...(x.options || []), ''] } : x)))}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50"
                    >
                      Add Option
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {surveys.map((s) => (
          <div key={s._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">{s.title}</h4>
              <p className="text-xs text-gray-400">{String(s.createdAt || '').slice(0, 10)}</p>
            </div>
            <button disabled={loading} onClick={() => handleDeleteSurvey(s._id)} className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderWorks = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Works Management</h3>
        <button onClick={() => loadTabData('works')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input value={workTitle} onChange={(e) => setWorkTitle(e.target.value)} placeholder="Work title" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <input value={workDescription} onChange={(e) => setWorkDescription(e.target.value)} placeholder="Work description" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
        </div>
        <div className="mt-3 flex justify-end">
          <button disabled={loading} onClick={handleCreateWork} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Add Work
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {works.map(work => (
          <div key={work._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">{work.title}</h4>
              <p className="text-xs text-gray-400">{String(work.createdAt || '').slice(0, 10)}</p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={work.status}
                onChange={e => handleUpdateWorkStatus(work._id, e.target.value as any)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
              >
                <option value="Open">Open</option>
                <option value="Found">Found</option>
              </select>
              <button disabled={loading} onClick={() => handleDeleteWork(work._id)} className="p-2 hover:bg-red-50 rounded-lg disabled:opacity-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderGroups = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Group Management</h3>
        <button onClick={() => loadTabData('groups')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          <select value={groupPublic ? 'public' : 'private'} onChange={(e) => setGroupPublic(e.target.value === 'public')} className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
            <option value="public">Public</option>
            <option value="private">Private</option>
          </select>
        </div>
        <div className="mt-3 flex justify-end">
          <button disabled={loading} onClick={handleCreateGroup} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
            Add Group
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <div key={g._id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between shadow-sm">
            <div className="flex-1">
              <h4 className="text-sm font-bold text-gray-900">{g.name}</h4>
              <p className="text-xs text-gray-500">{g.isPublic ? 'Public' : 'Private'} • {g.membersCount || g.members?.length || 0} members</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => void openGroupPreview(g)}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors"
              >
                <Eye className="w-4 h-4 inline mr-1" /> View
              </button>
              <button
                onClick={() => void handleDeleteGroup(g._id)}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderNewsletter = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Newsletter Subscribers</h3>
        <button onClick={() => loadTabData('newsletter')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Source</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Subscribed</th>
            </tr>
          </thead>
          <tbody>
            {subscribers.map((s) => (
              <tr key={s._id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.email}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{s.source || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(s.createdAt || '').slice(0, 19).replace('T', ' ')}</td>
              </tr>
            ))}
            {subscribers.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-sm text-gray-500">No subscribers yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderChats = () => (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Chat Moderation</h3>

      <div className="grid lg:grid-cols-12 gap-4">
        <div className="lg:col-span-4">
          <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-900 mb-3">Search user</p>
            <div className="flex gap-2">
              <input
                value={adminChatUserQuery}
                onChange={(e) => setAdminChatUserQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void runAdminChatUserSearch()}
                placeholder="Name / Membership ID / Phone"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
              />
              <button
                onClick={() => void runAdminChatUserSearch()}
                disabled={loadingAdminChat}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                Search
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {adminChatUsers.map((u) => (
                <button
                  key={u._id}
                  onClick={() => void openAdminChatUser(String(u._id))}
                  className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                    String(adminChatTargetUserId) === String(u._id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{u.name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{u.membershipId || ''}</p>
                </button>
              ))}
              {adminChatUsers.length === 0 && (
                <p className="text-xs text-gray-500">Search a user to view their private chats.</p>
              )}
            </div>
          </div>

          {adminChatTargetUserId && (
            <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-gray-900">Conversations</p>
                <button
                  onClick={() => void openAdminChatUser(adminChatTargetUserId)}
                  className="text-xs font-bold text-blue-600 hover:text-blue-700"
                >
                  Refresh
                </button>
              </div>
              <div className="space-y-2 max-h-[320px] overflow-auto">
                {adminChatConversations.map((c) => (
                  <button
                    key={c.otherUser?._id}
                    onClick={() => void openAdminChatThread(String(c.otherUser._id))}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-colors ${
                      String(adminChatActiveOtherUserId) === String(c.otherUser?._id)
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.otherUser?.name || 'Member'}</p>
                    <p className="text-xs text-gray-500 truncate">{c.lastMessage?.text || ''}</p>
                  </button>
                ))}
                {adminChatConversations.length === 0 && (
                  <p className="text-xs text-gray-500">No private messages found for this user.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-8">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-900">Messages</p>
              {loadingAdminChat && <p className="text-xs text-gray-500">Loading...</p>}
            </div>
            <div className="p-4 bg-gray-50 max-h-[520px] overflow-auto space-y-3">
              {adminChatMessages.map((m) => {
                const senderName = m?.from?.name || 'Member';
                const t = m?.createdAt ? new Date(m.createdAt) : new Date();
                return (
                  <div key={m._id} className="bg-white border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-gray-900">{senderName}</p>
                      <p className="text-[10px] text-gray-400">{t.toLocaleString()}</p>
                    </div>
                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{m.text}</p>
                    {m.media?.url && (
                      <a href={m.media.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-2 inline-block">
                        View attachment
                      </a>
                    )}
                  </div>
                );
              })}
              {adminChatMessages.length === 0 && (
                <p className="text-sm text-gray-500">Select a conversation to view message history.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAlerts = () => (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">System Alerts</h3>
        <button onClick={() => loadTabData('alerts')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm mb-4">
        <div className="grid md:grid-cols-2 gap-3">
          <input
            value={alertTitle}
            onChange={(e) => setAlertTitle(e.target.value)}
            placeholder="Alert title"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <input
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
            placeholder="Alert message"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="mt-3 flex justify-end">
          <button
            disabled={loading}
            onClick={() => void handleCreateAlert()}
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            Create Alert
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Title', 'Message', 'Active', 'Starts', 'Expires', 'Created', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a._id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.title}</td>
                <td className="px-4 py-3 text-sm text-gray-500 max-w-[520px] truncate">{a.message}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    a.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                  }`}>{a.isActive ? 'active' : 'inactive'}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(a.startsAt || '').slice(0, 10) || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{a.expiresAt ? String(a.expiresAt || '').slice(0, 10) : '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(a.createdAt || '').slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <button
                    disabled={loading}
                    onClick={() => void handleDeleteAlert(a._id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}

            {alerts.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-500">No alerts found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReports = () => (
    <div>
      <h3 className="text-lg font-bold text-gray-900 mb-4">Report Management</h3>
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {['Type', 'Reporter', 'Target', 'Status', 'Date', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r._id} className="border-b border-gray-50 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{r.targetType || 'Other'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{r?.reporter?.name || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(r.targetId)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    r.status === 'open' ? 'bg-yellow-100 text-yellow-700' :
                    r.status === 'resolved' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{String(r.createdAt || '').slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button disabled={loading} onClick={() => handleReport(r._id, 'resolve')} className="p-1.5 hover:bg-green-50 rounded-lg disabled:opacity-50" title="Resolve"><CheckCircle className="w-3.5 h-3.5 text-green-500" /></button>
                    <button disabled={loading} onClick={() => handleReport(r._id, 'ignore')} className="p-1.5 hover:bg-red-50 rounded-lg disabled:opacity-50" title="Dismiss"><XCircle className="w-3.5 h-3.5 text-red-500" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderContent = () => {
    if (error) {
      return <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>;
    }

    if (loading) {
      return <div className="text-center py-12"><p className="text-gray-500 font-medium">Loading...</p></div>;
    }

    switch (activeTab) {
      case 'dashboard': return renderUsers();
      case 'users': return renderUsers();
      case 'blogs': return renderBlogs();
      case 'comments': return renderComments();
      case 'polls': return renderPolls();
      case 'surveys': return renderSurveys();
      case 'works': return renderWorks();
      case 'groups': return renderGroups();
      case 'group-requests': return renderGroupRequests();
      case 'community': return renderCommunityModeration();
      case 'call-records': return renderCallRecords();
      case 'auto-answer': return renderAutoAnswer();
      case 'alerts': return renderAlerts();
      case 'reports': return renderReports();
      case 'contacts': return renderContacts();
      case 'newsletter':
        return renderNewsletter();
      case 'chats':
        return renderChats();
      default: return renderUsers();
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">Manage platform content, users, and analytics</p>
      </div>

      <AIInsightBanner text="Data analytics and moderation help leadership take informed actions. Real-time insights enable proactive governance and community management." />

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-xs font-bold text-gray-500 uppercase">Sections</p>
            </div>
            <div className="p-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
                    <span className="truncate">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-9">
          {renderContent()}
        </div>
      </div>

      {viewingGroup && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Group</p>
                <h3 className="text-xl font-black text-gray-900 leading-snug">{viewingGroup.name}</h3>
              </div>
              <button
                onClick={() => setViewingGroup(null)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            <div className="p-5 bg-gray-50 space-y-3">
              {loadingGroupPreview && <p className="text-sm text-gray-500">Loading...</p>}
              {!loadingGroupPreview && groupPreviewMessages.map((m) => (
                <div key={m._id} className="bg-white border border-gray-100 rounded-xl p-3">
                  <p className="text-xs font-bold text-gray-900">{m?.from?.name || 'Member'}</p>
                  <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{m.text}</p>
                  {m.media?.url && (
                    <a href={m.media.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline mt-2 inline-block">
                      View attachment
                    </a>
                  )}
                </div>
              ))}
              {!loadingGroupPreview && groupPreviewMessages.length === 0 && (
                <p className="text-sm text-gray-500">No messages found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
