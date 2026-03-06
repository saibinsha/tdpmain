import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { connectSocket, disconnectSocket } from '@/lib/socket';

declare global {
  interface Window {
    setFcmToken?: (token: string) => void;
    handlePushOpen?: (payload: any) => void;
    Android?: any;
  }
}

interface User {
  id: string;
  membershipId?: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
  profilePicture?: string;
  phone?: string;
  district?: string;
  constituency?: string;
  address?: string;
  joinedDate?: string;
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: Date;
  media?: string;
}

interface ChatRoom {
  id: string;
  name: string;
  type: 'private' | 'community' | 'group';
  participants: string[];
  messages: Message[];
  lastMessage?: string;
  unread: number;
}

interface BlogPost {
  id: string;
  title: string;
  content: string;
  author: string;
  authorAvatar: string;
  image?: string;
  likes: number;
  liked: boolean;
  comments: { id: string; author: string; text: string; date: string }[];
  date: string;
  category: string;
}

interface Poll {
  id: string;
  question: string;
  options: { id: string; text: string; votes: number }[];
  totalVotes: number;
  voted: boolean;
  votedOption?: string;
  deadline: string;
  category: string;
}

interface WorkRequest {
  id: string;
  title: string;
  description: string;
  author: string;
  authorId: string;
  status: 'Open' | 'Found' | 'In Progress' | 'Completed';
  category: string;
  location: string;
  date: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
}

interface AppContextType {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  adminLogin: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, 'name' | 'phone' | 'profilePicture' | 'district' | 'constituency' | 'address'>>) => Promise<void>;
  blogs: BlogPost[];
  addBlog: (blog: Omit<BlogPost, 'id' | 'likes' | 'liked' | 'comments' | 'date'>) => void;
  likeBlog: (id: string) => void;
  addComment: (blogId: string, text: string) => void;
  deleteBlog: (id: string) => void;
  polls: Poll[];
  votePoll: (pollId: string, optionId: string) => void;
  works: WorkRequest[];
  addWork: (work: Omit<WorkRequest, 'id' | 'date' | 'authorId'>) => void;
  updateWorkStatus: (id: string, status: WorkRequest['status']) => void;
  deleteWork: (id: string) => void;
  chatRooms: ChatRoom[];
  activeChatRoom: string | null;
  setActiveChatRoom: (id: string | null) => void;
  sendMessage: (roomId: string, text: string) => void;
  dmTargetUserId: string | null;
  setDmTargetUserId: (id: string | null) => void;
  notifications: number;
  clearNotifications: () => void;
  showLoginModal: boolean;
  setShowLoginModal: (show: boolean) => void;
  loginMode: 'user' | 'admin';
  setLoginMode: (mode: 'user' | 'admin') => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const useAppContext = () => useContext(AppContext);

