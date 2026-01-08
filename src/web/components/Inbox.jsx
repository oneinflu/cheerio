'use strict';
import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './ui/Badge';
import { MessageCircle, Instagram } from 'lucide-react';

export default function Inbox({ conversations, selectedId, onSelect }) {
  const [filter, setFilter] = useState('ALL'); // ALL, whatsapp, instagram

  const filteredConversations = conversations.filter(c => {
    if (filter === 'ALL') return true;
    return c.channelType === filter;
  });

  return (
    <div className="flex flex-col h-full">
      {/* Filter Chips */}
      <div className="px-4 py-3 flex gap-2 border-b border-slate-100 overflow-x-auto">
        <button
          onClick={() => setFilter('ALL')}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
            filter === 'ALL' 
              ? "bg-slate-900 text-white" 
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          )}
        >
          All
        </button>
        <button
          onClick={() => setFilter('whatsapp')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
            filter === 'whatsapp' 
              ? "bg-green-600 text-white" 
              : "bg-green-50 text-green-700 hover:bg-green-100"
          )}
        >
          <MessageCircle size={12} />
          WhatsApp
        </button>
        <button
          onClick={() => setFilter('instagram')}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
            filter === 'instagram' 
              ? "bg-pink-600 text-white" 
              : "bg-pink-50 text-pink-700 hover:bg-pink-100"
          )}
        >
          <Instagram size={12} />
          Instagram
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-100">
          {filteredConversations.map((c) => {
             const isSelected = selectedId === c.id;
             const isInsta = c.channelType === 'instagram';
             return (
              <li
                key={c.id}
                className={cn(
                  "px-4 py-4 cursor-pointer transition-colors relative",
                  isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                )}
                onClick={() => onSelect(c.id)}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-sm font-semibold", isSelected ? "text-slate-900" : "text-slate-700")}>
                    {c.contactName}
                  </span>
                  <span className="text-xs text-slate-400">
                    {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                   <p className="text-xs text-slate-500 line-clamp-1 max-w-[70%]">
                     {c.lastMessage || "No messages yet"}
                   </p>
                   {c.status === 'open' && (
                      <div className="h-2 w-2 rounded-full bg-blue-600" />
                   )}
                </div>
                <div className="mt-2 flex gap-2">
                   <Badge variant={c.assigneeUserId ? "secondary" : "outline"} className="text-[10px] px-1.5 h-5">
                     {c.assigneeUserId ? 'Assigned' : 'Unassigned'}
                   </Badge>
                   <Badge 
                     variant="outline" 
                     className={cn(
                       "text-[10px] px-1.5 h-5 flex items-center gap-1",
                       isInsta ? "text-pink-600 border-pink-200 bg-pink-50" : "text-green-600 border-green-200 bg-green-50"
                     )}
                   >
                     {isInsta ? <Instagram size={10} /> : <MessageCircle size={10} />}
                     {isInsta ? 'Instagram' : 'WhatsApp'}
                   </Badge>
                </div>
              </li>
            );
          })}
          {filteredConversations.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No conversations found.
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}
