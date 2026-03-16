import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import {
  Plus, X, MapPin, Clock, Trash2, ChevronDown, Search, Filter,
  AlertTriangle, CheckCircle, Loader2, Circle, Briefcase
} from 'lucide-react';

import { api } from '@/lib/api';

type BackendWork = {
  _id: string;
  title: string;
  description: string;
  category?: string;
  location?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Open' | 'In Progress' | 'Found' | 'Completed';
  createdAt?: string;
  user?: { _id: string; name: string; membershipId?: string; profilePicture?: string };
};

const WorksPage: React.FC = () => {
  const { user, isAuthenticated, setShowLoginModal } = useAppContext();
  const [showCreate, setShowCreate] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [newWork, setNewWork] = useState({ title: '', description: '', category: 'Infrastructure', location: '', author: '', priority: 'Medium' as const, status: 'Open' as const });

  const [works, setWorks] = useState<BackendWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const categories = ['All', 'Infrastructure', 'Utilities', 'Community', 'Education', 'Healthcare'];
  const statuses = ['All', 'Open', 'In Progress', 'Found', 'Completed'];

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .request<{ ok: true; items: BackendWork[] }>('/api/works?limit=100', 'GET')
      .then((res) => {
        if (!alive) return;
        setWorks(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load works');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filteredWorks = useMemo(() => {
    return works.filter((w) => {
      const t = String(w.title || '').toLowerCase();
      const loc = String(w.location || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchSearch = t.includes(q) || loc.includes(q);
      const matchStatus = filterStatus === 'All' || w.status === (filterStatus as any);
      const matchCategory = filterCategory === 'All' || String(w.category || '') === filterCategory;
      return matchSearch && matchStatus && matchCategory;
    });
  }, [works, searchQuery, filterStatus, filterCategory]);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Open': return { color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Circle, dotColor: 'bg-blue-500' };
      case 'In Progress': return { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Loader2, dotColor: 'bg-yellow-500' };
      case 'Found': return { color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle, dotColor: 'bg-green-500' };
      case 'Completed': return { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: CheckCircle, dotColor: 'bg-gray-500' };
      default: return { color: 'bg-gray-100 text-gray-600 border-gray-200', icon: Circle, dotColor: 'bg-gray-500' };
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-700';
      case 'High': return 'bg-orange-100 text-orange-700';
      case 'Medium': return 'bg-yellow-100 text-yellow-700';
      case 'Low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const handleCreate = async () => {
    if (!newWork.title.trim() || !newWork.description.trim() || !newWork.location.trim()) return;
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; work: BackendWork }>('/api/works', 'POST', {
        title: newWork.title.trim(),
        description: newWork.description.trim(),
        category: newWork.category,
        location: newWork.location.trim(),
        priority: newWork.priority,
      });
      setWorks((prev) => [res.work, ...prev]);
      setNewWork({ title: '', description: '', category: 'Infrastructure', location: '', author: '', priority: 'Medium', status: 'Open' });
      setShowCreate(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to create work');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: BackendWork['status']) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; work: BackendWork }>(`/api/works/${id}`, 'PATCH', { status });
      setWorks((prev) => prev.map((w) => (String(w._id) === String(id) ? res.work : w)));
    } catch (e: any) {
      setError(e?.message || 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await api.authedRequest(`/api/works/${id}`, 'DELETE');
      setWorks((prev) => prev.filter((w) => String(w._id) !== String(id)));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete work');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Public Works</h1>
          <p className="text-gray-500 mt-1">Submit and track public work requests for your community</p>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md"
          >
            <Plus className="w-4 h-4" /> Post Work Request
          </button>
        )}
      </div>

      <AIInsightBanner text="Tracking public work requests improves accountability and service delivery. Transparent reporting ensures every community need is addressed systematically." />

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      {/* Create Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">New Work Request</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              value={newWork.title}
              onChange={e => setNewWork(p => ({ ...p, title: e.target.value }))}
              placeholder="Work title..."
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
            />
            <input
              type="text"
              value={newWork.location}
              onChange={e => setNewWork(p => ({ ...p, location: e.target.value }))}
              placeholder="Location..."
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
            />
            <select
              value={newWork.category}
              onChange={e => setNewWork(p => ({ ...p, category: e.target.value }))}
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"
            >
              {categories.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={newWork.priority}
              onChange={e => setNewWork(p => ({ ...p, priority: e.target.value as any }))}
              className="px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none bg-white"
            >
              {['Low', 'Medium', 'High', 'Urgent'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <textarea
            value={newWork.description}
            onChange={e => setNewWork(p => ({ ...p, description: e.target.value }))}
            placeholder="Describe the work needed..."
            rows={3}
            className="w-full mt-4 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none resize-none"
          />
          <button
            onClick={handleCreate}
            disabled={loading || !newWork.title.trim() || !newWork.description.trim() || !newWork.location.trim()}
            className="mt-4 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Submit Request
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search works..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                filterStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Works List */}
      <div className="space-y-4">
        {filteredWorks.map(work => {
          const statusConfig = getStatusConfig(work.status);
          const StatusIcon = statusConfig.icon;
          const isOwner = String(work.user?._id || '') === String(user?.id);
          const isAdmin = user?.role === 'admin';

          return (
            <div key={work._id} className={`bg-white rounded-xl border overflow-hidden transition-all hover:shadow-md ${
              work.status === 'Found' || work.status === 'Completed' ? 'border-green-200 bg-green-50/30' : 'border-gray-100'
            }`}>
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusConfig.color}`}>
                        <StatusIcon className="w-3 h-3" /> {work.status}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${getPriorityConfig(work.priority)}`}>
                        {work.priority}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                        {work.category}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{work.title}</h3>
                    <p className="text-sm text-gray-600 mb-3">{work.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {work.location}</span>
                      <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {String(work.createdAt || '').slice(0, 10)}</span>
                      <span>By: {work.user?.name || 'Member'}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    {(isAdmin || isOwner) && work.status === 'Open' && (
                      <button
                        onClick={() => void handleUpdateStatus(work._id, 'Found')}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
                      >
                        Mark Found
                      </button>
                    )}
                    {(isAdmin || isOwner) && (
                      <select
                        value={work.status}
                        onChange={e => void handleUpdateStatus(work._id, e.target.value as any)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs bg-white"
                      >
                        <option value="Open">Open</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Found">Found</option>
                        <option value="Completed">Completed</option>
                      </select>
                    )}
                    {(isOwner || isAdmin) && (
                      <button
                        onClick={() => void handleDelete(work._id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredWorks.length === 0 && (
        <div className="text-center py-16">
          <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No work requests found</p>
        </div>
      )}
    </div>
  );
};

export default WorksPage;
