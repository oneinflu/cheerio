import React, { useState, useEffect } from 'react';
import { getInstagramMedia, getInstagramStatus } from '../api';
import { Button } from './ui/Button';
import { ArrowLeft, ExternalLink, MessageCircle, Calendar, RefreshCw } from 'lucide-react';
import { cn } from '../lib/utils';

const InstagramMediaPage = ({ activeChannelId, onBack }) => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [channel, setChannel] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeChannelId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get channel info to show header
      const statusRes = await getInstagramStatus();
      if (statusRes.connected) {
        const currentChannel = statusRes.channels.find(c => c.id === activeChannelId);
        setChannel(currentChannel);
      }

      // 2. Get media list
      const mediaRes = await getInstagramMedia(activeChannelId);
      if (mediaRes.success) {
        setMedia(mediaRes.media);
      } else {
        throw new Error(mediaRes.error || 'Failed to fetch media');
      }
    } catch (err) {
      console.error('[InstagramMediaPage] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-slate-500 hover:bg-slate-100">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              Instagram Posts
              {channel && <span className="text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full text-xs font-bold border border-pink-100">@{channel.username?.replace('@','')}</span>}
            </h2>
            <p className="text-xs text-slate-400">View your latest posts and set up comment automations</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2 rounded-full border-slate-200 text-slate-600 font-bold">
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading && media.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl aspect-square animate-pulse border border-slate-200" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 p-8 rounded-2xl text-center max-w-md mx-auto mt-20">
            <p className="text-red-600 font-bold mb-2">Error loading posts</p>
            <p className="text-sm text-red-500 mb-4">{error}</p>
            <Button onClick={fetchData} variant="outline" className="text-red-600 border-red-200 hover:bg-red-100">Try Again</Button>
          </div>
        ) : media.length === 0 ? (
          <div className="bg-white border border-slate-200 p-12 rounded-3xl text-center max-w-lg mx-auto mt-20">
            <div className="w-20 h-20 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2">No posts found</h3>
            <p className="text-sm text-slate-500">We couldn't find any recent posts on this Instagram account. Make sure you have posted some content!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {media.map((item) => (
              <div key={item.id} className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-xl hover:shadow-pink-100/50 transition-all duration-300 transform hover:-translate-y-1">
                {/* Media Wrapper */}
                <div className="relative aspect-square bg-slate-100 overflow-hidden">
                  <img 
                    src={item.media_type === 'VIDEO' ? (item.thumbnail_url || item.media_url) : item.media_url} 
                    alt={item.caption} 
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <a 
                      href={item.permalink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-white text-xs font-bold flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full ring-1 ring-white/30"
                    >
                      View on Instagram <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  {item.media_type === 'VIDEO' && (
                    <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold">VIDEO</div>
                  )}
                  {item.media_type === 'CAROUSEL_ALBUM' && (
                    <div className="absolute top-2 right-2 bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-bold">ALBUM</div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-slate-600 line-clamp-3 mb-4 font-medium leading-relaxed italic">
                    "{item.caption || 'No caption'}"
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-50">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-bold">{new Date(item.timestamp).toLocaleDateString()}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-[10px] font-black uppercase tracking-tight text-pink-600 hover:text-pink-700 hover:bg-pink-50 p-0 h-auto"
                      onClick={() => alert('Comment-to-DM for this post is coming soon!')}
                    >
                      Setup Automation
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InstagramMediaPage;
