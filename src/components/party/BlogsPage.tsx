import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import AIInsightBanner from './AIInsightBanner';
import {
  Heart, MessageCircle, Share2, Trash2, Plus, X, Image, Video, Send,
  Search, Filter, Calendar, ChevronDown, Upload, Eye
} from 'lucide-react';

import { api } from '@/lib/api';

type BlogMedia = { url: string; publicId?: string; resourceType?: 'image' | 'video' | 'raw' };

type BackendBlog = {
  _id: string;
  title: string;
  content: string;
  media: BlogMedia[];
  createdAt: string;
  createdBy?: { _id: string; name: string; membershipId?: string; profilePicture?: string };
};

type BlogComment = {
  _id: string;
  text: string;
  createdAt: string;
  user?: { _id: string; name: string; membershipId?: string; profilePicture?: string };
};

type BlogMeta = {
  likes: number;
  likedByMe: boolean;
  comments: BlogComment[];
};

function inferResourceTypeFromUrl(url: string): 'image' | 'video' | 'raw' {
  const u = String(url || '').toLowerCase();
  if (u.match(/\.(png|jpg|jpeg|gif|webp|bmp|svg)(\?|#|$)/)) return 'image';
  if (u.match(/\.(mp4|webm|mov|m4v|avi)(\?|#|$)/)) return 'video';
  return 'raw';
}

const BlogsPage: React.FC = () => {
  const { user, isAuthenticated, setShowLoginModal } = useAppContext();
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [mediaLink, setMediaLink] = useState('');
  const [draftMedia, setDraftMedia] = useState<BlogMedia[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showComments, setShowComments] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBlog, setExpandedBlog] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [blogs, setBlogs] = useState<BackendBlog[]>([]);
  const [blogMeta, setBlogMeta] = useState<Record<string, BlogMeta>>({});
  const [loadingMeta, setLoadingMeta] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api
      .request<{ ok: true; items: BackendBlog[] }>('/api/blogs?limit=50', 'GET')
      .then((res) => {
        if (!alive) return;
        setBlogs(res.items || []);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message || 'Failed to load blogs');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const loadBlogMeta = async (id: string) => {
    setLoadingMeta((prev) => ({ ...prev, [id]: true }));
    setError('');
    try {
      const tokens = api.getStoredTokens();
      const hasToken = Boolean(tokens?.accessToken);

      const res = hasToken
        ? await api.authedRequest<{ ok: true; meta: BlogMeta }>(`/api/blogs/${id}`, 'GET')
        : await api.request<{ ok: true; meta: BlogMeta }>(`/api/blogs/${id}`, 'GET');

      setBlogMeta((prev) => ({ ...prev, [id]: res.meta }));
    } catch (e: any) {
      setError(e?.message || 'Failed to load blog details');
    } finally {
      setLoadingMeta((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleToggleLike = async (id: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setError('');

    if (!blogMeta[id] && !loadingMeta[id]) {
      void loadBlogMeta(id);
    }

    const current = blogMeta[id];
    const liked = Boolean(current?.likedByMe);
    try {
      if (liked) {
        const res = await api.authedRequest<{ ok: true; likes: number }>(`/api/blogs/${id}/like`, 'DELETE');
        setBlogMeta((prev) => ({
          ...prev,
          [id]: {
            likes: res.likes,
            likedByMe: false,
            comments: prev[id]?.comments || [],
          },
        }));
      } else {
        const res = await api.authedRequest<{ ok: true; likes: number }>(`/api/blogs/${id}/like`, 'POST');
        setBlogMeta((prev) => ({
          ...prev,
          [id]: {
            likes: res.likes,
            likedByMe: true,
            comments: prev[id]?.comments || [],
          },
        }));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to update like');
    }
  };

  const handleAddComment = async (id: string) => {
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    const text = String(commentText[id] || '').trim();
    if (!text) return;

    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; comment: BlogComment }>(`/api/blogs/${id}/comments`, 'POST', { text });
      setCommentText((prev) => ({ ...prev, [id]: '' }));
      setBlogMeta((prev) => ({
        ...prev,
        [id]: {
          likes: prev[id]?.likes || 0,
          likedByMe: prev[id]?.likedByMe || false,
          comments: [res.comment, ...(prev[id]?.comments || [])],
        },
      }));
    } catch (e: any) {
      setError(e?.message || 'Failed to add comment');
    }
  };

  const filteredBlogs = useMemo(() => {
    return blogs.filter((b) => {
      const t = String(b.title || '').toLowerCase();
      const c = String(b.content || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      return t.includes(q) || c.includes(q);
    });
  }, [blogs, searchQuery]);

  const handleAddMediaLink = () => {
    const url = mediaLink.trim();
    if (!url) return;
    const resourceType = inferResourceTypeFromUrl(url);
    setDraftMedia((prev) => [...prev, { url, resourceType }]);
    setMediaLink('');
  };

  const handlePickFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    setUploading(true);
    setError('');
    try {
      const next: BlogMedia[] = [];
      for (const f of Array.from(files)) {
        const uploaded = await api.uploadSingle(f);
        next.push({
          url: uploaded.file.url,
          publicId: uploaded.file.publicId,
          resourceType: (uploaded.file.resourceType as any) || inferResourceTypeFromUrl(uploaded.file.url),
        });
      }
      setDraftMedia((prev) => [...prev, ...next]);
    } catch (e: any) {
      setError(e?.message || 'Failed to upload');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await api.authedRequest<{ ok: true; blog: BackendBlog }>('/api/blogs', 'POST', {
        title: newTitle.trim(),
        content: newContent.trim(),
        tags: [],
        media: draftMedia,
      });
      setBlogs((prev) => [res.blog, ...prev]);
      setNewTitle('');
      setNewContent('');
      setDraftMedia([]);
      setMediaLink('');
      setShowCreate(false);
    } catch (e: any) {
      setError(e?.message || 'Failed to create blog');
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
      await api.authedRequest(`/api/blogs/${id}`, 'DELETE');
      setBlogs((prev) => prev.filter((b) => String(b._id) !== String(id)));
    } catch (e: any) {
      setError(e?.message || 'Failed to delete blog');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Blogs & News</h1>
          <p className="text-gray-500 mt-1">Stay informed with the latest party updates and discussions</p>
        </div>
        {isAuthenticated && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors shadow-md shadow-blue-200"
          >
            <Plus className="w-4 h-4" /> Create Post
          </button>
        )}
      </div>

      <AIInsightBanner text="Blog discussions help leadership understand public sentiment and emerging issues. Engage with posts to contribute to policy dialogue and democratic discourse." />

      {error && <p className="text-sm text-red-600 mt-4">{error}</p>}

      {/* Create Blog Form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Create New Post</h3>
            <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          <div className="space-y-4">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Post title..."
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
            />
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="Write your post content..."
              rows={5}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none resize-none"
            />
            <div className="grid md:grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={mediaLink}
                  onChange={e => setMediaLink(e.target.value)}
                  placeholder="Paste media link (optional)"
                  className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-sm focus:border-blue-500 outline-none"
                />
                <button
                  onClick={handleAddMediaLink}
                  className="px-4 py-2 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors text-sm font-semibold"
                >
                  Add
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={(e) => void handlePickFiles(e.target.files)}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200 disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload Media'}
                </button>
                <div className="text-xs text-gray-500">{draftMedia.length} selected</div>
              </div>
            </div>

            {draftMedia.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {draftMedia.map((m, idx) => (
                  <div key={idx} className="relative border border-gray-200 rounded-xl overflow-hidden bg-gray-50">
                    {m.resourceType === 'image' ? (
                      <img src={m.url} alt="" className="w-full h-24 object-cover" />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center text-xs text-gray-500">
                        {m.resourceType || 'media'}
                      </div>
                    )}
                    <button
                      onClick={() => setDraftMedia((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 p-1 bg-black/50 rounded-full"
                      title="Remove"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleCreate}
              disabled={loading || uploading || !newTitle.trim() || !newContent.trim()}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Publish Post
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search blogs..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          />
        </div>
      </div>
      {/* Blog Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {filteredBlogs.map((blog) => (
          <div key={blog._id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
            {blog.media?.[0]?.url && inferResourceTypeFromUrl(blog.media[0].url) === 'image' && (
              <div className="relative h-52 overflow-hidden">
                <img src={blog.media[0].url} alt={blog.title} className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold">
                  {(blog.createdBy?.name || 'U').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{blog.createdBy?.name || 'Member'}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Calendar className="w-3 h-3" /> {String(blog.createdAt || '').slice(0, 10)}
                  </p>
                </div>
                {(user?.role === 'admin' || String(blog.createdBy?._id) === String(user?.id)) && (
                  <button
                    onClick={() => void handleDelete(blog._id)}
                    className="ml-auto p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 leading-snug">{blog.title}</h3>
              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {expandedBlog === blog._id ? blog.content : blog.content.substring(0, 150) + '...'}
                <button
                  onClick={() => setExpandedBlog(expandedBlog === blog._id ? null : blog._id)}
                  className="text-blue-600 font-medium ml-1 hover:underline"
                >
                  {expandedBlog === blog._id ? 'Show less' : 'Read more'}
                </button>
              </p>

              {blog.media?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {blog.media.slice(0, 6).map((m, i) => (
                    <a
                      key={i}
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                      Media {i + 1}
                    </a>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                <button
                  onClick={() => void handleToggleLike(blog._id)}
                  className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${
                    blogMeta[blog._id]?.likedByMe ? 'text-red-500' : 'text-gray-400 hover:text-red-500'
                  }`}
                >
                  <Heart className="w-4 h-4" />
                  {blogMeta[blog._id]?.likes ?? 0}
                </button>
                <button
                  onClick={() => {
                    const next = !showComments[blog._id];
                    setShowComments((prev) => ({ ...prev, [blog._id]: next }));
                    if (next && !blogMeta[blog._id] && !loadingMeta[blog._id]) {
                      void loadBlogMeta(blog._id);
                    }
                  }}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Comments ({blogMeta[blog._id]?.comments?.length ?? 0})
                </button>
                <button className="flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-green-500 transition-colors">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              {/* Comments */}
              {showComments[blog._id] && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  {loadingMeta[blog._id] && <p className="text-sm text-gray-500">Loading...</p>}

                  {!loadingMeta[blog._id] && (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={commentText[blog._id] || ''}
                          onChange={(e) => setCommentText((prev) => ({ ...prev, [blog._id]: e.target.value }))}
                          placeholder={isAuthenticated ? 'Write a comment...' : 'Login to comment'}
                          disabled={!isAuthenticated}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm"
                        />
                        <button
                          onClick={() => void handleAddComment(blog._id)}
                          disabled={!isAuthenticated || !String(commentText[blog._id] || '').trim()}
                          className="px-3 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
                          title="Send"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="mt-3 space-y-3">
                        {(blogMeta[blog._id]?.comments || []).map((c) => (
                          <div key={c._id} className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-bold text-gray-800">{c.user?.name || 'Member'}</p>
                              <p className="text-[10px] text-gray-400">{String(c.createdAt || '').slice(0, 10)}</p>
                            </div>
                            <p className="text-sm text-gray-700 mt-1">{c.text}</p>
                          </div>
                        ))}

                        {(blogMeta[blog._id]?.comments || []).length === 0 && (
                          <p className="text-sm text-gray-500">No comments yet.</p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredBlogs.length === 0 && (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No blogs found</p>
          <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
        </div>
      )}
    </div>
  );
};

const FileText = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" x2="8" y1="13" y2="13"/>
    <line x1="16" x2="8" y1="17" y2="17"/>
    <line x1="10" x2="8" y1="9" y2="9"/>
  </svg>
);

export default BlogsPage;
