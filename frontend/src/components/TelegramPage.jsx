'use strict';
import React, { useEffect, useState } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './ui/Badge';
import { Pin, Check, Trash2, MessageCircle, Loader2, Send, Paperclip, MoreHorizontal } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import Chat from './Chat';
import { getInbox, getMessages, pinConversation, resolveConversation, deleteConversation } from '../api';

export default function TelegramPage({ socket, currentUser, teamId }) {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('open');
  const [messages, setMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch conversations filtered by Telegram channel
  const fetchConversations = async () => {
    setIsLoading(true);
    try {
      const res = await getInbox(teamId, filter);
      if (res && res.success) {
        // Filter only Telegram conversations
        const telegramConversations = res.conversations.filter(
          c => c.channelType === 'telegram' || c.channel_type === 'telegram'
        );
        setConversations(telegramConversations);
      }
    } catch (err) {
      console.error('Failed to fetch Telegram conversations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [filter, teamId]);

  // Fetch messages for selected conversation
  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      setIsChatLoading(true);
      try {
        const data = await getMessages(selectedConversationId);
        setMessages(data.messages || []);
      } catch (err) {
        console.error('Failed to fetch messages:', err);
      } finally {
        setIsChatLoading(false);
      }
    };

    fetchMessages();
  }, [selectedConversationId]);

  // Listen for new messages via socket
  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg) => {
      if (msg.conversationId === selectedConversationId) {
        setMessages(prev => [...prev, msg]);
      }
    };

    socket.on('message:new', handleNewMessage);
    return () => socket.off('message:new', handleNewMessage);
  }, [socket, selectedConversationId]);

  const handlePin = async (conversationId) => {
    try {
      await pinConversation(conversationId);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to pin conversation:', err);
    }
  };

  const handleResolve = async (conversationId) => {
    try {
      await resolveConversation(conversationId);
      await fetchConversations();
    } catch (err) {
      console.error('Failed to resolve conversation:', err);
    }
  };

  const handleDelete = async (conversationId) => {
    if (!window.confirm('Are you sure you want to delete this conversation?')) return;
    try {
      await deleteConversation(conversationId);
      if (selectedConversationId === conversationId) {
        setSelectedConversationId(null);
      }
      await fetchConversations();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const selectedConversation = conversations.find(c => c.id === selectedConversationId);
  const filteredConversations = conversations.filter(c =>
    c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.lastMessage?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar - Telegram Conversations List */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
              <MessageCircle size={18} className="text-white" />
            </div>
            <h1 className="text-lg font-bold text-slate-900">Telegram</h1>
          </div>
          <Input
            placeholder="Search conversations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 text-sm"
          />
        </div>

        {/* Filter Chips */}
        <div className="px-3 py-2 flex gap-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
          {['all', 'open', 'unassigned', 'pinned', 'closed'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap border capitalize",
                filter === f
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              No Telegram conversations found.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredConversations.map(c => (
                <li
                  key={c.id}
                  className={cn(
                    "px-4 py-3 cursor-pointer transition-colors relative group",
                    selectedConversationId === c.id ? "bg-blue-50" : "hover:bg-slate-50"
                  )}
                  onClick={() => setSelectedConversationId(c.id)}
                >
                  {selectedConversationId === c.id && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />
                  )}
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn(
                      "text-sm font-semibold flex items-center gap-1",
                      selectedConversationId === c.id ? "text-slate-900" : "text-slate-700"
                    )}>
                      {c.isPinned && <Pin size={12} className="text-slate-500 rotate-45" fill="currentColor" />}
                      {c.contactName}
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400">
                        {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePin(c.id);
                        }}
                        className={cn(
                          "p-1 rounded hover:bg-slate-200 transition-colors",
                          c.isPinned ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600"
                        )}
                        title={c.isPinned ? "Unpin" : "Pin"}
                      >
                        <Pin size={12} fill={c.isPinned ? "currentColor" : "none"} />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 line-clamp-1">
                    {c.lastMessage || "No messages yet"}
                  </p>
                  <div className="mt-2 flex gap-2 items-center">
                    <Badge variant={c.assigneeUserId ? "secondary" : "outline"} className="text-[10px] px-1.5 h-5">
                      {c.assigneeUserId ? 'Assigned' : 'Unassigned'}
                    </Badge>
                    {c.unreadCount > 0 && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-slate-50">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <MessageCircle size={20} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900">{selectedConversation.contactName}</h2>
                  <p className="text-xs text-slate-500">Telegram</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedConversation.status !== 'closed' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResolve(selectedConversation.id)}
                    className="text-slate-600 hover:text-green-600"
                  >
                    <Check size={16} className="mr-1" />
                    Resolve
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(selectedConversation.id)}
                  className="text-slate-400 hover:text-red-600"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>

            {/* Chat Component */}
            <Chat
              socket={socket}
              conversationId={selectedConversation.id}
              channelExternalId={selectedConversation.channelExternalId}
              messages={messages}
              onRefresh={() => {
                fetchConversations();
                // Refresh messages
                if (selectedConversationId) {
                  getMessages(selectedConversationId)
                    .then(data => setMessages(data.messages || []))
                    .catch(console.error);
                }
              }}
              isLoading={isChatLoading}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="mx-auto h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
                <MessageCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-slate-700 mb-1">Select a Telegram Conversation</h3>
              <p className="text-sm text-slate-500">Choose a conversation from the list to start messaging.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
