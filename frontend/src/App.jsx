'use strict';
import React, { useEffect, useMemo, useState } from 'react';
import Inbox from './components/Inbox.jsx';
import Chat from './components/Chat.jsx';
import NotesPanel from './components/NotesPanel.jsx';
import CustomerCard from './components/CustomerCard.jsx';
import DashboardPage from './components/DashboardPage.jsx';
import TeamPage from './components/TeamPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import TemplatesPage from './components/TemplatesPage.jsx';
import LoginPage from './components/LoginPage.jsx';
import ConversationFilters from './components/ConversationFilters.jsx';
import { connectSocket } from './socket.js';
import { getInbox, getMessages, claimConversation, reassignConversation, releaseConversation, markAsRead, resolveConversation, pinConversation, getInboxCounts } from './api.js';
import { LayoutDashboard, MessageSquare, Users, Settings, LogOut, Search, Bell, FileText } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [socket, setSocket] = useState(null);
  const [activePage, setActivePage] = useState('inbox');
  const [filter, setFilter] = useState('open');
  const [conversations, setConversations] = useState([]);
  const [counts, setCounts] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const selectedIdRef = React.useRef(selectedId);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const currentUser = useMemo(() => ({
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
    role: 'admin',
    teamIds: ['b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22']
  }), []);
  const agents = useMemo(
    () => [
      { id: currentUser.id, name: 'John Agent', role: currentUser.role, initials: 'JA' },
      { id: 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', name: 'Jane Supervisor', role: 'supervisor', initials: 'JS' },
      { id: 'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', name: 'Mike Agent', role: 'agent', initials: 'MA' },
    ],
    [currentUser.id, currentUser.role]
  );

  useEffect(() => {
    const s = connectSocket({ userId: currentUser.id, teamIds: currentUser.teamIds });
    setSocket(s);
    return () => {
      if (s) s.disconnect();
    };
  }, [currentUser]);

  const loadInbox = async () => {
    try {
      const res = await getInbox(currentUser.teamIds[0], filter);
      const currentId = selectedIdRef.current;
      const nextConversations = (res.conversations || []).map(c => 
        c.id === currentId ? { ...c, unreadCount: 0 } : c
      );
      setConversations(nextConversations);
      
      if (!currentId && nextConversations.length > 0) {
        setSelectedId(nextConversations[0].id);
      }
    } catch (err) {
      console.error('Failed to load inbox:', err);
    }
  };

  const loadCounts = async () => {
    try {
      const c = await getInboxCounts(currentUser.teamIds[0]);
      setCounts(c);
    } catch (err) {
      console.error('Failed to load counts:', err);
    }
  };

  useEffect(() => {
    loadInbox();
    loadCounts();
  }, [filter]);

  const loadMessages = async (silent = false) => {
    if (!selectedId) return;
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await getMessages(selectedId);
      setMessages(res.messages || []);
      
      // Mark as read and update local state
      await markAsRead(selectedId);
      setConversations(prev => prev.map(c => 
        c.id === selectedId ? { ...c, unreadCount: 0 } : c
      ));
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      if (!silent) setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    loadMessages();
  }, [selectedId]);

  useEffect(() => {
    if (!socket) return;
    const onNewMessage = (payload) => {
      // Play notification sound for inbound messages
      if (payload && payload.direction === 'inbound') {
        try {
          const audio = new Audio('/notification.mp3');
          audio.play().catch(e => console.error('Error playing notification sound:', e));
        } catch (err) {
          console.error('Failed to initialize audio:', err);
        }
      }

      loadInbox();
      const currentId = selectedIdRef.current;
      if (currentId && payload && payload.conversationId === currentId) {
        // Mark as read immediately since we are viewing it
        markAsRead(currentId).catch(console.error);

        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.messageId)) return prev;
          return [
            ...prev,
            {
              id: payload.messageId,
              conversationId: payload.conversationId,
              direction: payload.direction,
              textBody: payload.textBody,
              contentType: payload.contentType || 'text',
              createdAt: payload.createdAt || new Date().toISOString(),
              rawPayload: payload.rawPayload || {},
              attachments: payload.attachments || [] // Handle optimistic attachments
            },
          ];
        });
      }
    };
    const onClaimed = () => loadInbox();
    const onReassigned = () => loadInbox();
    const onReleased = () => loadInbox();
    socket.on('message:new', onNewMessage);
    socket.on('assignment:claimed', onClaimed);
    socket.on('assignment:reassigned', onReassigned);
    socket.on('assignment:released', onReleased);
    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('assignment:claimed', onClaimed);
      socket.off('assignment:reassigned', onReassigned);
      socket.off('assignment:released', onReleased);
    };
  }, [socket, selectedId]);

  const handleClaim = async () => {
    if (!selectedId) return;
    await claimConversation(selectedId, currentUser.teamIds[0], currentUser.id);
    loadInbox();
  };

  const handleAssign = async (conversationId, assigneeUserId) => {
    if (!conversationId || !assigneeUserId) return;
    if (assigneeUserId === currentUser.id) {
      await claimConversation(conversationId, currentUser.teamIds[0], currentUser.id);
      loadInbox();
      return;
    }
    await reassignConversation(conversationId, currentUser.teamIds[0], assigneeUserId);
    loadInbox();
  };

  const handleUnassign = async (conversationId) => {
    if (!conversationId) return;
    await releaseConversation(conversationId);
    loadInbox();
  };

  const handleResolve = async () => {
    if (!selectedId) return;
    await resolveConversation(selectedId);
    loadInbox();
  };

  const handlePin = async (conversationId) => {
    await pinConversation(conversationId);
    loadInbox();
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const isAssignedToMe = Boolean(selectedConversation?.assigneeUserId && selectedConversation.assigneeUserId === currentUser.id);
  const isAssigned = Boolean(selectedConversation?.assigneeUserId);

  if (!isLoggedIn) {
    return <LoginPage onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-950 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-16 flex-none border-r border-slate-200 bg-white flex flex-col items-center py-4 space-y-4">
        <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl">
          M
        </div>
        <nav className="flex-1 flex flex-col items-center space-y-2 w-full px-2">
          <Button
            variant={activePage === 'dashboard' ? 'secondary' : 'ghost'}
            size="icon"
            className="w-10 h-10 rounded-lg"
            onClick={() => setActivePage('dashboard')}
          >
            <LayoutDashboard size={20} />
          </Button>
          <Button
            variant={activePage === 'inbox' ? 'secondary' : 'ghost'}
            size="icon"
            className="w-10 h-10 rounded-lg"
            onClick={() => setActivePage('inbox')}
          >
            <MessageSquare size={20} />
          </Button>
          <Button
            variant={activePage === 'team' ? 'secondary' : 'ghost'}
            size="icon"
            className="w-10 h-10 rounded-lg"
            onClick={() => setActivePage('team')}
          >
            <Users size={20} />
          </Button>
          <Button
            variant={activePage === 'templates' ? 'secondary' : 'ghost'}
            size="icon"
            className="w-10 h-10 rounded-lg"
            onClick={() => setActivePage('templates')}
          >
            <FileText size={20} />
          </Button>
        </nav>
        <div className="flex flex-col items-center space-y-2 pb-4 w-full px-2">
          <Button
            variant={activePage === 'settings' ? 'secondary' : 'ghost'}
            size="icon"
            className="w-10 h-10 rounded-lg"
            onClick={() => setActivePage('settings')}
          >
            <Settings size={20} />
          </Button>
           <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium">
             JD
           </div>
           <Button variant="ghost" size="icon" className="w-10 h-10 text-slate-500 hover:text-red-600" onClick={() => setIsLoggedIn(false)}>
             <LogOut size={20} />
           </Button>
        </div>
      </aside>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {activePage === 'dashboard' && <DashboardPage conversations={conversations} agents={agents} />}

        {activePage === 'team' && (
          <TeamPage
            conversations={conversations}
            agents={agents}
            currentUser={currentUser}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
          />
        )}

        {activePage === 'settings' && <SettingsPage />}

        {activePage === 'templates' && <TemplatesPage />}

        {activePage === 'inbox' && (
          <>
            <ConversationFilters activeFilter={filter} onSelectFilter={setFilter} counts={counts} />
            <div className="w-80 flex-none border-r border-slate-200 bg-white flex flex-col">
              <div className="h-16 border-b border-slate-200 flex items-center px-4 justify-between">
                <h1 className="font-semibold text-lg">Inbox</h1>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Search size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Bell size={16} />
                  </Button>
                </div>
              </div>
              <Inbox 
                conversations={conversations} 
                selectedId={selectedId} 
                onSelect={(id) => setSelectedId(id)} 
                onPin={handlePin}
              />
            </div>

            <main className="flex-1 flex flex-col min-w-0 bg-white">
              {selectedId && (
                <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-medium text-sm">
                      {selectedConversation?.contactName?.substring(0, 2).toUpperCase() || 'UN'}
                    </div>
                    <div>
                      <h2 className="font-semibold text-sm text-slate-900 leading-tight">
                        {selectedConversation?.contactName || 'Unknown Contact'}
                      </h2>
                      <p className="text-xs text-slate-500">
                        {selectedConversation?.status === 'open' ? 'Open Conversation' : 'Closed'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleResolve}>
                      Resolve
                    </Button>
                    <Button variant="outline" size="sm">
                      Snooze
                    </Button>
                    <div className="flex items-center gap-2">
                      <Badge variant={isAssigned ? 'secondary' : 'outline'}>
                        {isAssignedToMe ? 'Assigned to you' : isAssigned ? 'Assigned' : 'Unassigned'}
                      </Badge>
                      <select
                        className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
                        value={selectedConversation?.assigneeUserId || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (!value) {
                            handleUnassign(selectedId);
                            return;
                          }
                          handleAssign(selectedId, value);
                        }}
                      >
                        <option value="">Unassigned</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} ({a.role})
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={handleClaim}
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white"
                        disabled={isAssignedToMe}
                      >
                        Assign to me
                      </Button>
                      <Button onClick={() => handleUnassign(selectedId)} size="sm" variant="outline" disabled={!isAssigned}>
                        Unassign
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex-1 overflow-hidden relative">
                <Chat 
                  socket={socket} 
                  conversationId={selectedId} 
                  messages={messages} 
                  isLoading={isLoadingMessages}
                  onRefresh={() => loadMessages(true)} 
                />
              </div>
            </main>

            {selectedId && (
              <aside className="w-80 flex-none border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
                <div className="p-4 pb-2 flex-none">
                  <CustomerCard conversationId={selectedId} />
                </div>
                <div className="flex-1 min-h-0 p-4 pt-2">
                  <NotesPanel conversationId={selectedId} currentUser={currentUser} socket={socket} />
                </div>
              </aside>
            )}
          </>
        )}
      </div>
    </div>
  );
}
