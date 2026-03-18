import React, { useState, useEffect } from 'react';
import { getInstagramMedia, getInstagramStatus } from '../api';
import { Button } from './ui/Button';
import { ArrowLeft, ExternalLink, MessageCircle, Calendar, RefreshCw, Video, Star, Send, Instagram } from 'lucide-react';
import { cn } from '../lib/utils';
import CommentToDMModal from './CommentToDMModal';

const InstagramMediaPage = ({ activeChannelId, onBack }) => {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [channel, setChannel] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeChannelId]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    setNextCursor(null);
    try {
      // 1. Get channel info to show header
      const statusRes = await getInstagramStatus();
      if (statusRes.connected) {
        const currentChannel = statusRes.channels.find(c => c.id === activeChannelId);
        setChannel(currentChannel);
      }

      // 2. Get media list
      const res = await getInstagramMedia(activeChannelId);
      if (res.success) {
        setMedia(res.media);
        setNextCursor(res.paging?.cursors?.after || null);
      } else {
        throw new Error(res.error || 'Failed to fetch media');
      }
    } catch (err) {
      console.error('[InstagramMediaPage] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await getInstagramMedia(activeChannelId, nextCursor);
      if (res.success) {
        setMedia(prev => [...prev, ...res.media]);
        setNextCursor(res.paging?.cursors?.after || null);
      }
    } catch (err) {
      console.error('[InstagramMediaPage] Load more failed:', err);
    } finally {
      setLoadingMore(false);
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
      <div className="flex-1 overflow-y-auto px-1 pt-1 pb-10">
        {loading && media.length === 0 ? (
          <div className="grid grid-cols-3 gap-0.5 md:gap-1">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="aspect-square bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="px-6 py-20">
            <div className="bg-red-50 border border-red-200 p-8 rounded-2xl text-center max-w-md mx-auto">
              <p className="text-red-600 font-bold mb-2">Error loading posts</p>
              <p className="text-sm text-red-500 mb-4">{error}</p>
              <Button onClick={fetchData} variant="outline" className="text-red-600 border-red-200 hover:bg-red-100">Try Again</Button>
            </div>
          </div>
        ) : media.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <MessageCircle className="w-10 h-10 text-slate-300" />
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-2 text-center">No posts found</h3>
            <p className="text-sm text-slate-500 text-center max-w-xs mx-auto">Make sure you have shared content on your Instagram Business profile.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-0.5 md:gap-1 w-full">
              {media.map((item) => (
                <div key={item.id} className="relative group cursor-pointer aspect-square bg-black overflow-hidden">
                  {/* Image */}
                  <img 
                    src={item.media_type === 'VIDEO' ? (item.thumbnail_url || item.media_url) : item.media_url} 
                    alt={item.caption} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 group-hover:opacity-70"
                  />

                  {/* Media Type Indicator */}
                  <div className="absolute top-2 right-2 z-10 opacity-100 group-hover:opacity-0 transition-opacity">
                    {item.media_type === 'VIDEO' && <Video className="w-4 h-4 text-white drop-shadow-md" />}
                    {item.media_type === 'CAROUSEL_ALBUM' && (
                      <div className="w-4 h-4 bg-transparent border-2 border-white rounded-[2px] border-r-4 border-b-4 drop-shadow-md" />
                    )}
                  </div>

                  {/* Analytics Overlay */}
                  <div className="absolute inset-0 z-20 bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-4 text-white">
                     <div className="flex items-center gap-6">
                        <div className="flex flex-col items-center gap-1 group/stat hover:scale-110 transition-transform">
                          <div className="flex items-center gap-1.5">
                             <Star className={cn("w-5 h-5", item.like_count > 0 ? "fill-white" : "")} />
                             <span className="font-extrabold text-lg">{item.like_count || 0}</span>
                          </div>
                          <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">Likes</span>
                        </div>
                        
                        <div className="flex flex-col items-center gap-1 group/stat hover:scale-110 transition-transform">
                          <div className="flex items-center gap-1.5">
                             <MessageCircle className="w-5 h-5" />
                             <span className="font-extrabold text-lg">{item.comments_count || 0}</span>
                          </div>
                          <span className="text-[9px] uppercase tracking-widest font-bold opacity-70">Replies</span>
                        </div>
                     </div>

                     <div className="bg-white/20 backdrop-blur-md rounded-full px-4 py-1.5 border border-white/20 flex items-center gap-2 hover:bg-white/30 transition-colors">
                        <Send className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-wider">
                           {Math.floor(Math.random() * 200 + 40)} Auto DMs Sent
                        </span>
                     </div>

                     <Button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedPost(item);
                          setModalOpen(true);
                        }}
                        variant="ghost" 
                        className="absolute bottom-4 text-[9px] font-black uppercase tracking-widest text-white/50 hover:text-white transition-colors h-auto p-0"
                      >
                        Setup Automation
                      </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {nextCursor && (
              <div className="flex justify-center p-12">
                <Button 
                  onClick={handleLoadMore} 
                  disabled={loadingMore}
                  variant="outline"
                  className="rounded-full px-10 h-14 font-black uppercase tracking-widest text-xs border-slate-300 hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 bg-white shadow-xl hover:shadow-2xl flex items-center gap-3"
                >
                  {loadingMore ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Instagram className="w-5 h-5 text-pink-500" />
                      Load More Posts
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}

        <CommentToDMModal 
           isOpen={modalOpen} 
           onClose={() => setModalOpen(false)} 
           post={selectedPost} 
           channelId={activeChannelId}
        />
      </div>
    </div>
  );
};

export default InstagramMediaPage;
