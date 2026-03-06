import React, { useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { MapPin, Phone, Mail, ExternalLink, KeyRound } from 'lucide-react';

import { api } from '@/lib/api';

const FacebookIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
);
const TwitterIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
);
const YoutubeIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
);
const InstagramIcon = () => (
  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
);

const Footer: React.FC = () => {
  const { setCurrentPage, setLoginMode, setShowLoginModal } = useAppContext();

  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterStatus, setNewsletterStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [newsletterMsg, setNewsletterMsg] = useState('');

  const handleNewsletterJoin = async () => {
    const email = newsletterEmail.trim();
    if (!email) return;
    setNewsletterStatus('loading');
    setNewsletterMsg('');
    try {
      const res = await api.request<{ ok: true; alreadySubscribed: boolean }>('/api/newsletter', 'POST', {
        email,
        source: 'footer',
      });
      setNewsletterStatus('success');
      setNewsletterMsg(res.alreadySubscribed ? 'Already subscribed' : 'Subscribed successfully');
      setNewsletterEmail('');
    } catch (e: any) {
      setNewsletterStatus('error');
      setNewsletterMsg(e?.message || 'Failed to subscribe');
    }
  };

  const socialIcons = [FacebookIcon, TwitterIcon, YoutubeIcon, InstagramIcon];

  const handleSecretAdmin = () => {
    const code = window.prompt('Enter code');
    if (code !== '6677') return;
    setLoginMode('admin');
    setShowLoginModal(true);
  };

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-yellow-400 to-yellow-500 flex items-center justify-center shadow-lg">
                <span className="text-blue-900 font-black text-xl">T</span>
              </div>
              <div>
                <h3 className="text-white font-bold text-lg">TDP Party</h3>
                <p className="text-xs text-gray-500 tracking-wider uppercase">People's Platform</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed mb-5">
              Empowering citizens through digital democracy, transparent governance, and inclusive development for a prosperous future.
            </p>
            <div className="flex gap-3">
              {socialIcons.map((Icon, i) => (
                <button key={i} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-blue-600 flex items-center justify-center transition-colors">
                  <Icon />
                </button>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">Quick Links</h4>
            <ul className="space-y-3">
              {[
                { id: 'home', label: 'Home' },
                { id: 'blogs', label: 'Blogs & News' },
                { id: 'polls', label: 'Polls & Voting' },
                { id: 'surveys', label: 'Surveys' },
                { id: 'members', label: 'Members Directory' },
                { id: 'works', label: 'Public Works' },
                { id: 'community', label: 'Community Forum' },
              ].map(link => (
                <li key={link.id}>
                  <button
                    onClick={() => { setCurrentPage(link.id); window.scrollTo(0, 0); }}
                    className="text-sm text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-2"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Party Info */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">Party Information</h4>
            <ul className="space-y-3">
              {['About the Party', 'Leadership', 'Manifesto', 'History', 'Constitution', 'Press Releases', 'Careers'].map(item => (
                <li key={item}>
                  <button className="text-sm text-gray-400 hover:text-yellow-400 transition-colors flex items-center gap-2">
                    <ExternalLink className="w-3 h-3" />
                    {item}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold text-sm uppercase tracking-wider mb-5">Contact Us</h4>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400">Party Headquarters, NTR Bhavan, Road No. 2, Banjara Hills, Hyderabad - 500034</p>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-gray-400">+91 40 2354 6789</p>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-gray-400">info@tdpparty.org</p>
              </div>
            </div>
            <div className="mt-6">
              <h5 className="text-white text-xs font-semibold uppercase tracking-wider mb-3">Newsletter</h5>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && void handleNewsletterJoin()}
                  className="flex-1 px-3 py-2 bg-gray-800 rounded-lg text-sm text-white placeholder-gray-500 border border-gray-700 focus:border-yellow-400 focus:outline-none"
                />
                <button
                  onClick={() => void handleNewsletterJoin()}
                  disabled={newsletterStatus === 'loading' || !newsletterEmail.trim()}
                  className="px-4 py-2 bg-yellow-400 text-gray-900 rounded-lg text-sm font-semibold hover:bg-yellow-300 transition-colors disabled:opacity-60"
                >
                  Join
                </button>
              </div>
              {newsletterStatus !== 'idle' && newsletterMsg && (
                <p className={`mt-2 text-xs ${newsletterStatus === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                  {newsletterMsg}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">
            &copy; 2026 Telugu Desam Party. All rights reserved. Built with transparency and trust.
          </p>
          <div className="flex items-center gap-6">
            {['Privacy Policy', 'Terms of Service', 'Cookie Policy'].map(item => (
              <button key={item} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
                {item}
              </button>
            ))}
            <button
              onClick={handleSecretAdmin}
              className="text-gray-700 hover:text-gray-600 transition-colors"
              aria-label="Secret"
              title=""
            >
              <KeyRound className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
