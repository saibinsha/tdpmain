import React, { useState } from 'react';
import AIInsightBanner from './AIInsightBanner';
import { MapPin, Phone, Mail, Clock, Send, CheckCircle, Globe, Building } from 'lucide-react';

import { api } from '@/lib/api';

const ContactPage: React.FC = () => {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', subject: '', message: '', category: 'General' });
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    if (!formData.message.trim()) errs.message = 'Message is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');
    try {
      await api.request('/api/contact', 'POST', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
        category: formData.category,
      });
      setSubmitted(true);
      setFormData({ name: '', email: '', phone: '', subject: '', message: '', category: 'General' });
      setTimeout(() => setSubmitted(false), 2500);
    } catch (e: any) {
      setError(e?.message || 'Failed to submit. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const offices = [
    { name: 'State Headquarters', address: 'NTR Bhavan, Road No. 2, Banjara Hills, Hyderabad - 500034', phone: '+91 40 2354 6789', email: 'hq@tdpparty.org', hours: 'Mon-Sat: 9AM - 6PM' },
    { name: 'Vijayawada Office', address: 'Bandar Road, Vijayawada - 520002', phone: '+91 866 257 1234', email: 'vjw@tdpparty.org', hours: 'Mon-Sat: 9AM - 5PM' },
    { name: 'Visakhapatnam Office', address: 'Beach Road, Visakhapatnam - 530001', phone: '+91 891 254 5678', email: 'vizag@tdpparty.org', hours: 'Mon-Fri: 10AM - 5PM' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">Contact Us</h1>
        <p className="text-gray-500 mt-1">Reach out to us for any queries, suggestions, or support</p>
      </div>

      <AIInsightBanner text="Open communication channels strengthen trust between people and leadership. Every message is valued and contributes to responsive governance." />

      <div className="grid lg:grid-cols-3 gap-8 mt-8">
        {/* Contact Form */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Send us a Message</h2>
            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
            {submitted ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Message Sent Successfully!</h3>
                <p className="text-sm text-gray-500">We'll get back to you within 24-48 hours.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                    <input type="text" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className={`w-full px-4 py-3 border rounded-xl text-sm focus:border-blue-500 outline-none ${errors.name ? 'border-red-300' : 'border-gray-200'}`} placeholder="Your name" />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                    <input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className={`w-full px-4 py-3 border rounded-xl text-sm focus:border-blue-500 outline-none ${errors.email ? 'border-red-300' : 'border-gray-200'}`} placeholder="you@example.com" />
                    {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input type="tel" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none" placeholder="+91 XXXXX XXXXX" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm bg-white focus:border-blue-500 outline-none">
                      {['General', 'Membership', 'Complaint', 'Suggestion', 'Media', 'Partnership'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject</label>
                  <input type="text" value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none" placeholder="Subject of your message" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
                  <textarea value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} rows={5} className={`w-full px-4 py-3 border rounded-xl text-sm focus:border-blue-500 outline-none resize-none ${errors.message ? 'border-red-300' : 'border-gray-200'}`} placeholder="Write your message..." />
                  {errors.message && <p className="text-xs text-red-500 mt-1">{errors.message}</p>}
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md disabled:opacity-50"
                >
                  <Send className="w-4 h-4" /> {loading ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {offices.map((office, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Building className="w-5 h-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm">{office.name}</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2 text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>{office.address}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{office.phone}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{office.email}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{office.hours}</span>
                </div>
              </div>
            </div>
          ))}

          <div className="bg-gradient-to-br from-yellow-400 to-yellow-500 rounded-xl p-5 text-center">
            <h3 className="font-bold text-blue-900 mb-2">Emergency Helpline</h3>
            <p className="text-3xl font-black text-blue-900">1800-XXX-XXXX</p>
            <p className="text-xs text-blue-800/70 mt-1">Available 24/7 - Toll Free</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
