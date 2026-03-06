import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import { ClipboardList, CheckCircle, Clock, ArrowRight, Send, ChevronDown, ChevronUp } from 'lucide-react';

import { api } from '@/lib/api';

type BackendSurvey = {
  _id: string;
  title: string;
  description: string;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt?: string;
};

type BackendSurveyQuestion = {
  _id: string;
  survey: string;
  type: 'text' | 'mcq';
  prompt: string;
  options: string[];
  order: number;
};

const SurveysPage: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useAppContext();
  const [surveys, setSurveys] = useState<BackendSurvey[]>([]);
  const [questionsBySurveyId, setQuestionsBySurveyId] = useState<Record<string, BackendSurveyQuestion[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [activeSurveyId, setActiveSurveyId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .request<{ ok: true; items: BackendSurvey[] }>('/api/surveys', 'GET')
      .then((res) => {
        if (!alive) return;
        setSurveys(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load surveys');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const totalQuestions = useMemo(() => {
    return surveys.reduce((sum, s) => sum + (questionsBySurveyId[s._id]?.length || 0), 0);
  }, [surveys, questionsBySurveyId]);

  const handleAnswer = (questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const ensureQuestions = async (surveyId: string) => {
    if (questionsBySurveyId[surveyId]) return;
    const res = await api.request<{ ok: true; survey: BackendSurvey; questions: BackendSurveyQuestion[] }>(`/api/surveys/${surveyId}`, 'GET');
    setQuestionsBySurveyId((prev) => ({ ...prev, [surveyId]: res.questions || [] }));
  };

  const handleSubmit = async (surveyId: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const questions = questionsBySurveyId[surveyId] || [];
    if (questions.length === 0) return;

    const payloadAnswers = questions.map((q) => ({
      question: q._id,
      value: answers[q._id] || '',
    }));

    setError('');
    setLoading(true);
    try {
      await api.authedRequest(`/api/surveys/${surveyId}/responses`, 'POST', { answers: payloadAnswers });
      setSubmitted((prev) => ({ ...prev, [surveyId]: true }));
      setActiveSurveyId(null);
    } catch (e: any) {
      setError(e?.message || 'Failed to submit survey');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Surveys</h1>
        <p className="text-gray-500 mt-1">Share your feedback to help improve governance and services</p>
      </div>

      <AIInsightBanner text="Surveys collect structured feedback to improve policy and governance. Your responses directly influence decision-making and resource allocation priorities." />

      {/* Survey Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center">
          <p className="text-2xl font-black text-blue-600">{surveys.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Surveys</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center">
          <p className="text-2xl font-black text-green-600">{totalQuestions.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Total Questions</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm text-center">
          <p className="text-2xl font-black text-yellow-600">{surveys.filter(s => s.isActive).length}</p>
          <p className="text-xs text-gray-500 mt-1">Active Surveys</p>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500 mb-4">Loading...</p>}
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Survey List */}
      <div className="space-y-4">
        {surveys.map(survey => (
          <div key={survey._id} className={`bg-white rounded-xl border overflow-hidden transition-all ${
            submitted[survey._id] || !survey.isActive ? 'border-green-200' : 'border-gray-100 hover:shadow-md'
          }`}>
            <div className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      submitted[survey._id] || !survey.isActive
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {submitted[survey._id] || !survey.isActive ? 'Completed' : 'Active'}
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {String(survey.createdAt || '').slice(0, 10) || '—'}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">{survey.title}</h3>
                  <p className="text-sm text-gray-500">{survey.description}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <span className="text-xs text-gray-400">{(questionsBySurveyId[survey._id]?.length || 0) || '—'} questions</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    const next = activeSurveyId === survey._id ? null : survey._id;
                    setActiveSurveyId(next);
                    if (next) void ensureQuestions(next);
                  }}
                  disabled={submitted[survey._id] || !survey.isActive}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    submitted[survey._id] || !survey.isActive
                      ? 'bg-green-50 text-green-600 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                  }`}
                >
                  {submitted[survey._id] || !survey.isActive ? (
                    <><CheckCircle className="w-4 h-4" /> Done</>
                  ) : activeSurveyId === survey._id ? (
                    <><ChevronUp className="w-4 h-4" /> Close</>
                  ) : (
                    <><ArrowRight className="w-4 h-4" /> Take Survey</>
                  )}
                </button>
              </div>
            </div>

            {/* Survey Questions */}
            {activeSurveyId === survey._id && !submitted[survey._id] && survey.isActive && (
              <div className="border-t border-gray-100 p-6 bg-gray-50">
                <div className="space-y-6">
                  {(questionsBySurveyId[survey._id] || []).map((q, qi) => (
                    <div key={q._id} className="bg-white rounded-xl p-5 border border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 mb-3">
                        <span className="text-blue-600 mr-2">Q{qi + 1}.</span>
                        {q.prompt}
                      </p>

                      {q.type === 'mcq' && q.options && (
                        <div className="space-y-2">
                          {q.options.map(opt => (
                            <button
                              key={opt}
                              onClick={() => handleAnswer(q._id, opt)}
                              className={`w-full text-left px-4 py-2.5 rounded-lg border-2 text-sm transition-all ${
                                answers[q._id] === opt
                                  ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                                  : 'border-gray-200 hover:border-blue-200 text-gray-600'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  answers[q._id] === opt ? 'border-blue-500' : 'border-gray-300'
                                }`}>
                                  {answers[q._id] === opt && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                                </div>
                                {opt}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}

                      {q.type === 'text' && (
                        <textarea
                          value={answers[q._id] || ''}
                          onChange={e => handleAnswer(q._id, e.target.value)}
                          placeholder="Type your answer..."
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => void handleSubmit(survey._id)}
                  className="mt-6 flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  <Send className="w-4 h-4" /> Submit Survey
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SurveysPage;