const sampleBlogs: BlogPost[] = [
  {
    id: '1', title: 'Building Stronger Communities Through Digital Democracy',
    content: 'Our party continues to pioneer digital engagement platforms that bring citizens closer to governance. Through innovative technology solutions, we are creating transparent channels for public participation in policy-making. This initiative represents a fundamental shift in how political parties interact with their constituents, moving beyond traditional rally-based engagement to continuous digital dialogue.',
    author: 'Rajesh Kumar', authorAvatar: 'RK', image: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800',
    likes: 234, liked: false, comments: [
      { id: 'c1', author: 'Priya S.', text: 'This is exactly what we need for modern governance!', date: '2026-02-07' },
      { id: 'c2', author: 'Anil M.', text: 'Great initiative by the party leadership.', date: '2026-02-07' }
    ], date: '2026-02-08', category: 'Technology'
  },
  {
    id: '2', title: 'Rural Development: Progress Report Q1 2026',
    content: 'Significant progress has been made in rural infrastructure development across all districts. New roads, water supply systems, and digital connectivity projects are transforming village life. Our commitment to bridging the urban-rural divide continues with measurable outcomes in education, healthcare, and employment generation.',
    author: 'Sunita Devi', authorAvatar: 'SD', image: 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=800',
    likes: 189, liked: false, comments: [
      { id: 'c3', author: 'Venkat R.', text: 'The road development in our village has been remarkable.', date: '2026-02-06' }
    ], date: '2026-02-07', category: 'Development'
  },
  {
    id: '3', title: 'Youth Employment Initiative Launch',
    content: 'The party announces a comprehensive youth employment program targeting 500,000 new jobs across technology, agriculture, and manufacturing sectors. Skill development centers will be established in every constituency to prepare young people for the modern workforce.',
    author: 'Vikram Reddy', authorAvatar: 'VR', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=800',
    likes: 312, liked: false, comments: [], date: '2026-02-06', category: 'Employment'
  },
  {
    id: '4', title: 'Healthcare for All: Mobile Clinics Reach Remote Areas',
    content: 'Our mobile healthcare initiative has successfully reached over 200 remote villages, providing free medical checkups, vaccinations, and essential medicines. This program demonstrates our commitment to ensuring healthcare access for every citizen regardless of their location.',
    author: 'Dr. Lakshmi N.', authorAvatar: 'LN', image: 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800',
    likes: 278, liked: false, comments: [
      { id: 'c4', author: 'Ramesh K.', text: 'My mother received treatment through this program. Thank you!', date: '2026-02-05' }
    ], date: '2026-02-05', category: 'Healthcare'
  },
  {
    id: '5', title: 'Education Reform: Digital Classrooms in Government Schools',
    content: 'Over 5,000 government schools have been equipped with smart boards, high-speed internet, and digital learning tools. Teachers are being trained in modern pedagogical methods to deliver world-class education to students from all backgrounds.',
    author: 'Prof. Anand S.', authorAvatar: 'AS', image: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=800',
    likes: 195, liked: false, comments: [], date: '2026-02-04', category: 'Education'
  },
  {
    id: '6', title: 'Women Empowerment: Self-Help Groups Transforming Lives',
    content: 'The party-supported self-help group network has grown to over 100,000 groups across the state, empowering women through microfinance, skill training, and entrepreneurship opportunities. These groups are becoming the backbone of rural economic development.',
    author: 'Kavitha P.', authorAvatar: 'KP', image: 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=800',
    likes: 256, liked: false, comments: [], date: '2026-02-03', category: 'Empowerment'
  },
];

const samplePolls: Poll[] = [
  {
    id: 'p1', question: 'What should be the top priority for the next fiscal year?',
    options: [
      { id: 'o1', text: 'Education & Skill Development', votes: 1245 },
      { id: 'o2', text: 'Healthcare Infrastructure', votes: 987 },
      { id: 'o3', text: 'Road & Transport Development', votes: 756 },
      { id: 'o4', text: 'Digital Governance', votes: 534 },
    ],
    totalVotes: 3522, voted: false, deadline: '2026-02-28', category: 'Policy'
  },
  {
    id: 'p2', question: 'How should the party improve citizen engagement?',
    options: [
      { id: 'o5', text: 'Regular Town Halls', votes: 890 },
      { id: 'o6', text: 'Digital Platforms & Apps', votes: 1120 },
      { id: 'o7', text: 'Door-to-Door Campaigns', votes: 654 },
      { id: 'o8', text: 'Social Media Engagement', votes: 978 },
    ],
    totalVotes: 3642, voted: false, deadline: '2026-03-15', category: 'Engagement'
  },
  {
    id: 'p3', question: 'Which welfare scheme has been most impactful?',
    options: [
      { id: 'o9', text: 'Free Housing Scheme', votes: 2100 },
      { id: 'o10', text: 'Crop Insurance Program', votes: 1800 },
      { id: 'o11', text: 'Student Scholarship Fund', votes: 1500 },
      { id: 'o12', text: 'Senior Citizen Pension', votes: 1200 },
    ],
    totalVotes: 6600, voted: false, deadline: '2026-03-01', category: 'Welfare'
  },
  {
    id: 'p4', question: 'Best approach for environmental conservation?',
    options: [
      { id: 'o13', text: 'Tree Plantation Drives', votes: 780 },
      { id: 'o14', text: 'Solar Energy Subsidies', votes: 920 },
      { id: 'o15', text: 'Waste Management Systems', votes: 650 },
      { id: 'o16', text: 'Water Conservation Projects', votes: 870 },
    ],
    totalVotes: 3220, voted: false, deadline: '2026-03-10', category: 'Environment'
  },
];

