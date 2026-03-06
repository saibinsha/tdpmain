import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import { Flag, AlertTriangle, Send, CheckCircle, Shield, FileText, Upload } from 'lucide-react';

import { api } from '@/lib/api';

const ReportPage: React.FC = () => {
  const { isAuthenticated, setShowLoginModal } = useAppContext();
  const [reportData, setReportData] = useState({ type: 'Spam', description: '', evidence: '', targetUser: '', page: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const reportTypes = [
    { value: 'Spam', label: 'Spam or Unwanted Content', icon: AlertTriangle, color: 'text-yellow-600 bg-yellow-50' },
    { value: 'Harassment', label: 'Harassment or Bullying', icon: Shield, color: 'text-red-600 bg-red-50' },
    { value: 'Misinformation', label: 'False Information', icon: FileText, color: 'text-orange-600 bg-orange-50' },
    { value: 'Impersonation', label: 'Impersonation', icon: Flag, color: 'text-purple-600 bg-purple-50' },
    { value: 'Inappropriate', label: 'Inappropriate Content', icon: AlertTriangle, color: 'text-red-600 bg-red-50' },
    { value: 'Other', label: 'Other Issue', icon: Flag, color: 'text-gray-600 bg-gray-50' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { setShowLoginModal(true); return; }
    if (!reportData.description.trim()) return;

    setSubmitting(true);
    try {
      const reason = [
        `Type: ${reportData.type}`,
        reportData.page ? `Page: ${reportData.page}` : '',
        reportData.targetUser ? `Target User: ${reportData.targetUser}` : '',
        reportData.evidence ? `Evidence: ${reportData.evidence}` : '',
        `Description: ${reportData.description}`,
      ]
        .filter(Boolean)
        .join('\n');

      await api.authedRequest('/api/reports', 'POST', {
        targetType: 'other',
        reason,
      });

      setSubmitted(true);
      setTimeout(() => {
        setReportData({ type: 'Spam', description: '', evidence: '', targetUser: '', page: '' });
        setSubmitted(false);
      }, 4000);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Report an Issue</h1>
        <p className="text-gray-500 mt-1">Help us maintain platform integrity and ethical participation</p>
      </div>

      <AIInsightBanner text="Reporting ensures platform integrity and ethical participation. Your reports help maintain a safe, trustworthy environment for all members." />

      {submitted ? (
        <div className="bg-white rounded-xl border border-green-200 p-12 text-center mt-8">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Report Submitted</h2>
          <p className="text-gray-500 max-w-md mx-auto">Thank you for helping us maintain a safe platform. Our moderation team will review your report within 24 hours.</p>
          <p className="text-sm text-gray-400 mt-4">Report ID: #RPT-{Date.now().toString().slice(-6)}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm mt-8">
          <h2 className="text-lg font-bold text-gray-900 mb-6">Submit a Report</h2>

          {/* Report Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">Report Type</label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {reportTypes.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.value}
                    onClick={() => setReportData(p => ({ ...p, type: type.value }))}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      reportData.type === type.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target User (optional)</label>
                <input type="text" value={reportData.targetUser} onChange={e => setReportData(p => ({ ...p, targetUser: e.target.value }))} placeholder="Username of the person" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Page/Section (optional)</label>
                <input type="text" value={reportData.page} onChange={e => setReportData(p => ({ ...p, page: e.target.value }))} placeholder="Where did this happen?" className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
              <textarea value={reportData.description} onChange={e => setReportData(p => ({ ...p, description: e.target.value }))} rows={5} placeholder="Describe the issue in detail..." className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Evidence URL (optional)</label>
              <div className="flex gap-2">
                <input type="text" value={reportData.evidence} onChange={e => setReportData(p => ({ ...p, evidence: e.target.value }))} placeholder="Link to screenshot or evidence" className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none" />
                <button type="button" className="px-4 py-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                  <Upload className="w-4 h-4 text-gray-600" />
                </button>
              </div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-xs text-yellow-800">
                <AlertTriangle className="w-4 h-4 inline mr-1" />
                False reports may result in account restrictions. Please ensure your report is accurate and made in good faith.
              </p>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-8 py-3 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors shadow-md disabled:opacity-60"
            >
              <Send className="w-4 h-4" /> Submit Report
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default ReportPage;
