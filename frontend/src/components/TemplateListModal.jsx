import React, { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Star, Search } from 'lucide-react';

export function TemplateListModal({ isOpen, onClose, templates, onToggleStar }) {
  const [search, setSearch] = useState('');

  const filtered = templates.filter(t => 
    t.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manage Templates" className="max-w-2xl">
      <div className="flex flex-col h-[60vh]">
        <div className="relative mb-4">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="text-center text-slate-500 py-8">No templates found</div>
          ) : (
            filtered.map((t) => (
              <div key={t.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="min-w-0 flex-1 mr-4">
                  <div className="font-medium text-sm truncate" title={t.name}>{t.name}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{t.language}</span>
                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                    <span className={t.status === 'APPROVED' ? 'text-green-600' : 'text-slate-500'}>{t.status}</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-transparent"
                  onClick={() => onToggleStar(t)}
                >
                  <Star 
                    size={18} 
                    className={t.is_starred ? "fill-yellow-400 text-yellow-400" : "text-slate-300"} 
                  />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  );
}