const sampleWorks: WorkRequest[] = [
  { id: 'w1', title: 'Road Repair Needed on NH-65', description: 'Multiple potholes causing accidents near Vijayawada bypass. Urgent repair needed for public safety.', author: 'Suresh M.', authorId: 'u2', status: 'Open', category: 'Infrastructure', location: 'Vijayawada', date: '2026-02-07', priority: 'Urgent' },
  { id: 'w2', title: 'Street Light Installation Request', description: 'Dark stretches on main road in Sector 12 causing safety concerns for women and children.', author: 'Anitha R.', authorId: 'u3', status: 'In Progress', category: 'Utilities', location: 'Guntur', date: '2026-02-06', priority: 'High' },
  { id: 'w3', title: 'Community Hall Renovation', description: 'The community hall in Ward 8 needs renovation for public events and meetings.', author: 'Ravi K.', authorId: 'u4', status: 'Found', category: 'Community', location: 'Tirupati', date: '2026-02-05', priority: 'Medium' },
  { id: 'w4', title: 'Water Supply Issue in Colony', description: 'Irregular water supply in Lakshmi Nagar colony for the past 2 weeks.', author: 'Padma L.', authorId: 'u5', status: 'Open', category: 'Utilities', location: 'Kakinada', date: '2026-02-04', priority: 'High' },
  { id: 'w5', title: 'School Building Needs Repair', description: 'Government school building in village has damaged roof and walls. Children at risk during monsoon.', author: 'Teacher Rao', authorId: 'u6', status: 'Open', category: 'Education', location: 'Nellore', date: '2026-02-03', priority: 'Urgent' },
  { id: 'w6', title: 'Park Maintenance Required', description: 'Central park in the town needs cleaning, new benches, and playground equipment repair.', author: 'Lakshmi D.', authorId: 'u7', status: 'Completed', category: 'Community', location: 'Rajahmundry', date: '2026-02-01', priority: 'Low' },
];

