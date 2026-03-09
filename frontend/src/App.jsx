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
import FlowsPage from './components/FlowsPage.jsx';
import WorkflowsKanban from './components/WorkflowsKanban.jsx';
import WorkflowBuilder from './components/WorkflowBuilder.jsx';
import RulesPage from './components/RulesPage.jsx';
import TeamMembersPage from './components/TeamMembersPage.jsx';
import ContactsPage from './components/ContactsPage.jsx';
import LabelsPage from './components/LabelsPage.jsx';
import CampaignsPage from './components/CampaignsPage.jsx';
import EmailTemplatesPage from './components/EmailTemplatesPage.jsx';
import LoginPage from './components/LoginPage.jsx';
import GuestChat from './components/GuestChat.jsx';
import InstagramPage from './components/InstagramPage.jsx';
import GalleryPage from './components/GalleryPage.jsx';
import LandingPage from './components/LandingPage.jsx';
import AiAgentPage from './components/AiAgentPage.jsx';
import { connectSocket } from './socket.js';
import { getInbox, getMessages, claimConversation, reassignConversation, forceReassignConversation, releaseConversation, markAsRead, resolveConversation, deleteConversation, blockConversation, unblockConversation, pinConversation, updateWorkflow, getTeamUser, getTeamUsers, reassignExternalLead, toggleAiForConversation } from './api.js';
import { LayoutDashboard, MessageSquare, Users, Megaphone, Settings, LogOut, Search, Bell, FileText, Workflow, Shield, ChevronsUpDown, Check, Zap, GitBranch, Instagram, ChevronDown, ChevronRight, Mail, Bot, ArrowRight, PauseCircle, PlayCircle } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { Toaster } from './components/ui/Toaster';

// The full list of valid pages in the app
const validPages = [
  'inbox', 'dashboard', 'contacts', 'labels', 'campaigns', 'templates', 
  'workflows', 'settings', 'profile', 'flows', 'payments', 'ai-agent'
];

