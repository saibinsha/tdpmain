import React, { useEffect, useMemo, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { api } from '@/lib/api';
import AIInsightBanner from './AIInsightBanner';
import {
  ArrowRight, Users, BarChart3, FileText, Briefcase, Globe, Shield,
  TrendingUp, Award, Heart, Zap, Target, ChevronRight
} from 'lucide-react';

type LeaderNewsItem = {
  leaderId: string;
  leaderName: string;
  title: string;
  link: string;
  pubDate: string | null;
  source: string | null;
  sourceUrl: string | null;
  description: string;
  imageUrl: string | null;
};

type LeadersNewsResponse = {
  ok: true;
  items: LeaderNewsItem[];
};

const HomePage: React.FC = () => {
  const { setCurrentPage, setShowLoginModal, isAuthenticated } = useAppContext();

  const stats = [
    { label: 'Active Members', value: '2.5M+', icon: Users, color: 'from-blue-500 to-blue-600' },
    { label: 'Districts Covered', value: '26', icon: Globe, color: 'from-green-500 to-green-600' },
    { label: 'Works Completed', value: '15K+', icon: Briefcase, color: 'from-yellow-500 to-orange-500' },
    { label: 'Polls Conducted', value: '850+', icon: BarChart3, color: 'from-purple-500 to-purple-600' },
  ];

  const features = [
    { title: 'Digital Democracy', desc: 'Participate in polls, surveys, and community discussions to shape party policies.', icon: BarChart3, color: 'bg-blue-50 text-blue-600', page: 'polls' },
    { title: 'Transparent Governance', desc: 'Track public works, view progress reports, and hold leaders accountable.', icon: Shield, color: 'bg-green-50 text-green-600', page: 'works' },
    { title: 'Community Voice', desc: 'Join community forums, group discussions, and share your ideas with leadership.', icon: Globe, color: 'bg-purple-50 text-purple-600', page: 'community' },
    { title: 'Member Network', desc: 'Connect with fellow party members, collaborate on initiatives, and grow together.', icon: Users, color: 'bg-orange-50 text-orange-600', page: 'members' },
    { title: 'News & Updates', desc: 'Stay informed with the latest party news, blog posts, and press releases.', icon: FileText, color: 'bg-red-50 text-red-600', page: 'blogs' },
    { title: 'Public Works', desc: 'Submit and track public work requests for your constituency and community.', icon: Briefcase, color: 'bg-teal-50 text-teal-600', page: 'works' },
  ];

  const [newsItems, setNewsItems] = useState<LeaderNewsItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsError, setNewsError] = useState<string | null>(null);
  const [newsExpanded, setNewsExpanded] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedPost, setSelectedPost] = useState<LeaderNewsItem | null>(null);
  const [newsLeaderFilter, setNewsLeaderFilter] = useState<'all' | 'cbn' | 'lokesh' | 'thippe_swamy' | 'ms_raju'>('all');

  const visibleCount = newsExpanded ? 24 : 8;

  const visibleNews = useMemo(() => {
    return newsItems.slice(0, Math.min(visibleCount, newsItems.length));
  }, [newsItems, visibleCount]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setNewsLoading(true);
      setNewsError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('limit', '20');
        if (newsLeaderFilter !== 'all') qs.set('leaderId', newsLeaderFilter);

        const res = await api.request<LeadersNewsResponse>(`/api/news/leaders?${qs.toString()}`, 'GET');
        if (cancelled) return;
        setNewsItems(Array.isArray(res?.items) ? res.items : []);
        setActiveIndex(0);
      } catch (e: any) {
        if (cancelled) return;
        setNewsError(e?.message || 'Failed to load news');
      } finally {
        if (cancelled) return;
        setNewsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [newsLeaderFilter]);

  const leaders = [
    { name: 'N. Chandrababu Naidu', role: 'Party President', image: 'https://yt3.googleusercontent.com/OyHTN7U_Ub5iZR2qDDJ34uFWBQJ4VGolPIo1xE_0i-HeRapRLS8KccvZS9NviBLbjU18Pv8J=s900-c-k-c0x00ffffff-no-rj' },
    { name: 'Nara Lokesh', role: 'National General Secretary', image: 'https://theleaderspage.com/wp-content/uploads/2020/07/nara-lokesh.jpg' },
    { name: 'Gundumala Thippe Swamy', role: 'MLC', image: 'https://s3.ap-southeast-1.amazonaws.com/images.deccanchronicle.com/dc-Cover-h888ii526o296qi4udif56da84-20230626233651.Medi.jpeg' },
    { name: 'M.S. Raju', role: 'MLA', image: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSfcbsN7t1LnUerPviprD4Ver0GUc4nAPR4yQ&s' },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-900 via-blue-800 to-blue-950 text-white">
        <div
          className="absolute inset-0 opacity-[0.08] pointer-events-none"
          style={{
            backgroundImage: "url('/logo.png')",
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            backgroundSize: 'min(520px, 85vw)',
          }}
        />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-yellow-400 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-400 rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 bg-yellow-300 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-400/20 border border-yellow-400/30 rounded-full text-yellow-300 text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Empowering 2.5 Million Members
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6">
                Building a
                <span className="text-yellow-400"> Stronger</span>
                <br />
                Tomorrow,
                <span className="text-yellow-400"> Together</span>
              </h1>
              <p className="text-lg text-blue-200 leading-relaxed mb-8 max-w-xl">
                Join the digital revolution in democratic participation. Your voice matters in shaping policies, tracking governance, and building a transparent future for all citizens.
              </p>
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => isAuthenticated ? setCurrentPage('community') : setShowLoginModal(true)}
                  className="flex items-center gap-2 px-8 py-4 bg-yellow-400 text-blue-900 rounded-xl text-sm font-bold hover:bg-yellow-300 transition-all shadow-lg shadow-yellow-400/30 hover:shadow-yellow-400/50 hover:-translate-y-0.5"
                >
                  {isAuthenticated ? 'Join Community' : 'Get Started'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setCurrentPage('works')}
                  className="flex items-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl text-sm font-bold hover:bg-white/20 transition-all backdrop-blur-sm"
                >
                  View Public Works
                </button>
              </div>
            </div>
            <div className="hidden lg:block">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-yellow-400/20 to-blue-400/20 rounded-3xl blur-xl" />
                <img
                  src="https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=600&h=400&fit=crop"
                  alt="Community gathering"
                  className="relative rounded-2xl shadow-2xl w-full object-cover h-[400px]"
                />
                <div className="absolute -bottom-6 -left-6 bg-white rounded-xl p-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-gray-900">94%</p>
                      <p className="text-xs text-gray-500">Member Satisfaction</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -top-4 -right-4 bg-white rounded-xl p-4 shadow-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-yellow-100 flex items-center justify-center">
                      <Award className="w-6 h-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-black text-gray-900">15K+</p>
                      <p className="text-xs text-gray-500">Works Completed</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="relative -mt-8 z-10 max-w-7xl mx-auto px-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div key={i} className="bg-white rounded-xl p-5 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-black text-gray-900">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4">
        <AIInsightBanner text="Strengthening democracy through digital participation, transparency, and direct citizen engagement. Our platform connects millions of members with leadership for collaborative governance." />
      </div>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-gray-900 mb-3">Platform Features</h2>
          <p className="text-gray-500 max-w-2xl mx-auto">Everything you need to participate in democratic governance and community building</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <button
                key={i}
                onClick={() => setCurrentPage(feature.page)}
                className="text-left bg-white rounded-xl p-6 border border-gray-100 hover:border-blue-200 hover:shadow-lg transition-all group"
              >
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{feature.desc}</p>
                <div className="flex items-center gap-1 mt-4 text-blue-600 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  Explore <ChevronRight className="w-4 h-4" />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Latest News */}
      <section className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Latest News</h2>
              <p className="text-gray-500">Auto updates for party leadership from Google News</p>
            </div>
            <button
              onClick={() => setNewsExpanded(true)}
              className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              View All <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-6">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'cbn', label: 'CBN' },
                { id: 'lokesh', label: 'Lokesh' },
                { id: 'thippe_swamy', label: 'Thippe Swamy' },
                { id: 'ms_raju', label: 'M.S. Raju' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setNewsLeaderFilter(t.id);
                  setNewsExpanded(false);
                }}
                className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${
                  newsLeaderFilter === t.id
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {newsLoading && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-gray-500">
              Loading news...
            </div>
          )}

          {!newsLoading && newsError && (
            <div className="bg-white border border-red-200 rounded-xl p-6 text-sm text-red-700">
              {newsError}
            </div>
          )}

          {!newsLoading && !newsError && visibleNews.length === 0 && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-sm text-gray-500">
              No news found.
            </div>
          )}

          {!newsLoading && !newsError && visibleNews.length > 0 && (
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7">
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="relative h-72 md:h-80 bg-gray-100 overflow-hidden">
                    {visibleNews[activeIndex]?.imageUrl ? (
                      <img
                        src={visibleNews[activeIndex].imageUrl as string}
                        alt={visibleNews[activeIndex].title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                        No image
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-xs text-white/80 mb-2">
                        {visibleNews[activeIndex]?.leaderName}
                        {visibleNews[activeIndex]?.source ? ` • ${visibleNews[activeIndex].source}` : ''}
                      </p>
                      <h3 className="text-white font-black text-xl leading-snug">
                        {visibleNews[activeIndex]?.title}
                      </h3>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          onClick={() => setSelectedPost(visibleNews[activeIndex])}
                          className="px-4 py-2 bg-yellow-400 text-blue-900 rounded-lg text-xs font-bold hover:bg-yellow-300 transition-colors"
                        >
                          View More
                        </button>
                        <a
                          href={visibleNews[activeIndex]?.link}
                          target="_blank"
                          rel="noreferrer"
                          className="px-4 py-2 bg-white/15 text-white rounded-lg text-xs font-bold hover:bg-white/25 transition-colors"
                        >
                          Open Source
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 border-t border-gray-100">
                    <button
                      onClick={() => setActiveIndex((x) => Math.max(0, x - 1))}
                      disabled={activeIndex === 0}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Prev
                    </button>
                    <p className="text-xs text-gray-500">
                      {activeIndex + 1} / {visibleNews.length}
                    </p>
                    <button
                      onClick={() => setActiveIndex((x) => Math.min(visibleNews.length - 1, x + 1))}
                      disabled={activeIndex >= visibleNews.length - 1}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5">
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                    <p className="font-bold text-gray-900">More posts</p>
                    <button
                      onClick={() => setNewsExpanded((v) => !v)}
                      className="text-sm font-bold text-blue-600 hover:text-blue-700"
                    >
                      {newsExpanded ? 'Show Less' : 'View All'}
                    </button>
                  </div>
                  <div className="max-h-[420px] overflow-auto">
                    {visibleNews.map((item, i) => (
                      <button
                        key={`${item.link}-${i}`}
                        onClick={() => setActiveIndex(i)}
                        className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                          i === activeIndex ? 'bg-blue-50' : ''
                        }`}
                      >
                        <p className="text-xs text-gray-500 mb-1">
                          {item.leaderName}
                          {item.source ? ` • ${item.source}` : ''}
                        </p>
                        <p className="font-bold text-gray-900 leading-snug line-clamp-2">{item.title}</p>
                        {item.description ? (
                          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="md:hidden mt-6 text-center">
            <button
              onClick={() => setNewsExpanded(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              View All News
            </button>
          </div>
        </div>
      </section>

      {selectedPost ? (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">
                  {selectedPost.leaderName}
                  {selectedPost.source ? ` • ${selectedPost.source}` : ''}
                </p>
                <h3 className="text-xl font-black text-gray-900 leading-snug">{selectedPost.title}</h3>
              </div>
              <button
                onClick={() => setSelectedPost(null)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-bold hover:bg-gray-50"
              >
                Close
              </button>
            </div>

            {selectedPost.imageUrl ? (
              <div className="w-full bg-gray-100">
                <img src={selectedPost.imageUrl} alt={selectedPost.title} className="w-full max-h-[420px] object-cover" />
              </div>
            ) : null}

            <div className="p-5">
              {selectedPost.description ? (
                <p className="text-sm text-gray-700 leading-relaxed">{selectedPost.description}</p>
              ) : (
                <p className="text-sm text-gray-500">No preview available.</p>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={selectedPost.link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  Read Full Article
                </a>
                <button
                  onClick={() => {
                    setNewsExpanded(true);
                    setSelectedPost(null);
                  }}
                  className="px-5 py-3 bg-gray-100 text-gray-900 rounded-lg text-sm font-bold hover:bg-gray-200 transition-colors"
                >
                  View More Posts
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Leadership */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-black text-gray-900 mb-3">Party Leadership</h2>
          <p className="text-gray-500">Dedicated leaders working for the people</p>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {leaders.map((leader, i) => (
            <div key={i} className="text-center group">
              <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-yellow-400 shadow-lg group-hover:border-blue-500 transition-colors">
                <img src={leader.image} alt={leader.name} className="w-full h-full object-cover" />
              </div>
              <h3 className="font-bold text-gray-900">{leader.name}</h3>
              <p className="text-sm text-gray-500">{leader.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-yellow-400 to-yellow-500 py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black text-blue-900 mb-4">
            Ready to Make a Difference?
          </h2>
          <p className="text-blue-800/80 text-lg mb-8 max-w-2xl mx-auto">
            Join millions of citizens who are actively participating in building a better tomorrow through digital democracy.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => isAuthenticated ? setCurrentPage('community') : setShowLoginModal(true)}
              className="px-8 py-4 bg-blue-900 text-white rounded-xl text-sm font-bold hover:bg-blue-800 transition-colors shadow-lg"
            >
              {isAuthenticated ? 'Go to Community' : 'Join Now - It\'s Free'}
            </button>
            <button
              onClick={() => setCurrentPage('contact')}
              className="px-8 py-4 bg-white text-blue-900 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors shadow-lg"
            >
              Contact Us
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
