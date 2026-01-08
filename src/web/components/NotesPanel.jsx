'use strict';
import React, { useEffect, useState } from 'react';
import { getNotes, createNote } from '../api';
import { Button } from './ui/Button';
import { Textarea } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { StickyNote, Clock } from 'lucide-react';

export default function NotesPanel({ conversationId, currentUser, socket }) {
  const [notes, setNotes] = useState([]);
  const [body, setBody] = useState('');

  const refresh = async () => {
    if (!conversationId) return;
    const res = await getNotes(conversationId);
    setNotes(res.notes || []);
  };

  useEffect(() => {
    refresh();
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    const onNew = (evt) => {
      if (evt.conversationId === conversationId) refresh();
    };
    const onUpdated = (evt) => {
      if (evt.conversationId === conversationId) refresh();
    };
    const onDeleted = (evt) => {
      if (evt.conversationId === conversationId) refresh();
    };
    socket.on('staff_note:new', onNew);
    socket.on('staff_note:updated', onUpdated);
    socket.on('staff_note:deleted', onDeleted);
    return () => {
      socket.off('staff_note:new', onNew);
      socket.off('staff_note:updated', onUpdated);
      socket.off('staff_note:deleted', onDeleted);
    };
  }, [socket, conversationId]);

  const handleCreate = async () => {
    if (!body.trim()) return;
    await createNote(conversationId, currentUser.id, body.trim());
    setBody('');
    refresh();
  };

  if (!conversationId) return null;

  return (
    <Card className="h-full flex flex-col shadow-sm border-slate-200">
      <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
           <StickyNote className="w-4 h-4 text-slate-500" />
           <CardTitle className="text-sm font-semibold text-slate-900">Internal Notes</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
          {notes.length === 0 && (
             <div className="text-center py-8 text-xs text-slate-400 italic">
                No notes yet. Add one below.
             </div>
          )}
          {notes.map((n) => (
            <div key={n.id} className="group relative border border-slate-100 rounded-lg p-3 bg-yellow-50/50 hover:bg-yellow-50 transition-colors">
              <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-1">
                <Clock className="w-3 h-3" />
                {new Date(n.created_at).toLocaleString()}
              </div>
              <div className="text-sm text-slate-800 leading-snug">{n.body}</div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-slate-100 bg-slate-50/30">
          <Textarea
            className="w-full min-h-[80px] bg-white resize-none text-sm mb-2 focus:ring-1 focus:ring-blue-500"
            placeholder="Add a private note..."
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleCreate} disabled={!body.trim()}>
              Add Note
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
