import React from 'react';
import { Layers, User, AtSign, Pin, MessageSquare, CheckCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export default function ConversationFilters({ activeFilter, onSelectFilter, counts = {} }) {
  const filters = [
    { id: 'unassigned', label: 'Unassigned', icon: Layers },
    { id: 'assigned_to_me', label: 'Assigned to me', icon: User },
    { id: 'mentions', label: 'Mentions', icon: AtSign },
    { id: 'pinned', label: 'Pinned', icon: Pin },
    { id: 'open', label: 'Open', icon: MessageSquare },
    { id: 'resolved', label: 'Resolved', icon: CheckCircle },
  ];

  return (
    <div className="w-60 flex-none border-r border-slate-200 bg-white flex flex-col">
      <div className="p-4 pb-2">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Conversations
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto px-2 space-y-1">
        {filters.map((f) => {
          const Icon = f.icon;
          const isActive = activeFilter === f.id;
          
          let count = 0;
          switch (f.id) {
            case 'unassigned': count = counts.unassigned || 0; break;
            case 'assigned_to_me': count = counts.assigned_to_me || 0; break;
            case 'pinned': count = counts.pinned || 0; break;
            case 'resolved': count = counts.resolved || 0; break;
            case 'open': count = counts.all || 0; break;
            default: count = 0;
          }

          return (
            <button
              key={f.id}
              onClick={() => onSelectFilter(f.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-sky-50 text-sky-700"
                  : "text-slate-700 hover:bg-slate-100"
              )}
            >
              <Icon className={cn("w-4 h-4", isActive ? "text-sky-600" : "text-slate-400")} />
              <span className="flex-1 text-left">{f.label}</span>
              {count > 0 && (
                <span className={cn(
                  "ml-auto text-xs px-2 py-0.5 rounded-full",
                  isActive ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-600"
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
