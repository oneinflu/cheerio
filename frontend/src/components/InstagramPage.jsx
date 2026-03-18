'use strict';
import React, { useState, useEffect, useMemo } from 'react';
import { getInbox, getMessages, getInstagramStatus } from '../api';
import { cn } from '../lib/utils';
import { Badge } from './ui/Badge';
import { Pin, Instagram, Check, Trash2, Send, Paperclip, Image as ImageIcon, File, FileText, Loader2, MapPin, User, Video, Star, MoreHorizontal, Users, Search, ChevronsUpDown, Bot, PauseCircle, PlayCircle, ArrowRight } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Chat from './Chat';
import InstagramMediaPage from './InstagramMediaPage';
import CustomerCard from './CustomerCard';
import NotesPanel from './NotesPanel';
import { getTeamUsers, reassignConversation, forceReassignConversation, resolveConversation, blockConversation, unblockConversation, toggleAiForConversation, reassignExternalLead, releaseConversation } from '../api';

export default function InstagramPage({ currentUser, socket }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    const ids = currentUser.teamIds || [];
    if (ids.length > 0) return ids[0];
    return null;
  }, [currentUser]);

  const [conversations, setConversations] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [channelExternalId, setChannelExternalId] = useState('');
  const [showMedia, setShowMedia] = useState(false);
  const [activeChannelId, setActiveChannelId] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [targetAssigneeId, setTargetAssigneeId] = useState(null);

  // Load team members
  useEffect(() => {
    if (!currentUser) return;
    getTeamUsers().then(res => {
      let data = [];
      if (res && res.data && Array.isArray(res.data.data)) data = res.data.data;
      else if (res && Array.isArray(res.data)) data = res.data;
      else if (Array.isArray(res)) data = res;
      setTeamMembers(data);
    }).catch(console.error);
  }, [currentUser]);

  // Load Instagram specific data
  const loadConversations = async (silent = false) => {
    if (!teamId) return;
    try {
      if (!silent) setLoading(true);
      const res = await getInbox(teamId, filter);
      if (res && res.conversations) {
        const instagramConvs = res.conversations.filter(c => c.channelType === 'instagram');
        setConversations(instagramConvs);
      }
    } catch (err) {
      console.error('Failed to load Instagram data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      // 1. Load connected channels
      const statusRes = await getInstagramStatus();
      if (statusRes && statusRes.connected) setChannels(statusRes.channels || []);
      // 2. Load conversations
      await loadConversations();
    };
    loadData();
  }, [teamId, filter]);

  // Sync target assignee when conversation changes
  const selectedConversation = useMemo(() => conversations.find((c) => c.id === selectedId), [conversations, selectedId]);
  
  useEffect(() => {
    if (selectedId) setTargetAssigneeId(selectedConversation?.assigneeUserId || null);
  }, [selectedId, selectedConversation]);

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
        if (res && res.messages) setMessages(res.messages);
        if (selectedConversation) setChannelExternalId(selectedConversation.channelExternalId || '');
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setMessagesLoading(false);
      }
    };
    load();
  }, [selectedId, selectedConversation]);

  const handleRefresh = async () => {
    if (!selectedId) return;
    try {
      const res = await getMessages(selectedId);
      if (res && res.messages) setMessages(res.messages);
    } catch (err) {
      console.error('Failed to refresh messages:', err);
    }
  };

  const getUserName = (user) => {
    if (!user) return 'Unknown Agent';
    return `${user.firstname || ''} ${user.lastname || ''}`.trim() || user.name || user.username || 'Unknown Agent';
  };

  const assigneeName = useMemo(() => {
    if (!selectedConversation?.assigneeUserId) return null;
    const member = teamMembers.find(m => (m.id || m._id) === selectedConversation.assigneeUserId);
    return member ? getUserName(member) : 'Unknown Agent';
  }, [selectedConversation, teamMembers]);

  const handleAssign = async (cid, aid) => {
    try {
      const targetId = aid || currentUser.id;
      const conversationId = cid || selectedId;
      const teamIdVal = currentUser.teamIds[0];
      
      if (aid === currentUser.id || !aid) {
        await reassignConversation(conversationId, teamIdVal, currentUser.id);
      } else {
        const isReassignment = !!selectedConversation?.assigneeUserId;
        if (isReassignment) await forceReassignConversation(conversationId, teamIdVal, aid);
        else await reassignConversation(conversationId, teamIdVal, aid);
      }
      await loadConversations(true);
    } catch (err) {
      console.error('Failed to assign:', err);
    }
  };

  const handleExternalReassign = async () => {
    if (!selectedId) return;
    if (!targetAssigneeId) {
      await releaseConversation(selectedId);
      await loadConversations(true);
      return;
    }
    if (selectedConversation?.leadId) {
      try {
        const res = await reassignExternalLead(selectedConversation.leadId, targetAssigneeId);
        if (res && res.success) await handleAssign(selectedId, targetAssigneeId);
      } catch (err) {
        console.error('External reassign failed:', err);
      }
    } else {
      await handleAssign(selectedId, targetAssigneeId);
    }
  };

  const handleResolve = async () => {
    if (!selectedId) return;
    try {
      await resolveConversation(selectedId);
      await loadConversations(true);
    } catch (err) {
      console.error('Resolve failed:', err);
    }
  };

  const handleToggleBlock = async () => {
    if (!selectedId) return;
    try {
      if (selectedConversation.blocked) await unblockConversation(selectedId);
      else await blockConversation(selectedId);
      await loadConversations(true);
    } catch (err) {
      console.error('Toggle block failed:', err);
    }
  };

  const handleToggleAi = async () => {
    if (!selectedId) return;
    const newStatus = !(selectedConversation.is_ai_active !== false);
    try {
      await toggleAiForConversation(selectedId, newStatus);
      await loadConversations(true);
    } catch (err) {
      console.error('Toggle AI failed:', err);
    }
  };

  const handleLeadStageUpdated = () => loadConversations(true);

  if (showMedia) {
    return <InstagramMediaPage activeChannelId={activeChannelId} onBack={() => setShowMedia(false)} />;
  }

  return (
    <div className="flex flex-1 h-full w-full bg-white overflow-hidden">
      {/* Sidebar Part stays same but maybe refine slightly */}
      <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50">
        <div className="px-4 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-pink-100 rounded-lg">
              <Instagram className="w-5 h-5 text-pink-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900 leading-none">Instagram</h2>
              <p className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-wider">Direct messages</p>
            </div>
          </div>
          <Button 
            onClick={() => {
              let targetId = channels[0]?.id || (conversations[0]?.channelId || conversations[0]?.channel_id);
              if (targetId && targetId !== 'undefined') { setActiveChannelId(targetId); setShowMedia(true); }
              else alert('No Instagram channels connected.');
            }}
            variant="outline" size="sm" className="w-full mt-2 gap-2 border-pink-200 text-pink-600 hover:bg-pink-50 font-bold rounded-xl h-9"
          >
            <ImageIcon className="w-4 h-4" /> View Posts Grid
          </Button>
        </div>

        {/* Filter Chips */}
        <div className="px-3 py-2 flex gap-2 border-b border-slate-100 overflow-x-auto no-scrollbar">
          {['all', 'open', 'unassigned'].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn("px-2 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap border capitalize", filter === f ? "bg-pink-600 text-white border-pink-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}>{f}</button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 animate-spin text-pink-400" /></div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-sm italic py-20">No active conversations</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {conversations.map((c) => {
                const isSelected = selectedId === c.id;
                return (
                  <li key={c.id} className={cn("px-4 py-3 cursor-pointer transition-colors border-l-4", isSelected ? "bg-pink-50 border-pink-600" : "hover:bg-slate-100 border-transparent")} onClick={() => setSelectedId(c.id)}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-sm font-bold text-slate-900 truncate">{c.contactName}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</span>
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-1 opacity-80">{c.lastMessage || "No messages yet"}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <Badge variant={c.assigneeUserId ? "secondary" : "outline"} className="text-[9px] px-1.5 h-4 font-bold uppercase">{c.assigneeUserId ? 'Assigned' : 'Unassigned'}</Badge>
                      {c.unreadCount > 0 && <div className="h-4 min-w-[16px] rounded-full bg-pink-500 text-[9px] font-black text-white px-1 flex items-center justify-center">{c.unreadCount}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedId ? (
          <>
            {/* Header */}
            <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
               <div className="flex items-center space-x-3">
                 <div className="w-10 h-10 rounded-full bg-pink-50 flex items-center justify-center text-pink-600 font-bold text-sm border border-pink-100">
                    {selectedConversation?.contactName?.substring(0, 2).toUpperCase() || 'UN'}
                 </div>
                 <div>
                    <h2 className="font-bold text-sm text-slate-900 leading-tight">{selectedConversation?.contactName || 'Unknown'}</h2>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{selectedConversation?.status === 'closed' ? 'Closed' : 'Open Chat'}</p>
                 </div>
               </div>
               <div className="flex items-center space-x-2">
                 <Button variant="outline" size="sm" onClick={handleResolve} className="h-8 font-bold text-xs">Resolve</Button>
                 <Button variant={selectedConversation?.blocked ? "destructive" : "outline"} size="sm" onClick={handleToggleBlock} className="h-8 font-bold text-xs">{selectedConversation?.blocked ? 'Unblock' : 'Block'}</Button>
                 <div className="bg-slate-100 flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 h-8">
                    <span className="text-[10px] font-black uppercase text-slate-400">Assigned:</span>
                    <span className="text-xs font-bold text-slate-700">{assigneeName || 'Unassigned'}</span>
                 </div>
               </div>
            </div>

            {/* AI Control */}
            <div className={`border-b px-4 py-1.5 flex items-center justify-between ${selectedConversation?.is_ai_active !== false ? 'bg-purple-50 border-purple-100' : 'bg-slate-50 border-slate-200'}`}>
               <div className="flex items-center gap-2">
                 <div className="relative">
                   <Bot size={14} className={selectedConversation?.is_ai_active !== false ? "text-purple-600" : "text-slate-400"} />
                   {(selectedConversation?.is_ai_active !== false) && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse border border-white" />}
                 </div>
                 <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedConversation?.is_ai_active !== false ? 'text-purple-600' : 'text-slate-500'}`}>
                    AI {selectedConversation?.is_ai_active !== false ? 'is Replying' : 'is Paused'}
                 </span>
               </div>
               <div className="flex items-center gap-2">
                 <Button size="sm" variant="ghost" className="h-6 text-[10px] font-black uppercase tracking-widest border border-slate-200 bg-white" onClick={handleToggleAi}>
                    {selectedConversation?.is_ai_active !== false ? <><PauseCircle size={12} className="mr-1 text-red-500" /> Pause</> : <><PlayCircle size={12} className="mr-1 text-green-500" /> Resume</>}
                 </Button>
                 {!selectedConversation?.assigneeUserId && (
                   <Button size="sm" variant="ghost" className="h-6 text-[10px] font-black uppercase tracking-widest bg-purple-600 text-white hover:bg-purple-700" onClick={() => handleAssign()}>
                      Take Over <ArrowRight size={10} className="ml-1" />
                   </Button>
                 )}
               </div>
            </div>

            <div className="flex-1 overflow-hidden flex">
              <div className="flex-1 flex flex-col relative min-w-0">
                <Chat
                  socket={socket}
                  conversationId={selectedId}
                  channelExternalId={channelExternalId}
                  channelType="instagram"
                  messages={messages}
                  onRefresh={handleRefresh}
                  isLoading={messagesLoading}
                />
              </div>

              {/* Sidebar */}
              <aside className="w-80 shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col overflow-y-auto hidden lg:flex">
                 <div className="p-4 space-y-4">
                    {/* Assignment Card */}
                    <Card className="shadow-none border-slate-200 bg-white shadow-sm overflow-hidden">
                       <CardHeader className="py-2.5 px-4 bg-slate-50/50 border-b border-slate-100 flex-row items-center gap-2">
                          <Users size={14} className="text-slate-500" />
                          <CardTitle className="text-xs font-black uppercase tracking-widest text-slate-700">Assignment</CardTitle>
                       </CardHeader>
                       <CardContent className="p-4 space-y-3">
                          <label className="text-[10px] font-black uppercase text-slate-400 block tracking-widest leading-none">Counsellor</label>
                          <div className="relative">
                             <Button variant="outline" className="w-full justify-between h-9 px-3 text-xs font-bold font-slate-700 bg-white border-slate-200" onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}>
                                {targetAssigneeId ? getUserName(teamMembers.find(m => (m.id || m._id) === targetAssigneeId)) : 'Select Agent'}
                                <ChevronsUpDown size={14} className="opacity-40" />
                             </Button>
                             {isAssigneeOpen && (
                                <div className="absolute top-full left-0 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                   <div className="p-2 border-b border-slate-50">
                                      <div className="relative">
                                         <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                                         <input value={assigneeSearch} onChange={e => setAssigneeSearch(e.target.value)} placeholder="Search team..." className="w-full h-8 pl-8 pr-3 text-xs font-bold border border-slate-100 rounded-lg outline-none focus:border-pink-500 transition-colors" />
                                      </div>
                                   </div>
                                   <div className="max-h-48 overflow-y-auto">
                                      <div className="p-2 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-400 italic" onClick={() => {setTargetAssigneeId(null); setIsAssigneeOpen(false)}}>Unassign</div>
                                      {teamMembers.filter(m => !assigneeSearch || getUserName(m).toLowerCase().includes(assigneeSearch.toLowerCase())).map(m => (
                                        <div key={m.id || m._id} className="p-2.5 hover:bg-pink-50 cursor-pointer text-xs font-bold text-slate-700 flex justify-between items-center" onClick={() => {setTargetAssigneeId(m.id || m._id); setIsAssigneeOpen(false)}}>
                                           <span>{getUserName(m)}</span>
                                           {targetAssigneeId === (m.id || m._id) && <Check size={12} className="text-pink-600" />}
                                        </div>
                                      ))}
                                   </div>
                                </div>
                             )}
                          </div>
                          <Button className="w-full bg-slate-900 text-white font-black uppercase text-[10px] tracking-widest hover:bg-black h-9 rounded-xl shadow-md" size="sm" onClick={handleExternalReassign}>Re Assign</Button>
                       </CardContent>
                    </Card>

                    {/* Customer Info */}
                    <div className="px-0.5">
                       <CustomerCard conversationId={selectedId} onLeadStageUpdated={handleLeadStageUpdated} />
                    </div>

                    {/* Notes */}
                    <div className="min-h-[250px] flex flex-col">
                       <NotesPanel conversationId={selectedId} currentUser={currentUser} socket={socket} />
                    </div>
                 </div>
              </aside>
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
            <div className="text-center">
              <div className="mx-auto h-20 w-20 rounded-[2rem] bg-pink-100 flex items-center justify-center mb-6 shadow-inner animate-pulse">
                <Instagram className="h-10 w-10 text-pink-600" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">Instagram Inbox</h3>
              <p className="text-sm text-slate-500 max-w-xs mx-auto">Select a chat to view student details and manage counselor assignments.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