const sampleChatRooms: ChatRoom[] = [
  {
    id: 'cr1', name: 'Community Chat', type: 'community', participants: ['all'],
    messages: [
      { id: 'm1', senderId: 'u2', senderName: 'Suresh M.', text: 'Great rally yesterday! The turnout was amazing.', timestamp: new Date('2026-02-08T08:00:00') },
      { id: 'm2', senderId: 'u3', senderName: 'Anitha R.', text: 'Yes! The youth participation was particularly impressive.', timestamp: new Date('2026-02-08T08:05:00') },
      { id: 'm3', senderId: 'u4', senderName: 'Ravi K.', text: 'When is the next district meeting scheduled?', timestamp: new Date('2026-02-08T08:10:00') },
    ],
    lastMessage: 'When is the next district meeting scheduled?', unread: 3
  },
  {
    id: 'cr2', name: 'Vijayawada District Group', type: 'group', participants: ['u1', 'u2', 'u3'],
    messages: [
      { id: 'm4', senderId: 'u2', senderName: 'Suresh M.', text: 'District committee meeting tomorrow at 10 AM.', timestamp: new Date('2026-02-08T07:00:00') },
    ],
    lastMessage: 'District committee meeting tomorrow at 10 AM.', unread: 1
  },
  {
    id: 'cr3', name: 'Youth Wing', type: 'group', participants: ['u1', 'u5', 'u6'],
    messages: [
      { id: 'm5', senderId: 'u5', senderName: 'Padma L.', text: 'Volunteer registration for the upcoming event is open!', timestamp: new Date('2026-02-07T18:00:00') },
    ],
    lastMessage: 'Volunteer registration for the upcoming event is open!', unread: 0
  },
  {
    id: 'cr4', name: 'Rajesh Kumar', type: 'private', participants: ['u1', 'u8'],
    messages: [
      { id: 'm6', senderId: 'u8', senderName: 'Rajesh Kumar', text: 'Can you share the report from last week?', timestamp: new Date('2026-02-07T15:00:00') },
    ],
    lastMessage: 'Can you share the report from last week?', unread: 1
  },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState('home');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [blogs, setBlogs] = useState<BlogPost[]>(sampleBlogs);
  const [polls, setPolls] = useState<Poll[]>(samplePolls);
  const [works, setWorks] = useState<WorkRequest[]>(sampleWorks);
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>(sampleChatRooms);
  const [activeChatRoom, setActiveChatRoom] = useState<string | null>(null);
  const [dmTargetUserId, setDmTargetUserId] = useState<string | null>(() => {
    const raw = localStorage.getItem('tdp_dm_target');
    return raw || null;
  });
  const [notifications, setNotifications] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginMode, setLoginMode] = useState<'user' | 'admin'>('user');

  useEffect(() => {
    const isAndroidWebView = (() => {
      try {
        const ua = navigator?.userAgent || '';
        return Boolean(window.Android) || /; wv\)/i.test(ua) || /Version\/[\d.]+.*Chrome\/[\d.]+/i.test(ua);
      } catch {
        return false;
      }
    })();

    if (!isAndroidWebView) return;

    window.setFcmToken = (token: string) => {
      try {
        const t = String(token || '').trim();
        if (!t) return;
        localStorage.setItem('tdp_fcm_token', t);
      } catch {
        // ignore
      }
    };

    window.handlePushOpen = (payload: any) => {
      try {
        const type = String(payload?.type || '').trim();
        const scope = String(payload?.scope || '').trim();

        let me = '';
        try {
          const raw = localStorage.getItem('tdp_user');
          if (raw) {
            const parsed = JSON.parse(raw);
            me = String(parsed?.id || parsed?._id || '').trim();
          }
        } catch {
          // ignore
        }

        if (type === 'message') {
          if (scope === 'private') {
            const fromUserId = String(payload?.fromUserId || '').trim();
            const toUserId = String(payload?.toUserId || '').trim();
            const otherId = fromUserId && fromUserId !== me ? fromUserId : toUserId;
            if (otherId) {
              setDmTargetUserId(otherId);
              setCurrentPage('messages');
            }
            return;
          }

          if (scope === 'group') {
            const groupId = String(payload?.groupId || '').trim();
            if (groupId) {
              localStorage.setItem('tdp_open_group_id', groupId);
              setCurrentPage('groups');
            }
            return;
          }

          if (scope === 'community') {
            setCurrentPage('community');
            return;
          }
        }

        if (type === 'call') {
          if (scope === 'private') {
            const fromUserId = String(payload?.fromUserId || '').trim();
            const isAdminCaller = String(payload?.fromRole || '').toLowerCase() === 'admin';
            const autoAnswer = isAdminCaller || Boolean(payload?.autoAnswer) || String(payload?.autoAnswer || '') === '1';
            if (fromUserId) {
              localStorage.setItem(
                'tdp_pending_incoming_call',
                JSON.stringify({
                  scope: 'private',
                  callId: String(payload?.callId || ''),
                  kind: String(payload?.kind || ''),
                  fromUserId,
                  autoAnswer,
                })
              );
              setCurrentPage('messages');
            }
            return;
          }

          if (scope === 'group') {
            const groupId = String(payload?.groupId || '').trim();
            if (groupId) {
              localStorage.setItem(
                'tdp_pending_incoming_call',
                JSON.stringify({
                  scope: 'group',
                  callId: String(payload?.callId || ''),
                  kind: String(payload?.kind || ''),
                  groupId,
                  fromUserId: String(payload?.fromUserId || ''),
                })
              );
              localStorage.setItem('tdp_open_group_id', groupId);
              setCurrentPage('groups');
            }
            return;
          }
        }
      } catch {
        // ignore
      }
    };
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications(0);
  }, []);

  // Real-time notifications (count only)
  useEffect(() => {
    if (!isAuthenticated) {
      disconnectSocket();
      setNotifications(0);
      return;
    }

    let s: any;
    try {
      s = connectSocket();
    } catch {
      return;
    }

    const bump = () => setNotifications((n) => n + 1);

    s.on('private:new', bump);
    s.on('group:new', bump);
    s.on('community:new', bump);

    return () => {
      s.off('private:new', bump);
      s.off('group:new', bump);
      s.off('community:new', bump);
    };
  }, [isAuthenticated]);

  // Clear when user navigates to chat-related pages
  useEffect(() => {
    if (currentPage === 'messages' || currentPage === 'community' || currentPage === 'groups') {
      setNotifications(0);
    }
  }, [currentPage]);

  useEffect(() => {
    if (!dmTargetUserId) {
      localStorage.removeItem('tdp_dm_target');
      return;
    }
    localStorage.setItem('tdp_dm_target', dmTargetUserId);
  }, [dmTargetUserId]);

  useEffect(() => {
    const stored = localStorage.getItem('tdp_user');
    const tokens = api.getStoredTokens();
    if (!stored || !tokens?.accessToken) return;

    try {
      const parsed = JSON.parse(stored);
      setUser(parsed);
      setIsAuthenticated(true);
    } catch {
      // ignore
    }

    api
      .authedRequest<{ ok: true; user: any }>('/api/users/me', 'GET')
      .then((me) => {
        const backendUser = me.user;
        const normalized: User = {
          id: backendUser._id || backendUser.id,
          membershipId: backendUser.membershipId,
          name: backendUser.name,
          email: backendUser.email,
          role: backendUser.role,
          avatar: (backendUser.name || 'U').slice(0, 2).toUpperCase(),
          phone: backendUser.phone,
          profilePicture: backendUser.profilePicture,
          district: backendUser.district,
          constituency: backendUser.constituency,
          address: backendUser.address,
          joinedDate: backendUser.createdAt,
        };
        setUser(normalized);
        localStorage.setItem('tdp_user', JSON.stringify(normalized));
      })
      .catch((e: any) => {
        // Only logout if tokens are actually invalid.
        if (e?.status === 401 || e?.status === 403) {
          api.setStoredTokens(null);
          localStorage.removeItem('tdp_user');
          setUser(null);
          setIsAuthenticated(false);
        }
      });
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;

    let stopped = false;

    const tick = async () => {
      try {
        // This will refresh tokens on 401 automatically via api.authedRequest.
        await api.authedRequest<{ ok: true; user: any }>('/api/users/me', 'GET');
      } catch (e: any) {
        if (stopped) return;
        if (e?.status === 401 || e?.status === 403) {
          api.setStoredTokens(null);
          localStorage.removeItem('tdp_user');
          setUser(null);
          setIsAuthenticated(false);
        }
      }
    };

    // Keep session alive by refreshing periodically (also rotates refresh tokens).
    const intervalMs = 10 * 60 * 1000;
    const t = setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [isAuthenticated]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, 'name' | 'phone' | 'profilePicture' | 'district' | 'constituency' | 'address'>>) => {
      const res = await api.authedRequest<{ ok: true; user: any }>('/api/users/me', 'PATCH', patch);
      const backendUser = res.user;
      const normalized: User = {
        id: backendUser._id || backendUser.id,
        membershipId: backendUser.membershipId,
        name: backendUser.name,
        email: backendUser.email,
        role: backendUser.role,
        avatar: (backendUser.name || 'U').slice(0, 2).toUpperCase(),
        phone: backendUser.phone,
        profilePicture: backendUser.profilePicture,
        district: backendUser.district,
        constituency: backendUser.constituency,
        address: backendUser.address,
        joinedDate: backendUser.createdAt,
      };
      setUser(normalized);
      localStorage.setItem('tdp_user', JSON.stringify(normalized));
    },
    []
  );

  const toggleSidebar = () => setSidebarOpen(prev => !prev);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.request<{
      ok: true;
      user: any;
      tokens: { accessToken: string; refreshToken: string };
    }>('/api/auth/login', 'POST', { email, password });

    api.setStoredTokens(res.tokens);
    const backendUser = res.user;
    const normalized: User = {
      id: backendUser.id || backendUser._id,
      membershipId: backendUser.membershipId,
      name: backendUser.name,
      email: backendUser.email,
      role: backendUser.role,
      avatar: (backendUser.name || 'U').slice(0, 2).toUpperCase(),
      phone: backendUser.phone,
      profilePicture: backendUser.profilePicture,
      district: backendUser.district,
      constituency: backendUser.constituency,
      address: backendUser.address,
      joinedDate: backendUser.createdAt,
    };

    setUser(normalized);
    setIsAuthenticated(true);
    localStorage.setItem('tdp_user', JSON.stringify(normalized));
    setShowLoginModal(false);

    try {
      const t = localStorage.getItem('tdp_fcm_token');
      if (t) await api.saveFcmToken({ userId: normalized.id, fcmToken: t });
    } catch {
      // ignore
    }
  }, []);

  const adminLogin = useCallback(async (email: string, password: string) => {
    const res = await api.request<{
      ok: true;
      admin: any;
      tokens: { accessToken: string; refreshToken: string };
    }>('/api/admin/auth/login', 'POST', { email, password });

    api.setStoredTokens(res.tokens);
    const backendUser = res.admin;
    const normalized: User = {
      id: backendUser.id || backendUser._id,
      membershipId: backendUser.membershipId,
      name: backendUser.name,
      email: backendUser.email,
      role: 'admin',
      avatar: (backendUser.name || 'A').slice(0, 2).toUpperCase(),
      phone: backendUser.phone,
      profilePicture: backendUser.profilePicture,
      district: backendUser.district,
      constituency: backendUser.constituency,
      address: backendUser.address,
      joinedDate: backendUser.createdAt,
    };

    setUser(normalized);
    setIsAuthenticated(true);
    localStorage.setItem('tdp_user', JSON.stringify(normalized));
    setShowLoginModal(false);

    try {
      const t = localStorage.getItem('tdp_fcm_token');
      if (t) await api.saveFcmToken({ userId: normalized.id, fcmToken: t });
    } catch {
      // ignore
    }
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setIsAuthenticated(false);
    localStorage.removeItem('tdp_user');
    localStorage.removeItem('tdp_token');
    api.setStoredTokens(null);
    disconnectSocket();
    setCurrentPage('home');
  }, []);

  const addBlog = useCallback((blog: Omit<BlogPost, 'id' | 'likes' | 'liked' | 'comments' | 'date'>) => {
    const newBlog: BlogPost = {
      ...blog, id: 'b' + Date.now(), likes: 0, liked: false, comments: [],
      date: new Date().toISOString().split('T')[0]
    };
    setBlogs(prev => [newBlog, ...prev]);
  }, []);

  const likeBlog = useCallback((id: string) => {
    setBlogs(prev => prev.map(b =>
      b.id === id ? { ...b, liked: !b.liked, likes: b.liked ? b.likes - 1 : b.likes + 1 } : b
    ));
  }, []);

  const addComment = useCallback((blogId: string, text: string) => {
    setBlogs(prev => prev.map(b =>
      b.id === blogId ? {
        ...b, comments: [...b.comments, {
          id: 'c' + Date.now(), author: user?.name || 'Anonymous', text, date: new Date().toISOString().split('T')[0]
        }]
      } : b
    ));
  }, [user]);

  const deleteBlog = useCallback((id: string) => {
    setBlogs(prev => prev.filter(b => b.id !== id));
  }, []);

  const votePoll = useCallback((pollId: string, optionId: string) => {
    setPolls(prev => prev.map(p =>
      p.id === pollId && !p.voted ? {
        ...p, voted: true, votedOption: optionId, totalVotes: p.totalVotes + 1,
        options: p.options.map(o => o.id === optionId ? { ...o, votes: o.votes + 1 } : o)
      } : p
    ));
  }, []);

  const addWork = useCallback((work: Omit<WorkRequest, 'id' | 'date' | 'authorId'>) => {
    const newWork: WorkRequest = {
      ...work, id: 'w' + Date.now(), date: new Date().toISOString().split('T')[0],
      authorId: user?.id || 'unknown'
    };
    setWorks(prev => [newWork, ...prev]);
  }, [user]);

  const updateWorkStatus = useCallback((id: string, status: WorkRequest['status']) => {
    setWorks(prev => prev.map(w => w.id === id ? { ...w, status } : w));
  }, []);

  const deleteWork = useCallback((id: string) => {
    setWorks(prev => prev.filter(w => w.id !== id));
  }, []);

  const sendMessage = useCallback((roomId: string, text: string) => {
    const newMsg: Message = {
      id: 'm' + Date.now(), senderId: user?.id || 'u1',
      senderName: user?.name || 'You', text, timestamp: new Date()
    };
    setChatRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, messages: [...r.messages, newMsg], lastMessage: text, unread: 0 } : r
    ));
  }, [user]);

  return (
    <AppContext.Provider value={{
      sidebarOpen, toggleSidebar, currentPage, setCurrentPage,
      user, isAuthenticated, login, adminLogin, logout, updateProfile,
      blogs, addBlog, likeBlog, addComment, deleteBlog,
      polls, votePoll, works, addWork, updateWorkStatus, deleteWork,
      chatRooms, activeChatRoom, setActiveChatRoom, sendMessage,
      dmTargetUserId, setDmTargetUserId,
      notifications, clearNotifications, showLoginModal, setShowLoginModal, loginMode, setLoginMode
    }}>
      {children}
    </AppContext.Provider>
  );
};
