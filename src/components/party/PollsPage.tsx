import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import { BarChart3, Clock, CheckCircle, Users } from 'lucide-react';

import { api } from '@/lib/api';

type BackendPoll = {
  _id: string;
  question: string;
  options: Array<{ _id: string; text: string }>;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt?: string;
};

const PollsPage: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useAppContext();
  const [polls, setPolls] = useState<BackendPoll[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [votedPollIds, setVotedPollIds] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .request<{ ok: true; items: BackendPoll[] }>('/api/polls', 'GET')
      .then((res) => {
        if (!alive) return;
        setPolls(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load polls');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const activePolls = useMemo(() => polls.filter((p) => p.isActive), [polls]);

  const getPercentage = (votes: number, total: number) => {
    if (total === 0) return 0;
    return Math.round((votes / total) * 100);
  };

  const handleVote = async (pollId: string, optionId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    if (votedPollIds[pollId]) return;

    setError('');
    try {
      await api.authedRequest(`/api/polls/${pollId}/vote`, 'POST', { optionId });
      setVotedPollIds((prev) => ({ ...prev, [pollId]: optionId }));
    } catch (e: any) {
      setError(e?.message || 'Failed to vote');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Polls & Voting</h1>
        <p className="text-gray-500 mt-1">Your voice matters - participate in democratic decision-making</p>
      </div>

      <AIInsightBanner text="Poll participation enables data-driven decisions and democratic feedback. Every vote contributes to shaping party policies and priorities for the people." />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Polls', value: activePolls.length, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
          { label: 'Total Polls', value: polls.length, icon: Users, color: 'bg-green-50 text-green-600' },
          { label: 'Voted (this session)', value: Object.keys(votedPollIds).length, icon: CheckCircle, color: 'bg-yellow-50 text-yellow-600' },
          { label: 'Closing Soon', value: '—', icon: Clock, color: 'bg-red-50 text-red-600' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-lg ${stat.color} flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-xl font-black text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {loading && <p className="text-sm text-gray-500 mb-4">Loading...</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Polls */}
      <div className="grid md:grid-cols-2 gap-6">
        {polls.map((poll) => {
          const votedOptionId = votedPollIds[poll._id];
          const voted = Boolean(votedOptionId);
          return (
          <div key={poll._id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${
            voted ? 'border-green-200' : 'border-gray-100 hover:shadow-md'
          }`}>
            <div className={`h-1.5 ${voted ? 'bg-gradient-to-r from-green-400 to-green-500' : 'bg-gradient-to-r from-blue-400 to-blue-600'}`} />
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    voted ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {voted ? 'Voted' : (poll.isActive ? 'Active' : 'Closed')}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {String(poll.createdAt || '').slice(0, 10) || '—'}
                </div>
              </div>

              <h3 className="text-lg font-bold text-gray-900 mb-5">{poll.question}</h3>

              <div className="space-y-3">
                {poll.options.map((option) => {
                  const pct = getPercentage(votedOptionId === option._id ? 1 : 0, voted ? 1 : 0);
                  const isSelected = votedOptionId === option._id;
                  return (
                    <button
                      key={option._id}
                      onClick={() => {
                        if (!poll.isActive) return;
                        void handleVote(poll._id, option._id);
                      }}
                      disabled={voted || !poll.isActive}
                      className={`w-full text-left relative overflow-hidden rounded-xl border-2 transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50'
                          : voted
                            ? 'border-gray-100 bg-gray-50 cursor-default'
                            : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'
                      }`}
                    >
                      {voted && (
                        <div
                          className={`absolute inset-y-0 left-0 transition-all duration-700 ${
                            isSelected ? 'bg-blue-100' : 'bg-gray-100'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      )}
                      <div className="relative flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                          }`}>
                            {isSelected && (
                              <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-800">{option.text}</span>
                        </div>
                        {voted && (
                          <span className="text-sm font-bold text-gray-700">{pct}%</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  <Users className="w-3 h-3 inline mr-1" />
                  —
                </p>
                {voted && (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                    <CheckCircle className="w-3 h-3" /> Your vote is recorded
                  </span>
                )}
              </div>
            </div>
          </div>
        );
        })}
      </div>
    </div>
  );
};

export default PollsPage;
