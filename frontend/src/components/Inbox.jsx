'use strict';
import React, { useState } from 'react';
import { cn } from '../lib/utils';
import { Badge } from './ui/Badge';
import { Pin, MessageCircle, Instagram, Check, Trash2 } from 'lucide-react';

export default function Inbox({ conversations, selectedId, onSelect, onPin, onResolve, onDelete, currentUser, filter, setFilter, counts }) {
  const safeCounts = counts || { all: 0, unassigned: 0, assigned_to_me: 0, pinned: 0, resolved: 0 };
  
  return (
    <div className="flex flex-col h-full">
      {/* Filter Chips */}
      <div className="px-4 py-3 flex gap-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
        <button
          id="tour-inbox-filter-all"
          onClick={() => setFilter('all')}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1.5",
            filter === 'all' 
              ? "bg-slate-900 text-white border-slate-900 shadow-sm shadow-slate-200" 
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          )}
        >
          <span>All</span>
          <span className={cn(
            "text-[10px] px-1.5 py-0.5 rounded-full",
            filter === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
          )}>
            {safeCounts.all}
          </span>
        </button>
        <button
          id="tour-inbox-filter-open"
          onClick={() => setFilter('open')}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1.5",
            filter === 'open' 
              ? "bg-green-600 text-white border-green-600 shadow-sm shadow-green-100" 
              : "bg-white text-slate-600 border-slate-200 hover:bg-green-50 hover:text-green-700 hover:border-green-200"
          )}
        >
          <span>Open</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'open' ? "bg-white/20 text-white" : "bg-green-50 text-green-600"
          )}>
            {safeCounts.all - safeCounts.resolved}
          </span>
        </button>
        <button
          id="tour-inbox-filter-unassigned"
          onClick={() => setFilter('unassigned')}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1.5",
            filter === 'unassigned' 
              ? "bg-orange-500 text-white border-orange-500 shadow-sm shadow-orange-100" 
              : "bg-white text-slate-600 border-slate-200 hover:bg-orange-50 hover:text-orange-700 hover:border-orange-200"
          )}
        >
          <span>Unassigned</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'unassigned' ? "bg-white/20 text-white" : "bg-orange-50 text-orange-600"
          )}>
            {safeCounts.unassigned}
          </span>
        </button>
        <button
          onClick={() => setFilter('pinned')}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1.5",
            filter === 'pinned' 
              ? "bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-100" 
              : "bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
          )}
        >
          <span>Pinned</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'pinned' ? "bg-white/20 text-white" : "bg-blue-50 text-blue-600"
          )}>
            {safeCounts.pinned}
          </span>
        </button>
        <button
          onClick={() => setFilter('closed')}
          className={cn(
            "px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap border flex items-center gap-1.5",
            filter === 'closed' 
              ? "bg-slate-600 text-white border-slate-600 shadow-sm shadow-slate-100" 
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:text-slate-800"
          )}
        >
          <span>Closed</span>
          <span className={cn(
             "text-[10px] px-1.5 py-0.5 rounded-full",
             filter === 'closed' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
          )}>
            {safeCounts.resolved}
          </span>
        </button>
      </div>

      {/* List */}
      <div id="tour-inbox-list" className="flex-1 overflow-y-auto">
        <ul className="divide-y divide-slate-100">
          {conversations.map((c) => {
             const isSelected = selectedId === c.id;
             const isInsta = c.channelType === 'instagram';
             return (
              <li
                key={c.id}
                className={cn(
                  "px-4 py-4 cursor-pointer transition-colors relative group",
                  isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                )}
                onClick={() => onSelect(c.id)}
              >
                {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600" />}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn("text-sm font-semibold flex items-center gap-1", isSelected ? "text-slate-900" : "text-slate-700")}>
                    {c.isPinned && <Pin size={12} className="text-slate-500 rotate-45" fill="currentColor" />}
                    {c.contactName}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">
                      {c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPin(c.id);
                      }}
                      className={cn(
                        "p-1.5 rounded-full hover:bg-slate-200 transition-colors",
                        c.isPinned ? "text-blue-600 bg-blue-50" : "text-slate-400 hover:text-slate-600"
                      )}
                      title={c.isPinned ? "Unpin" : "Pin"}
                    >
                      <Pin size={14} fill={c.isPinned ? "currentColor" : "none"} />
                    </button>
                    {c.status !== 'closed' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onResolve(c.id);
                        }}
                        className="p-1.5 rounded-full hover:bg-slate-200 transition-colors text-slate-400 hover:text-green-600"
                        title="Resolve"
                      >
                        <Check size={14} />
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(c.id);
                        }}
                        className="p-1.5 rounded-full hover:bg-red-50 transition-colors text-slate-300 hover:text-red-600 opacity-0 group-hover:opacity-100"
                        title="Delete conversation"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                   <p className="text-xs text-slate-500 line-clamp-1 max-w-[70%]">
                     {c.lastMessage || "No messages yet"}
                   </p>
                   {c.unreadCount > 0 && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-[10px] font-bold text-white shadow-sm">
                        {c.unreadCount}
                      </div>
                   )}
                </div>
                <div className="mt-2 flex gap-2">
                   <Badge variant={c.assigneeUserId ? "secondary" : "outline"} className="text-[10px] px-1.5 h-5">
                     {c.assigneeUserId ? 'Assigned' : 'Unassigned'}
                   </Badge>
                   {c.leadStage && c.leadStage.name && (
                     <span
                       className="inline-flex items-center gap-1.5 h-5 px-1.5 rounded border text-[10px] font-medium"
                       style={{
                         borderColor: (c.leadStage.color || '#0f172a') + '33',
                         backgroundColor: (c.leadStage.color || '#0f172a') + '14',
                         color: c.leadStage.color || '#0f172a',
                       }}
                       title={c.leadStage.isClosed ? 'Closed stage' : 'Open stage'}
                     >
                       <span
                         className="h-2 w-2 rounded-full"
                         style={{ backgroundColor: c.leadStage.color || '#0f172a' }}
                       />
                       {c.leadStage.name}
                     </span>
                   )}
                   <Badge 
                     variant="outline" 
                     className={cn(
                       "text-[10px] px-1.5 h-5 flex items-center gap-1",
                       isInsta ? "text-pink-600 border-pink-200 bg-pink-50" : "text-green-600 border-green-200 bg-green-50"
                     )}
                   >
                     {isInsta ? <Instagram size={10} /> : <MessageCircle size={10} />}
                     {isInsta ? 'Instagram' : (c.channelDisplayName || 'WhatsApp')}
                   </Badge>
                </div>
              </li>
            );
          })}
          {conversations.length === 0 && (
            <div className="p-8 text-center text-slate-500 text-sm">
              No conversations found.
            </div>
          )}
        </ul>
      </div>
    </div>
  );
}
