'use strict';
import React, { useState, useEffect, useMemo } from 'react';
import { getInbox, getMessages } from '../api';
import { cn } from '../lib/utils';
import { Badge } from './ui/Badge';
import { Pin, MessageCircle, Check, Trash2, Send, Paperclip, Image as ImageIcon, File, FileText, Loader2, MapPin, User, Video, Star, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Chat from './Chat';

export default function TelegramPage({ currentUser, socket }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    if (ids.length > 0) return ids[0];
    return null;
  }, [currentUser]);

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [channelExternalId, setChannelExternalId] = useState('');

  // Load Telegram conversations only
  useEffect(() => {
    if (!teamId) return;
    const load = async () => {
      try {
        setLoading(true);
        const res = await getInbox(teamId, filter);
        if (res && res.conversations) {
          // Filter only Telegram conversations
          const telegramConvs = res.conversations.filter(c => c.channelType === 'telegram');
          setConversations(telegramConvs);
        }
      } catch (err) {
        console.error('Failed to load Telegram conversations:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [teamId, filter]);

  // Load messages for selected conversation
  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      setChannelExternalId('');
      return;
    }

    const load = async () => {
      try {
        setMessagesLoading(true);
        const res = await getMessages(selectedId);
        if (res && res.messages) {
          setMessages(res.messages);
        }
        // Get channel external ID
        const conv = conversations.find(c => c.id === selectedId);
        if (conv) {
          setChannelExternalId(conv.channelExternalId || '');
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setMessagesLoading(false);
      }
    };
    load();
  }, [selectedId, conversations]);

  const handleRefresh = async () => {
    if (!selectedId) return;
    try {
      const res = await getMessages(selectedId);
      if (res && res.messages) {
        setMessages(res.messages);
      }
    } catch (err) {
      console.error('Failed to refresh messages:', err);
    }
  };

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handlePin = async (id) => {
    // TODO: Implement pin functionality
    console.log('Pin conversation:', id);
  };

  const handleResolve = async (id) => {
    // TODO: Implement resolve functionality
    console.log('Resolve conversation:', id);
  };

  const handleDelete = async (id) => {
    // TODO: Implement delete functionality
    console.log('Delete conversation:', id);
  };

  return (
    <div className="flex h-full bg-white">
      {/* Telegram Inbox - Left Sidebar */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="px-4 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <MessageCircle className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Telegram</h2>
              <p className="text-xs text-slate-500">Bot conversations</p>
            </div>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-3 py-2 flex gap-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap border",
              filter === 'all'
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('open')}
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap border",
              filter === 'open'
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-slate-600 border-slate-200 hover:bg-green-50"
            )}
          >
            Open
          </button>
          <button
            onClick={() => setFilter('unassigned')}
            className={cn(
              "px-2 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap border",
              filter === 'unassigned'
                ? "bg-orange-500 text-white border-orange-500"
                : "bg-white text-slate-600 border-slate-200 hover:bg-orange-50"
            )}
          >
            Unassigned
          </button>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              No Telegram conversations
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <li
                    key={c.id}
                    className={cn(
                      "px-4 py-3 cursor-pointer transition-colors relative group",
                      isSelected ? "bg-blue-50 border-l-4 border-blue-600" : "hover:bg-slate-100"
                    )}
                    onClick={() => handleSelect(c.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-sm font-semibold flex items-center gap-1", isSelected ? "text-slate-900" : "text-slate-700")}>
                        {c.isPinned && <Pin size={12} className="text-slate-500 rotate-45" fill="currentColor" />}
                        {c.contactName}
                      </span>
                      <span className="text-xs text-slate-400">
                        {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 max-w-[70%]">
                      {c.lastMessage || "No messages yet"}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Badge variant={c.assigneeUserId ? "secondary" : "outline"} className="text-[10px] px-1.5 h-5">
                        {c.assigneeUserId ? 'Assigned' : 'Unassigned'}
                      </Badge>
                      {c.unreadCount > 0 && (
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white shadow-sm">
                          {c.unreadCount}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area - Right Side */}
      <div className="flex-1 flex flex-col">
        {selectedId ? (
          <Chat
            socket={socket}
            conversationId={selectedId}
            channelExternalId={channelExternalId}
            messages={messages}
            onRefresh={handleRefresh}
            isLoading={messagesLoading}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">Select Telegram Conversation</h3>
              <p className="text-sm text-slate-500">Choose a conversation from the list to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