export default function App() {
  const [storedUser, setStoredUser] = useState(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });
  const [isLoggedIn, setIsLoggedIn] = useState(!!storedUser);
  const [socket, setSocket] = useState(null);

  const [activePage, setActivePage] = useState(() => {
    const fullPath = window.location.pathname.substring(1);
    const path = fullPath.split('/')[0];

    // If we're not logged in and at root, we don't have an active app page yet
    if (!storedUser && !path) {
      return 'landing';
    }

    if (path && validPages.includes(path)) {
      return path;
    }
    return localStorage.getItem('activePage') || 'inbox';
  });

  const [isLoginView, setIsLoginView] = useState(() => {
    return window.location.pathname === '/login';
  });

  const [isContactsMenuOpen, setIsContactsMenuOpen] = useState(() => {
    const fullPath = window.location.pathname.substring(1);
    const path = fullPath.split('/')[0];
    return path === 'contacts' || path === 'labels';
  });

  const [editingWorkflow, setEditingWorkflow] = useState(() => {
    try {
      const fullPath = window.location.pathname.substring(1);
      const pathParts = fullPath.split('/');
      const saved = localStorage.getItem('editingWorkflow');
      const parsedSaved = saved ? JSON.parse(saved) : null;

      if (pathParts[0] === 'workflows' && pathParts[1]) {
        if (parsedSaved && String(parsedSaved.id) === pathParts[1]) {
          return parsedSaved;
        }
        return { id: pathParts[1], name: pathParts[1], steps: { nodes: [], edges: [] } };
      }
      return parsedSaved;
    } catch (e) {
      return null;
    }
  });

  useEffect(() => {
    if (!isLoggedIn) {
      if (isLoginView) {
        window.history.pushState(null, '', '/login');
      } else {
        window.history.pushState(null, '', '/');
      }
      return;
    }

    localStorage.setItem('activePage', activePage);
    let path = `/${activePage === 'inbox' ? '' : activePage}`;
    if (activePage === 'workflows' && editingWorkflow) {
      // Always use the real UUID so initialWorkflow.id is always the DB id
      const identifier = editingWorkflow.id || 'new';
      path = `/workflows/${identifier}`;
    }
    window.history.pushState(null, '', path);
  }, [activePage, editingWorkflow, isLoggedIn, isLoginView]);

  useEffect(() => {
    const handlePopState = () => {
      const fullPath = window.location.pathname.substring(1);
      const pathParts = fullPath.split('/');
      const path = pathParts[0];

      if (!isLoggedIn) {
        setIsLoginView(window.location.pathname === '/login');
        return;
      }

      if (path && validPages.includes(path)) {
        setActivePage(path);
      } else if (!path) {
        setActivePage('inbox');
      }
      if (path === 'workflows') {
        if (pathParts[1]) {
          setEditingWorkflow((prev) => {
            // Very simple check just to avoid unnecessary re-renders
            if (prev) return prev;
            return { id: pathParts[1], name: pathParts[1], steps: { nodes: [], edges: [] } };
          });
        } else {
          setEditingWorkflow(null);
        }
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (editingWorkflow) {
      localStorage.setItem('editingWorkflow', JSON.stringify(editingWorkflow));
    } else {
      localStorage.removeItem('editingWorkflow');
    }
  }, [editingWorkflow]);
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(() => {
    try {
      return localStorage.getItem('selectedConversationId') || null;
    } catch (e) {
      return null;
    }
  });
  const selectedIdRef = React.useRef(selectedId);
  const [messages, setMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [leadDebugData, setLeadDebugData] = useState(null);
  const [assigneeName, setAssigneeName] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [targetAssigneeId, setTargetAssigneeId] = useState(null);
  const [inboxFilter, setInboxFilter] = useState('open');

  useEffect(() => {
    if (selectedId) {
      const conv = conversations.find(c => c.id === selectedId);
      setTargetAssigneeId(conv?.assigneeUserId || null);
    }
  }, [selectedId, conversations]);

  useEffect(() => {
    if (!storedUser) return;
    getTeamUsers().then(res => {
      let data = [];
      if (res && res.data && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (res && Array.isArray(res.data)) {
        data = res.data;
      } else if (Array.isArray(res)) {
        data = res;
      }
      setTeamMembers(data);
    }).catch(err => console.error("Failed to fetch team members", err));
  }, [storedUser]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const setSelectedConversation = (id) => {
    setSelectedId(id);
    try {
      if (id) {
        localStorage.setItem('selectedConversationId', id);
      } else {
        localStorage.removeItem('selectedConversationId');
      }
    } catch (e) { }
  };

  const currentUser = useMemo(() => {
    if (storedUser) {
      const rawTeamIds = storedUser.teamId
        ? [storedUser.teamId]
        : Array.isArray(storedUser.teamIds) && storedUser.teamIds.length > 0
          ? storedUser.teamIds
          : ['b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22'];
      return {
        id: storedUser._id || storedUser.id,
        role: storedUser.role || 'agent',
        teamIds: rawTeamIds,
        name: `${storedUser.firstname || ''} ${storedUser.lastname || ''}`.trim() || storedUser.name || 'User'
      };
    }
    return null;
  }, [storedUser]);

  const handleLogin = (user) => {
    setStoredUser(user);
    setIsLoggedIn(true);
    setIsLoginView(false);
    setActivePage('dashboard');
    try {
      localStorage.setItem('activePage', 'dashboard');
    } catch (e) { }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('user');
    setStoredUser(null);
    setIsLoggedIn(false);
    window.location.href = '/';
  };
  const agents = useMemo(
    () => {
      if (!currentUser) return [];
      return [
        { id: currentUser.id, name: 'John Agent', role: currentUser.role, initials: 'JA' },
        { id: 'a1eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', name: 'Jane Supervisor', role: 'supervisor', initials: 'JS' },
        { id: 'a2eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', name: 'Mike Agent', role: 'agent', initials: 'MA' },
      ];
    },
    [currentUser]
  );

  useEffect(() => {
    if (!currentUser) {
      setSocket(null);
      return;
    }
    const s = connectSocket({ userId: currentUser.id, teamIds: currentUser.teamIds });
    setSocket(s);
    return () => {
      if (s) s.disconnect();
    };
  }, [currentUser]);

  const loadInbox = async () => {
    if (!currentUser) return;
    try {
      const res = await getInbox(currentUser.teamIds[0], 'all');
      const currentId = selectedIdRef.current;
      const nextConversations = (res.conversations || []).map(c => {
        const base = c.id === currentId ? { ...c, unreadCount: 0 } : c;
        return base;
      });
      setConversations(nextConversations);

      if (!currentId && nextConversations.length > 0) {
        setSelectedConversation(nextConversations[0].id);
      }
    } catch (err) {
      console.error('Failed to load inbox:', err);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [currentUser]);

  const filteredConversations = useMemo(() => {
    if (!conversations) return [];
    return conversations.filter(c => {
      // open: status open AND (has assignee OR unassigned)
      if (inboxFilter === 'open') {
        return c.status === 'open' || c.status === 'unassigned';
      }
      // pinned: isPinned true
      if (inboxFilter === 'pinned') {
        return c.isPinned;
      }
      // closed: status closed
      if (inboxFilter === 'closed') {
        return c.status === 'closed';
      }
      // unassigned: no assignee
      if (inboxFilter === 'unassigned') {
        return !c.assigneeUserId;
      }
      // all
      return true;
    });
  }, [conversations, inboxFilter]);

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
              attachments: payload.attachments || [],
              translation: payload.translation || null,
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

    // Listen for debug events from backend
    const onDebugLead = (data) => {
      console.log('Lead API Response:', data);
      setLeadDebugData(data);
      // Auto-hide after 10 seconds
      setTimeout(() => setLeadDebugData(null), 10000);
    };
    socket.on('debug:lead_api_response', onDebugLead);

    return () => {
      socket.off('message:new', onNewMessage);
      socket.off('assignment:claimed', onClaimed);
      socket.off('assignment:reassigned', onReassigned);
      socket.off('assignment:released', onReleased);
      socket.off('debug:lead_api_response', onDebugLead);
    };
  }, [socket, selectedId]);

  const handleClaim = async () => {
    if (!selectedId) return;
    await claimConversation(selectedId, currentUser.teamIds[0], currentUser.id);
    loadInbox();
  };

  const handleAssign = async (conversationId, assigneeUserId) => {
    if (!conversationId || !assigneeUserId) return;

    try {
      // Optimistic update
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId ? { ...c, assigneeUserId } : c
        )
      );

      // Ensure we have a valid teamId
      const teamId = (currentUser?.teamIds && currentUser.teamIds.length > 0)
        ? currentUser.teamIds[0]
        : 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22';

      if (assigneeUserId === currentUser.id) {
        await claimConversation(conversationId, teamId, currentUser.id);
      } else {
        const conversation = conversations.find(c => c.id === conversationId);
        const isReassignment = conversation && conversation.assigneeUserId;

        if (isReassignment) {
          // Use specific reassign endpoint to force admin role
          await forceReassignConversation(conversationId, teamId, assigneeUserId);
        } else {
          await reassignConversation(conversationId, teamId, assigneeUserId);
        }
      }
      loadInbox();
    } catch (err) {
      console.error('Failed to assign conversation:', err);
      loadInbox();
    }
  };

  const handleExternalReassign = async () => {
    if (!selectedId) return;

    // Unassign case
    if (!targetAssigneeId) {
      await handleUnassign(selectedId);
      return;
    }

    const conversation = conversations.find(c => c.id === selectedId);
    if (!conversation) return;

    if (conversation.leadId) {
      try {
        const res = await reassignExternalLead(conversation.leadId, targetAssigneeId);
        console.log('External reassign response:', res);

        // Check for success - assuming standard API response structure or just successful execution
        if (res && res.success) {
          await handleAssign(selectedId, targetAssigneeId);
        }
      } catch (err) {
        console.error('Failed to reassign external lead:', err);
        alert('Failed to reassign external lead');
      }
    } else {
      // Fallback for conversations without leadId
      await handleAssign(selectedId, targetAssigneeId);
    }
  };

  const handleUnassign = async (conversationId) => {
    if (!conversationId) return;
    await releaseConversation(conversationId);
    loadInbox();
  };

  const handleResolve = async (id) => {
    const targetId = typeof id === 'string' ? id : selectedId;
    if (!targetId) return;
    try {
      await resolveConversation(targetId);
      loadInbox();
    } catch (err) {
      console.error('Failed to resolve conversation:', err);
    }
  };

  const handleLeadStageUpdated = (conversationId, leadStage) => {
    if (!conversationId) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, leadStage: leadStage || null } : c))
    );
  };

  const handleToggleBlock = async () => {
    if (!selectedConversation) return;
    const conversationId = selectedConversation.id;
    const isBlocked = selectedConversation.blocked === true;
    try {
      if (isBlocked) {
        await unblockConversation(conversationId);
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, blocked: false } : c))
        );
      } else {
        await blockConversation(conversationId);
        setConversations(prev =>
          prev.map(c => (c.id === conversationId ? { ...c, blocked: true } : c))
        );
      }
    } catch (err) {
      console.error('Failed to toggle block:', err);
    }
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!conversationId) return;
    const confirmed = window.confirm('Delete this conversation and all its messages? This cannot be undone.');
    if (!confirmed) return;
    try {
      await deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (selectedId === conversationId) {
        setSelectedConversation(null);
        setMessages([]);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const handleToggleAi = async () => {
    if (!selectedConversation) return;
    
    // Toggle logic: If currently active, set to false (pause). If inactive, set to true (resume).
    // Note: is_ai_active can be null/undefined (default true), so we treat falsy as active unless explicitly false.
    const currentStatus = selectedConversation.is_ai_active !== false;
    const newStatus = !currentStatus;

    try {
      await toggleAiForConversation(selectedConversation.id, newStatus);
      // Optimistic update
      setConversations(prev => 
        prev.map(c => c.id === selectedConversation.id ? { ...c, is_ai_active: newStatus } : c)
      );
    } catch (err) {
      console.error('Failed to toggle AI:', err);
    }
  };

  const handlePin = async (conversationId) => {
    try {
      await pinConversation(conversationId);
      loadInbox();
    } catch (err) {
      console.error('Failed to pin conversation:', err);
    }
  };

  const handleWorkflowSave = async (workflowJson) => {
    try {
      if (editingWorkflow && editingWorkflow.id) {
        const updatedWorkflow = {
          ...editingWorkflow,
          steps: workflowJson
        };
        await updateWorkflow(editingWorkflow.id, updatedWorkflow);
        // CRITICAL: update local state so that refreshing the page restores all nodes
        setEditingWorkflow(updatedWorkflow);
      }
    } catch (err) {
      console.error('Failed to save workflow:', err);
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId);
  const isAssignedToMe = Boolean(selectedConversation?.assigneeUserId && selectedConversation.assigneeUserId === currentUser.id);
  const isAssigned = Boolean(selectedConversation?.assigneeUserId);

  const getUserName = (user) => {
    if (!user) return 'Unknown Agent';
    if (user.firstname || user.lastname) {
      return `${user.firstname || ''} ${user.lastname || ''}`.trim();
    }
    return user.name || user.username || 'Unknown Agent';
  };

  useEffect(() => {
    if (!isAssigned || !selectedConversation?.assigneeUserId) {
      setAssigneeName(null);
      return;
    }

    const userId = selectedConversation.assigneeUserId;
    // Check if local agent
    const localAgent = agents.find(a => a.id === userId);
    if (localAgent) {
      setAssigneeName(localAgent.name);
      return;
    }

    // Check if in teamMembers list already
    const member = teamMembers.find(m => m.id === userId || m._id === userId);
    if (member) {
      setAssigneeName(getUserName(member));
      return;
    }

    // Immediate fallback from targetAssigneeId if available (for instant feedback during assignment)
    if (targetAssigneeId === userId) {
      const targetMember = teamMembers.find(m => m.id === targetAssigneeId || m._id === targetAssigneeId);
      if (targetMember) {
        setAssigneeName(getUserName(targetMember));
        return;
      }
    }

    // Fetch external
    let isMounted = true;
    getTeamUser(userId)
      .then(res => {
        if (!isMounted) return;
        const user = res.data || res;
        const name = getUserName(user);
        setAssigneeName(name);
      })
      .catch(err => {
        if (!isMounted) return;
        console.error('Failed to fetch assignee:', err);
        setAssigneeName('Unknown Agent');
      });

    return () => { isMounted = false; };
  }, [selectedConversation?.assigneeUserId, isAssigned, agents, teamMembers]);

  if (!isLoggedIn) {
    if (isLoginView) {
      return <LoginPage onLogin={handleLogin} />;
    }
    return <LandingPage onLoginClick={() => setIsLoginView(true)} />;
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 text-slate-950 font-sans">
      {/* Sidebar Navigation */}
      <aside className="group w-16 hover:w-64 transition-all duration-300 ease-in-out flex-none border-r border-slate-200 bg-white flex flex-col py-4 space-y-4 relative z-50">
        <div className="flex items-center justify-start h-10 w-full px-3">
          <div className="h-10 w-10 min-w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shrink-0">
            M
          </div>
          <span className="ml-3 font-semibold text-xl whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 flex-1 text-slate-900">
            Menu
          </span>
        </div>
        <nav className="flex-1 flex flex-col space-y-2 w-full px-3 overflow-hidden">
          <Button
            variant={activePage === 'dashboard' ? 'secondary' : 'ghost'}
            className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
            onClick={() => setActivePage('dashboard')}
            title="Dashboard"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <LayoutDashboard size={20} />
            </div>
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
              Dashboard
            </span>
          </Button>

          <Button
            variant={activePage === 'inbox' ? 'secondary' : 'ghost'}
            className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
            onClick={() => setActivePage('inbox')}
            title="Inbox"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <MessageSquare size={20} />
            </div>
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
              Inbox
            </span>
          </Button>

          <div className="flex flex-col space-y-1">
            <Button
              variant={['contacts', 'labels'].includes(activePage) ? 'secondary' : 'ghost'}
              className="w-full flex items-center justify-between h-10 px-0 rounded-lg overflow-hidden shrink-0"
              onClick={() => setIsContactsMenuOpen(!isContactsMenuOpen)}
              title="Contacts Menu"
            >
              <div className="flex items-center">
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Users size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-left">
                  Contacts
                </span>
              </div>
              <div className="pr-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 flex items-center shrink-0">
                {isContactsMenuOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </div>
            </Button>

            {isContactsMenuOpen && (
              <div className="pl-10 space-y-1 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                <Button
                  variant={activePage === 'contacts' ? 'secondary' : 'ghost'}
                  className="w-full flex items-center justify-start h-8 px-3 rounded-lg text-sm text-slate-600 hover:text-slate-900"
                  onClick={() => setActivePage('contacts')}
                  title="All Contacts"
                >
                  All Contacts
                </Button>
                <Button
                  variant={activePage === 'labels' ? 'secondary' : 'ghost'}
                  className="w-full flex items-center justify-start h-8 px-3 rounded-lg text-sm text-slate-600 hover:text-slate-900"
                  onClick={() => setActivePage('labels')}
                  title="Labels"
                >
                  Labels
                </Button>
              </div>
            )}
          </div>

          <Button
            variant={activePage === 'campaigns' ? 'secondary' : 'ghost'}
            className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
            onClick={() => setActivePage('campaigns')}
            title="Campaigns"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <Megaphone size={20} />
            </div>
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
              Campaigns
            </span>
          </Button>
          {['admin', 'super_admin'].includes((currentUser.role || '').toLowerCase()) && (
            <>
              <Button
                variant={activePage === 'team-members' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('team-members')}
                title="Team Members"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Shield size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  Team Members
                </span>
              </Button>

              <Button
                variant={activePage === 'templates' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('templates')}
                title="Templates"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  Templates
                </span>
              </Button>

              <Button
                variant={activePage === 'email-templates' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('email-templates')}
                title="Email Templates"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Mail size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  Email Templates
                </span>
              </Button>
              <Button
                variant={activePage === 'flows' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('flows')}
                title="Flows"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <GitBranch size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  Flows
                </span>
              </Button>
              <Button
                variant={activePage === 'workflows' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('workflows')}
                title="Workflows"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Workflow size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  Workflows
                </span>
              </Button>

              <Button
                variant={activePage === 'ai-agent' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('ai-agent')}
                title="AI Agent"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Bot size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  AI Agent
                </span>
              </Button>

              <Button
                variant={activePage === 'rules' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('rules')}
                title="Rules"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Zap size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  Rules
                </span>
              </Button>
              <Button
                variant={activePage === 'instagram' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('instagram')}
                title="Instagram Integration"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <Instagram size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  Instagram
                </span>
              </Button>
              <Button
                variant={activePage === 'gallery' ? 'secondary' : 'ghost'}
                className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
                onClick={() => setActivePage('gallery')}
                title="Gallery Media File Manager"
              >
                <div className="w-10 h-10 flex items-center justify-center shrink-0">
                  <FileText size={20} />
                </div>
                <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
                  File Manager
                </span>
              </Button>
            </>
          )}


        </nav>
        <div className="flex flex-col space-y-2 pb-4 w-full px-3 overflow-hidden">
          <Button
            variant={activePage === 'settings' ? 'secondary' : 'ghost'}
            className="w-full flex items-center justify-start h-10 px-0 rounded-lg overflow-hidden shrink-0"
            onClick={() => setActivePage('settings')}
            title="Settings"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <Settings size={20} />
            </div>
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
              Settings
            </span>
          </Button>
          <div className="w-full flex items-center justify-start h-10 px-0 shrink-0">
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center text-xs font-medium text-slate-700">
                {currentUser?.name?.substring(0, 2).toUpperCase() || 'JD'}
              </div>
            </div>
            <span className="ml-3 text-sm font-medium text-slate-700 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
              {currentUser?.name || 'Profile'}
            </span>
          </div>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-start h-10 px-0 rounded-lg text-slate-400 hover:text-red-600 overflow-hidden shrink-0"
            onClick={handleLogout}
            title="Log Out"
          >
            <div className="w-10 h-10 flex items-center justify-center shrink-0">
              <LogOut size={20} />
            </div>
            <span className="ml-3 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100">
              Log Out
            </span>
          </Button>
        </div>
      </aside>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {activePage === 'dashboard' && <DashboardPage teamId={currentUser.teamIds[0]} role={currentUser.role} />}

        {activePage === 'team' && (
          <TeamPage
            conversations={conversations}
            agents={agents}
            currentUser={currentUser}
            onAssign={handleAssign}
            onUnassign={handleUnassign}
          />
        )}

        {activePage === 'settings' && <SettingsPage currentUser={currentUser} />}

        {activePage === 'templates' && <TemplatesPage />}
        {activePage === 'email-templates' && <EmailTemplatesPage />}
        {activePage === 'create-template' && <EmailTemplatesPage startCreate={true} />}
        {activePage === 'flows' && <FlowsPage />}

        {activePage === 'workflows' && (
          editingWorkflow ? (
            <WorkflowBuilder
              initialWorkflow={editingWorkflow}
              onBack={() => setEditingWorkflow(null)}
              onSave={handleWorkflowSave}
            />
          ) : (
            <WorkflowsKanban
              currentUser={currentUser}
              onOpenBuilder={(wf) => setEditingWorkflow(wf)}
            />
          )
        )}

        {activePage === 'rules' && <RulesPage />}

        {activePage === 'instagram' && <InstagramPage />}
        {activePage === 'gallery' && <GalleryPage />}
        {activePage === 'ai-agent' && <AiAgentPage />}

        {activePage === 'team-members' && <TeamMembersPage />}
        {activePage === 'contacts' && <ContactsPage />}
        {activePage === 'labels' && <LabelsPage />}
        {activePage === 'campaigns' && <CampaignsPage />}

        {activePage === 'inbox' && (
          <>
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
                conversations={filteredConversations}
                selectedId={selectedId}
                onSelect={(id) => setSelectedConversation(id)}
                onPin={handlePin}
                onResolve={handleResolve}
                onDelete={handleDeleteConversation}
                currentUser={currentUser}
                filter={inboxFilter}
                setFilter={setInboxFilter}
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
                        {selectedConversation?.status === 'closed' ? 'Closed' : 'Open Conversation'}
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
                    <Button
                      variant={selectedConversation?.blocked ? "destructive" : "outline"}
                      size="sm"
                      onClick={handleToggleBlock}
                    >
                      {selectedConversation?.blocked ? 'Unblock' : 'Block'}
                    </Button>
                    <div className="flex items-center gap-2">
                      {isAssigned ? (
                        <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-md border border-slate-200">
                          <span className="text-xs font-medium text-slate-500">Assigned to:</span>
                          <span className="text-sm font-semibold text-slate-900">
                            {assigneeName || 'Unknown Agent'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Unassigned</Badge>
                          {/* Manual assignment disabled as per requirements */}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Status Banner & Controls */}
              {selectedConversation && (
                 <div className={`border-b px-4 py-2 flex items-center justify-between transition-colors ${
                    selectedConversation.is_ai_active !== false 
                      ? 'bg-purple-50 border-purple-100' 
                      : 'bg-slate-50 border-slate-200'
                 }`}>
                    <div className="flex items-center gap-2">
                       <div className="relative">
                         <Bot size={16} className={selectedConversation.is_ai_active !== false ? "text-purple-600" : "text-slate-400"} />
                         {selectedConversation.is_ai_active !== false && (
                           <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white animate-pulse"></span>
                         )}
                       </div>
                       <span className={`text-xs font-medium ${
                          selectedConversation.is_ai_active !== false ? "text-purple-700" : "text-slate-500"
                       }`}>
                          {selectedConversation.is_ai_active !== false 
                            ? "AI is active (Replying automatically)" 
                            : "AI is paused (Manual mode)"}
                       </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                         size="sm" 
                         variant="ghost"
                         className={`h-7 text-xs border shadow-sm gap-2 ${
                            selectedConversation.is_ai_active !== false
                              ? "bg-white text-red-600 border-red-100 hover:bg-red-50"
                              : "bg-white text-green-600 border-green-100 hover:bg-green-50"
                         }`}
                         onClick={handleToggleAi}
                         title={selectedConversation.is_ai_active !== false ? "Stop AI from replying" : "Let AI handle replies"}
                      >
                         {selectedConversation.is_ai_active !== false ? (
                           <>
                             <PauseCircle size={14} />
                             Pause AI
                           </>
                         ) : (
                           <>
                             <PlayCircle size={14} />
                             Resume AI
                           </>
                         )}
                      </Button>
                      
                      {!isAssigned && (
                        <Button 
                           size="sm" 
                           className="h-7 text-xs bg-purple-600 hover:bg-purple-700 text-white border-none shadow-sm gap-2"
                           onClick={() => handleAssign(currentUser.id)}
                        >
                           <span>Take Over</span>
                           <ArrowRight size={12} />
                        </Button>
                      )}
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
                <div className="p-4 pb-0 flex-none space-y-3">
                  <Card className="shadow-sm border-slate-200">
                    <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-slate-500" />
                        <CardTitle className="text-sm font-semibold text-slate-900">Assignment</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-500">Reassign to</label>
                        <div className="relative">
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={isAssigneeOpen}
                            className="w-full justify-between text-left font-normal px-3 py-2 h-auto"
                            onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                          >
                            <span className="truncate">
                              {targetAssigneeId
                                ? (targetAssigneeId === selectedConversation?.assigneeUserId
                                  ? (assigneeName || getUserName(teamMembers.find(u => (u.id || u._id) === targetAssigneeId)))
                                  : getUserName(teamMembers.find(u => (u.id || u._id) === targetAssigneeId) || agents.find(a => a.id === targetAssigneeId)))
                                : "Unassigned"}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>

                          {isAssigneeOpen && (
                            <>
                              <div
                                className="fixed inset-0 z-40 bg-transparent"
                                onClick={() => setIsAssigneeOpen(false)}
                              />
                              <div className="absolute z-50 mt-1 max-h-60 w-full overflow-hidden rounded-md border border-slate-200 bg-white text-slate-950 shadow-md">
                                <div className="sticky top-0 z-10 bg-white p-2 border-b border-slate-100">
                                  <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-3 w-3 text-slate-500" />
                                    <input
                                      className="w-full rounded-md border border-slate-200 bg-transparent px-2 py-1.5 pl-7 text-xs placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      placeholder="Search team..."
                                      value={assigneeSearch}
                                      onChange={(e) => setAssigneeSearch(e.target.value)}
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div className="max-h-48 overflow-y-auto py-1">
                                  <div
                                    className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                                    onClick={() => {
                                      setTargetAssigneeId(null);
                                      setIsAssigneeOpen(false);
                                    }}
                                  >
                                    <span className="flex-1 truncate text-slate-500 italic">Unassigned</span>
                                    {!targetAssigneeId && <Check className="ml-auto h-4 w-4" />}
                                  </div>

                                  {teamMembers
                                    .filter(user =>
                                      !assigneeSearch ||
                                      (getUserName(user) || '').toLowerCase().includes(assigneeSearch.toLowerCase()) ||
                                      (user.role || '').toLowerCase().includes(assigneeSearch.toLowerCase())
                                    )
                                    .map((user) => {
                                      const userId = user.id || user._id;
                                      return (
                                        <div
                                          key={userId}
                                          className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-2 text-sm outline-none hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                          onClick={() => {
                                            setTargetAssigneeId(userId);
                                            setIsAssigneeOpen(false);
                                          }}
                                        >
                                          <div className="flex flex-col">
                                            <span className="font-medium truncate">{getUserName(user)}</span>
                                            <span className="text-xs text-slate-500 capitalize">{user.role}</span>
                                          </div>
                                          {targetAssigneeId === userId && (
                                            <Check className="ml-auto h-4 w-4 text-blue-600" />
                                          )}
                                        </div>
                                      )
                                    })}
                                  {teamMembers.length === 0 && (
                                    <div className="px-2 py-4 text-center text-xs text-slate-500">
                                      No team members found
                                    </div>
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={handleExternalReassign}
                        >
                          Re Assign
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="p-4 pb-2 flex-none">
                  <CustomerCard
                    conversationId={selectedId}
                    onLeadStageUpdated={(leadStage) => handleLeadStageUpdated(selectedId, leadStage)}
                  />
                </div>
                <div className="flex-1 flex flex-col min-h-0 p-4 pt-2">
                  <NotesPanel conversationId={selectedId} currentUser={currentUser} socket={socket} />
                </div>
              </aside>
            )}
            {/* Lead API Debug Overlay */}
            {leadDebugData && (
              <div className="fixed bottom-4 right-4 z-50 w-96 bg-white border border-green-200 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-green-50 px-4 py-2 border-b border-green-100 flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-green-800">New Lead Created</h3>
                  <button
                    onClick={() => setLeadDebugData(null)}
                    className="text-green-600 hover:text-green-800"
                  >
                    ×
                  </button>
                </div>
                <div className="p-4 max-h-96 overflow-auto">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono">
                    {JSON.stringify(leadDebugData, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <Toaster />
    </div>
  );
}
