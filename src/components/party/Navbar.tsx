import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import {
  Home, FileText, BarChart3, ClipboardList, Users, MessageCircle,
  Globe, FolderOpen, Briefcase, Phone, Flag, LogIn, LogOut, User,
  LayoutDashboard, Bell, ShieldAlert, MessagesSquare, Menu, X,
  ChevronDown, Settings
} from 'lucide-react';

import { api } from '@/lib/api';

const Navbar: React.FC = () => {
  const { currentPage, setCurrentPage, user, isAuthenticated, logout, setShowLoginModal, setLoginMode, notifications, clearNotifications } = useAppContext();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileDropdown, setProfileDropdown] = useState(false);

  const [activeAlerts, setActiveAlerts] = useState<any[]>([]);

  const alertText = useMemo(() => {
    const parts = (activeAlerts || [])
      .map((a) => {
        const title = String(a?.title || '').trim();
        const msg = String(a?.message || '').trim();
        if (!title && !msg) return null;
        return title && msg ? `${title}: ${msg}` : title || msg;
      })
      .filter(Boolean);

    return parts.join('   •   ');
  }, [activeAlerts]);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const res = await api.request<{ ok: true; items: any[] }>('/api/alerts/active', 'GET');
        if (!alive) return;
        setActiveAlerts(res.items || []);
      } catch {
        if (!alive) return;
        setActiveAlerts([]);
      }
    }

    void load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const userLinks = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'blogs', label: 'Blogs', icon: FileText },
    { id: 'polls', label: 'Polls', icon: BarChart3 },
    { id: 'surveys', label: 'Surveys', icon: ClipboardList },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'messages', label: 'Messages', icon: MessageCircle },
    { id: 'community', label: 'Community', icon: Globe },
    { id: 'groups', label: 'Groups', icon: FolderOpen },
    { id: 'works', label: 'Works', icon: Briefcase },
    { id: 'contact', label: 'Contact', icon: Phone },
    { id: 'report', label: 'Report', icon: Flag },
  ];

  const adminLinks = [
    { id: 'admin-dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'admin-users', label: 'Users', icon: Users },
    { id: 'admin-blogs', label: 'Blogs', icon: FileText },
    { id: 'admin-polls', label: 'Polls', icon: BarChart3 },
    { id: 'admin-surveys', label: 'Surveys', icon: ClipboardList },
    { id: 'admin-works', label: 'Works', icon: Briefcase },
    { id: 'admin-groups', label: 'Groups', icon: FolderOpen },
    { id: 'admin-auto-answer', label: 'Auto Answer', icon: Phone },
    { id: 'admin-alerts', label: 'Alerts', icon: Bell },
    { id: 'admin-reports', label: 'Reports', icon: ShieldAlert },
    { id: 'admin-chats', label: 'Chats', icon: MessagesSquare },
  ];

  const links = user?.role === 'admin' ? adminLinks : userLinks;

  const handleNav = (id: string) => {
    setCurrentPage(id);
    setMobileOpen(false);
    setProfileDropdown(false);
  };

  const toggleProfileDropdown = () => {
    setProfileDropdown((prev) => {
      const next = !prev;
      if (next) clearNotifications();
      return next;
    });
  };

  const handleLogin = () => {
    setLoginMode('user');
    setShowLoginModal(true);
    setMobileOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm overflow-visible">
      {/* Top accent bar */}
      <div className="h-1 bg-gradient-to-r from-yellow-400 via-blue-600 to-yellow-400" />

      {alertText ? (
        <div className="bg-blue-700 text-white">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3 overflow-hidden">
            <Bell className="w-4 h-4 text-yellow-300 flex-shrink-0" />
            <div className="relative flex-1 overflow-hidden">
              <div className="whitespace-nowrap will-change-transform animate-[marquee_22s_linear_infinite]">
                <span className="text-xs font-semibold">{alertText}</span>
                <span className="mx-8 text-yellow-200">•</span>
                <span className="text-xs font-semibold">{alertText}</span>
              </div>
            </div>
          </div>
          <style>{`
            @keyframes marquee {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      ) : null}
      
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <button
  onClick={() => handleNav('home')}
  className="flex items-center hover:opacity-80 transition-opacity"
>
  <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center">
    <img
      src="/logo.png"
      alt="Logo"
      className="w-full h-full object-contain"
    />
  </div>
</button>



          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {links.map(link => {
              const Icon = link.icon;
              const isActive = currentPage === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNav(link.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-blue-700'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {link.label}
                </button>
              );
            })}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={toggleProfileDropdown}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                    {user?.profilePicture ? (
                      <img src={user.profilePicture} alt={user?.name || 'User'} className="w-full h-full object-cover" />
                    ) : (
                      user?.avatar || 'U'
                    )}
                  </div>
                  <span className="hidden md:block text-sm font-medium text-gray-700">{user?.name}</span>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                  {notifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {notifications}
                    </span>
                  )}
                </button>
                {profileDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                      <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        user?.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user?.role}
                      </span>
                    </div>
                    <button
                      onClick={() => handleNav('profile')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <User className="w-4 h-4" /> My Profile
                    </button>
                    <button
                      onClick={() => handleNav('messages')}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" /> Messages
                      {notifications > 0 && (
                        <span className="ml-auto bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">{notifications}</span>
                      )}
                    </button>
                    {user?.role === 'admin' && (
                      <button
                        onClick={() => handleNav('admin-dashboard')}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings className="w-4 h-4" /> Admin Panel
                      </button>
                    )}
                    <div className="border-t border-gray-100 mt-1 pt-1">
                      <button
                        onClick={() => { logout(); setProfileDropdown(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" /> Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleLogin}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
                >
                  <LogIn className="w-4 h-4" />
                  <span className="hidden sm:inline">Login</span>
                </button>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white shadow-lg">
          <div className="max-h-[70vh] overflow-y-auto py-2 px-4">
            <div className="grid grid-cols-2 gap-1">
              {links.map(link => {
                const Icon = link.icon;
                const isActive = currentPage === link.id;
                return (
                  <button
                    key={link.id}
                    onClick={() => handleNav(link.id)}
                    className={`flex items-center gap-2 px-3 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </button>
                );
              })}
            </div>
            {!isAuthenticated && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
                <button
                  onClick={handleLogin}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Login / Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
