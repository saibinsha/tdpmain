import React, { useEffect } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { connectSocket } from '@/lib/socket';
import Navbar from './party/Navbar';
import Footer from './party/Footer';
import LoginModal from './party/LoginModal';
import HomePage from './party/HomePage';
import BlogsPage from './party/BlogsPage';
import PollsPage from './party/PollsPage';
import SurveysPage from './party/SurveysPage';
import MembersPage from './party/MembersPage';
import MessagesPage from './party/MessagesPage';
import CommunityPage from './party/CommunityPage';
import GroupsPage from './party/GroupsPage';
import WorksPage from './party/WorksPage';
import ContactPage from './party/ContactPage';
import ReportPage from './party/ReportPage';
import ProfilePage from './party/ProfilePage';
import AdminDashboard from './party/AdminDashboard';

const AppLayout: React.FC = () => {
  const { currentPage, user, isAuthenticated, setCurrentPage } = useAppContext();

  // Scroll to top on page change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let s: any;
    try {
      s = connectSocket();
    } catch {
      return;
    }

    const onIncoming = (payload: any) => {
      try {
        if (!payload?.callId) return;
        const fromUserId = String(payload?.from?._id || '').trim();
        if (!fromUserId) return;

        const aa = Boolean(payload?.autoAnswer) || String(payload?.autoAnswer || '') === '1';

        localStorage.setItem(
          'tdp_pending_incoming_call',
          JSON.stringify({
            scope: 'private',
            callId: String(payload.callId),
            kind: payload.kind === 'video' ? 'video' : 'audio',
            fromUserId,
            fromName: String(payload?.from?.name || 'Member'),
            autoAnswer: aa,
          })
        );

        setCurrentPage('messages');
      } catch {
        // ignore
      }
    };

    const onPresenceState = (payload: any) => {
      try {
        const ids: string[] = Array.isArray(payload?.onlineUserIds)
          ? payload.onlineUserIds.map((x: any) => String(x))
          : [];
        const next: Record<string, boolean> = {};
        for (const id of ids) next[String(id)] = true;
        localStorage.setItem('tdp_presence_online', JSON.stringify(next));
        localStorage.setItem('tdp_presence_online_ts', String(Date.now()));
        window.dispatchEvent(new Event('tdp_presence_changed'));
      } catch {
        // ignore
      }
    };

    const onPresenceUpdate = (payload: any) => {
      try {
        const uid = String(payload?.userId || '').trim();
        if (!uid) return;
        const online = Boolean(payload?.online);
        const raw = localStorage.getItem('tdp_presence_online');
        const prev = raw ? JSON.parse(raw) : {};
        const next = { ...(prev || {}), [uid]: online };
        localStorage.setItem('tdp_presence_online', JSON.stringify(next));
        localStorage.setItem('tdp_presence_online_ts', String(Date.now()));
        window.dispatchEvent(new Event('tdp_presence_changed'));
      } catch {
        // ignore
      }
    };

    const onVisibility = () => {
      try {
        if (document.visibilityState === 'visible') {
          const sock = connectSocket();
          sock.connect?.();
        }
      } catch {
        // ignore
      }
    };

    const clearPendingIfMatches = (scope: 'private' | 'group', callId: string) => {
      try {
        const raw = localStorage.getItem('tdp_pending_incoming_call');
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!parsed) return;
        if (String(parsed.scope) !== String(scope)) return;
        if (String(parsed.callId) !== String(callId)) return;
        localStorage.removeItem('tdp_pending_incoming_call');
      } catch {
        // ignore
      }
    };

    const onHangup = (payload: any) => {
      const id = String(payload?.callId || '').trim();
      if (!id) return;
      clearPendingIfMatches('private', id);
    };

    const onGroupHangup = (payload: any) => {
      const id = String(payload?.callId || '').trim();
      if (!id) return;
      clearPendingIfMatches('group', id);
    };

    const onIncomingGroup = (payload: any) => {
      try {
        if (!payload?.callId || !payload?.groupId) return;
        localStorage.setItem(
          'tdp_pending_incoming_call',
          JSON.stringify({
            scope: 'group',
            callId: String(payload.callId),
            kind: payload.kind === 'video' ? 'video' : 'audio',
            groupId: String(payload.groupId),
            fromUserId: String(payload?.from?._id || ''),
            fromName: String(payload?.from?.name || 'Member'),
          })
        );
        localStorage.setItem('tdp_open_group_id', String(payload.groupId));
        setCurrentPage('groups');
      } catch {
        // ignore
      }
    };

    s.on('call:incoming', onIncoming);
    s.on('groupcall:incoming', onIncomingGroup);
    s.on('call:hangup', onHangup);
    s.on('groupcall:hangup', onGroupHangup);
    s.on('presence:state', onPresenceState);
    s.on('presence:update', onPresenceUpdate);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      s.off('call:incoming', onIncoming);
      s.off('groupcall:incoming', onIncomingGroup);
      s.off('call:hangup', onHangup);
      s.off('groupcall:hangup', onGroupHangup);
      s.off('presence:state', onPresenceState);
      s.off('presence:update', onPresenceUpdate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated, setCurrentPage]);

  const renderPage = () => {
    // Admin pages - redirect to admin dashboard if user is admin
    if (currentPage.startsWith('admin-')) {
      if (user?.role === 'admin') {
        return <AdminDashboard />;
      }
      return <HomePage />;
    }

    switch (currentPage) {
      case 'home':
        return <HomePage />;
      case 'blogs':
        return <BlogsPage />;
      case 'polls':
        return <PollsPage />;
      case 'surveys':
        return <SurveysPage />;
      case 'members':
        return <MembersPage />;
      case 'messages':
        return <MessagesPage />;
      case 'community':
        return <CommunityPage />;
      case 'groups':
        return <GroupsPage />;
      case 'works':
        return <WorksPage />;
      case 'contact':
        return <ContactPage />;
      case 'report':
        return <ReportPage />;
      case 'profile':
        return <ProfilePage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        {renderPage()}
      </main>
      <Footer />
      <LoginModal />
    </div>
  );
};

export default AppLayout;
