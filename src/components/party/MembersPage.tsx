import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import { Search, MessageCircle, MapPin, Phone, Mail, X, Users, Filter, ChevronDown, Shield } from 'lucide-react';

import { api } from '@/lib/api';

type DirectoryUser = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role?: string;
  status?: string;
  district?: string;
  constituency?: string;
  membershipId?: string;
  profilePicture?: string;
  createdAt?: string;
};

function initials(name: string) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  const a = (parts[0] || 'U')[0];
  const b = (parts[1] || parts[0] || 'U')[0];
  return (a + b).toUpperCase();
}

const MembersPage: React.FC = () => {
  const { setCurrentPage, isAuthenticated, setShowLoginModal, setDmTargetUserId } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('All');
  const [selectedMember, setSelectedMember] = useState<DirectoryUser | null>(null);

  const [items, setItems] = useState<DirectoryUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) return;
    let alive = true;
    setLoading(true);
    setError('');

    api
      .authedRequest<{ ok: true; items: DirectoryUser[] }>('/api/users/directory?limit=100', 'GET')
      .then((res) => {
        if (!alive) return;
        setItems(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load members');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [isAuthenticated]);

  const districts = useMemo(() => {
    const ds = items.map((m) => m.district).filter(Boolean) as string[];
    return ['All', ...Array.from(new Set(ds))];
  }, [items]);

  const filteredMembers = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return items.filter((m) => {
      const name = String(m.name || '').toLowerCase();
      const role = String(m.role || '').toLowerCase();
      const district = String(m.district || '').toLowerCase();
      const constituency = String(m.constituency || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || role.includes(q) || district.includes(q) || constituency.includes(q);
      const matchDistrict = filterDistrict === 'All' || String(m.district || '') === filterDistrict;
      return matchSearch && matchDistrict;
    });
  }, [items, searchQuery, filterDistrict]);

  const handleChat = (memberId: string) => {
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    setDmTargetUserId(memberId);
    setCurrentPage('messages');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Members Directory</h1>
        <p className="text-gray-500 mt-1">Connect with party members across all districts</p>
      </div>

      <AIInsightBanner text="Member networks strengthen grassroots leadership and collaboration. Building connections across districts creates a unified force for positive change." />

      {!isAuthenticated ? (
        <div className="text-center py-20 bg-white rounded-xl border border-gray-100">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 mb-2">Sign in to view members</h3>
          <p className="text-sm text-gray-500 mb-6">Login is required to see members and start chats</p>
          <button onClick={() => setShowLoginModal(true)} className="px-6 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
            Sign In
          </button>
        </div>
      ) : (
        <>

      {/* Search & Filter */}
      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search members by name, role, or district..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </div>
        <select
          value={filterDistrict}
          onChange={e => setFilterDistrict(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"
        >
          {districts.map(d => (
            <option key={d} value={d}>{d === 'All' ? 'All Districts' : d}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-500 mb-4">Loading...</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
      <p className="text-sm text-gray-500 mb-4">{filteredMembers.length} members found</p>

      {/* Members Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredMembers.map(member => (
          <div key={member._id} className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-all group">
            <div className="flex items-start gap-4">
              {member.profilePicture ? (
                <div className="w-14 h-14 rounded-xl overflow-hidden shadow-md border border-gray-100 bg-white flex-shrink-0">
                  <img
                    src={member.profilePicture}
                    alt={member.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-md flex-shrink-0 ${
                  member.status === 'active'
                    ? 'bg-gradient-to-br from-blue-500 to-blue-700'
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}>
                  {initials(member.name)}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-gray-900 truncate">{member.name}</h3>
                <p className="text-xs text-blue-600 font-medium">{member.role || 'Member'}</p>
                {(member.district || member.constituency) && (
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" /> {member.district || '—'}{member.constituency ? ` - ${member.constituency}` : ''}
                  </p>
                )}
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                member.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {member.status || 'active'}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                onClick={() => setSelectedMember(member)}
                className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200 transition-colors"
              >
                View Profile
              </button>
              <button
                onClick={() => handleChat(member._id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
              >
                <MessageCircle className="w-3.5 h-3.5" /> Chat
              </button>
            </div>
          </div>
        ))}
      </div>

      </>
      )}

      {/* Member Profile Modal */}
      {selectedMember && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedMember(null)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-blue-800 relative overflow-hidden rounded-t-2xl z-0">
              <button onClick={() => setSelectedMember(null)} className="absolute top-3 right-3 p-1.5 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>
            <div className="px-6 pb-6">
              <div className="relative -mt-10 mb-4 z-10">
                {selectedMember.profilePicture ? (
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-lg bg-white">
                    <img
                      src={selectedMember.profilePicture}
                      alt={selectedMember.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-2xl font-bold border-4 border-white shadow-lg">
                    {initials(selectedMember.name)}
                  </div>
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">{selectedMember.name}</h2>
              <p className="text-sm text-blue-600 font-medium">{selectedMember.role || 'Member'}</p>

              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{selectedMember.district || '—'}{selectedMember.constituency ? ` - ${selectedMember.constituency}` : ''}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{selectedMember.phone || '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">{selectedMember.email || '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">Member since {selectedMember.createdAt ? new Date(selectedMember.createdAt).toISOString().slice(0, 10) : '—'}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-5">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-blue-600">{selectedMember.membershipId || '—'}</p>
                  <p className="text-xs text-gray-500">Membership ID</p>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-black text-green-600">{selectedMember.status || 'active'}</p>
                  <p className="text-xs text-gray-500">Status</p>
                </div>
              </div>

              <button
                onClick={() => { handleChat(selectedMember._id); setSelectedMember(null); }}
                className="w-full mt-5 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md"
              >
                <MessageCircle className="w-4 h-4" /> Send Message
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembersPage;
