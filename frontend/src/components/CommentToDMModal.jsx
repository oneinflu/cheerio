import React, { useState } from 'react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { createInstagramAutomation } from '../api';
import { MessageSquare, Send, Sparkles, X, CheckCircle2 } from 'lucide-react';
import { cn } from '../lib/utils';

const CommentToDMModal = ({ isOpen, onClose, post, channelId }) => {
  const [keyword, setKeyword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message) return;

    setLoading(true);
    try {
      const payload = {
        channel_id: channelId,
        type: 'comment_dm',
        name: `Comment-to-DM: ${post?.id.slice(-6)}`,
        trigger: {
          comment_keyword: keyword,
          post_id: post?.id
        },
        action: {
          message: message,
          delay_seconds: 0
        },
        is_active: true
      };

      const res = await createInstagramAutomation(payload);
      if (res.id) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
          setSuccess(false);
          setKeyword('');
          setMessage('');
        }, 2000);
      }
    } catch (err) {
      console.error('[CommentToDMModal] Save failed:', err);
      alert('Failed to save automation. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!post) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure Comment-to-DM">
      {success ? (
        <div className="py-12 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
            <CheckCircle2 className="w-12 h-12" />
          </div>
          <h3 className="text-2xl font-black text-slate-900 mb-2">Automation Saved!</h3>
          <p className="text-slate-500">I'll now watch for comments on this post.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Post Preview */}
          <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-black">
              <img 
                src={post.media_type === 'VIDEO' ? (post.thumbnail_url || post.media_url) : post.media_url} 
                className="w-full h-full object-cover" 
                alt="" 
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider">Target Post</p>
              <p className="text-sm text-slate-600 line-clamp-2 italic leading-snug">"{post.caption || 'No caption'}"</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Trigger Keyword */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3 h-3 text-pink-500" />
                Trigger Keyword (Optional)
              </label>
              <Input 
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="e.g. 'INTERESTED', 'PRICE', 'DETAILS'"
                className="h-12 rounded-xl border-slate-200 focus:ring-pink-500/20"
              />
              <p className="text-[10px] text-slate-400">Leave empty to trigger for ALL comments on this post.</p>
            </div>

            {/* DM Message */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                <MessageSquare className="w-3 h-3 text-blue-500" />
                Automatic DM Message
              </label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={4}
                placeholder="Hi! Thanks for your comment. Here are the details you asked for..."
                className="w-full rounded-2xl border-slate-200 p-4 text-sm focus:ring-2 focus:ring-pink-500/20 focus:border-pink-500 outline-none transition-all resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1 h-12 rounded-xl font-bold">Cancel</Button>
            <Button 
              type="submit" 
              disabled={loading || !message}
              className="flex-[2] h-12 rounded-xl bg-slate-900 text-white font-black text-sm gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
              {loading ? (
                <Sparkles className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Activate Automation
                </>
              )}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default CommentToDMModal;
