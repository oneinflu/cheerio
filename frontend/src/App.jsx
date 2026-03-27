'use strict';
import React, { useEffect, useMemo, useRef, useState } from 'react';

/* ─── Splash / Preloader ────────────────────────────────────────────── */
function Preloader({ onDone }) {
  // phase: 'enter' → 'shake' → 'logo' → 'out'
  const [phase, setPhase] = useState('enter');
  const doneRef = useRef(false);

  useEffect(() => {
    // favicon enters (0–600ms), then shakes (600–1700ms)
    const t1 = setTimeout(() => setPhase('shake'), 600);
    // logo fades in at 1700ms
    const t2 = setTimeout(() => setPhase('logo'),  1700);
    // overlay fades out at 2700ms, done at 3100ms
    const t3 = setTimeout(() => setPhase('out'),   2700);
    const t4 = setTimeout(() => {
      if (!doneRef.current) { doneRef.current = true; onDone(); }
    }, 3100);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onDone]);

  const overlayStyle = {
    position: 'fixed', inset: 0, zIndex: 99999,
    background: '#080810',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'opacity 0.45s ease',
    opacity: phase === 'out' ? 0 : 1,
    pointerEvents: phase === 'out' ? 'none' : 'all',
  };

  return (
    <div style={overlayStyle}>
      {/* Subtle glow behind icon */}
      <div style={{
        position: 'absolute', width: 260, height: 260, borderRadius: '50%',
        background: 'radial-gradient(50% 50% at 50% 50%, rgba(0,230,118,0.14) 0%, transparent 100%)',
        filter: 'blur(30px)',
        transition: 'opacity 0.5s',
        opacity: phase === 'logo' ? 0.6 : 0.4,
      }} />

      {/* Favicon — shows during enter + shake phases */}
      {phase !== 'logo' && (
        <img
          src="/favicon.png"
          alt="Greeto"
          style={{
            width: 80, height: 80,
            objectFit: 'contain',
            position: 'absolute',
            animation: phase === 'enter'
              ? 'favicon-enter 0.55s cubic-bezier(0.34,1.56,0.64,1) forwards'
              : 'handshake 1.1s ease-in-out forwards',
          }}
        />
      )}

      {/* Logo — fades in replacing favicon */}
      {phase === 'logo' && (
        <img
          src="/logo.svg"
          alt="Greeto"
          style={{
            height: 44,
            objectFit: 'contain',
            filter: 'brightness(0) invert(1)',
            opacity: 0.92,
            position: 'absolute',
            animation: 'logo-enter 0.65s cubic-bezier(0.34,1.2,0.64,1) forwards',
          }}
        />
      )}
    </div>
  );
}
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
import TelegramPage from './components/TelegramPage.jsx';
import GalleryPage from './components/GalleryPage.jsx';
import LandingPage from './components/LandingPage.jsx';
import AiAgentPage from './components/AiAgentPage.jsx';
import CallsPage from './components/CallsPage.jsx';
import SmsPage from './components/SmsPage.jsx';
import EmailPage from './components/EmailPage.jsx';
import OnboardingTour from './components/OnboardingTour.jsx';
import ReportsPage from './components/ReportsPage.jsx';
import { connectSocket } from './socket.js';
import { getInbox, getInboxCounts, getMessages, claimConversation, reassignConversation, forceReassignConversation, releaseConversation, markAsRead, resolveConversation, deleteConversation, blockConversation, unblockConversation, pinConversation, updateWorkflow, getTeamUser, getTeamUsers, reassignExternalLead, toggleAiForConversation, completeOnboarding } from './api.js';
import { LayoutDashboard, MessageSquare, Users, Megaphone, Settings, LogOut, Search, Bell, FileText, Workflow, Shield, ChevronsUpDown, Check, Zap, GitBranch, Instagram, ChevronDown, ChevronRight, Mail, Bot, ArrowRight, PauseCircle, PlayCircle, Puzzle, Phone, BarChart3 } from 'lucide-react';
import { Button } from './components/ui/Button';
import { Badge } from './components/ui/Badge';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/Card';
import { Toaster } from './components/ui/Toaster';

// The full list of valid pages in the app
const validPages = [
  'inbox', 'dashboard', 'contacts', 'labels', 'campaigns', 'templates', 
  'workflows', 'settings', 'profile', 'flows', 'payments', 'ai-agent', 'reports'
];

export default function App() {
  // Only show preloader on public landing/login — skip if user is already logged in
  const [showPreloader, setShowPreloader] = useState(() => !localStorage.getItem('user'));
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
        document.title = 'Sign In to Greeto — AI-Powered Customer Messaging';
      } else {
        window.history.pushState(null, '', '/');
        document.title = 'Greeto — Customer Conversations on Autopilot | WhatsApp & AI Inbox';
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

    // Update browser tab title with SEO-friendly names
    const pageTitles = {
      inbox:           'Inbox — Manage Customer Conversations',
      dashboard:       'Dashboard — Analytics & Live Metrics',
      contacts:        'Contacts — Customer Directory',
      labels:          'Labels — Organize Conversations',
      campaigns:       'Campaigns — Broadcast & Marketing',
      templates:       'Message Templates — WhatsApp Templates',
      'email-templates':'Email Templates — Greeto',
      flows:           'Flows — WhatsApp Interactive Flows',
      workflows:       'Workflows — No-Code Automation Builder',
      rules:           'Automation Rules — Smart Triggers',
      'ai-agent':      'AI Agent — Intelligent Auto-Replies',
      'team-members':  'Team Members — Manage Your Team',
      settings:        'Integrations — Connect Your Tools',
      instagram:       'Instagram — Social Inbox',
      telegram:        'Telegram — Bot Inbox',
      calls:           'Calls — Exotel VoIP',
      sms:             'SMS — Twilio Messaging',
      email:           'Email — IMAP/SMTP Inbox',
      gallery:         'File Manager — Media Assets',
      reports:         'Reports — Workflow Performance & Traces',
    };
    document.title = pageTitles[activePage] ? `${pageTitles[activePage]} | Greeto` : 'Greeto';
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
  const [phoneNumberId, setPhoneNumberId] = useState(null);
  const [linkedPhones, setLinkedPhones] = useState([]);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [inboxCounts, setInboxCounts] = useState({ all: 0, unassigned: 0, assigned_to_me: 0, pinned: 0, resolved: 0 });

  useEffect(() => {
    if (storedUser && storedUser.attributes?.onboarding_v3 !== true) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [storedUser]);

  const handleOnboardingComplete = async () => {
    try {
      // Use the shared API function which correctly handles headers and token
      await completeOnboarding();

      setShowOnboarding(false);
      const updatedUser = { 
        ...storedUser, 
        attributes: { ...(storedUser.attributes || {}), onboarding_v3: true } 
      };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setStoredUser(updatedUser);
    } catch (err) {
      console.error('Failed to complete onboarding:', err);
      setShowOnboarding(false);
    }
  };

  useEffect(() => {
    if (!storedUser) return;
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings/whatsapp');
        if (res.ok) {
          const data = await res.json();
          setLinkedPhones(data.allSettings || []);
        }
      } catch (e) {
        console.error("Failed to fetch linked phones", e);
      }
    };
    fetchSettings();
  }, [storedUser]);

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

      // Self-heal user role if out of sync
      const me = data.find(m => String(m.id) === String(storedUser.id) || String(m._id) === String(storedUser.id));
      if (me && me.role) {
        const roleMap = {
          'super_admin': 'super_admin',
          'admin': 'admin',
          'team_lead': 'supervisor',
          'agent': 'agent',
          'quality_manager': 'quality_manager'
        };
        const mappedRole = roleMap[me.role] || me.role || 'agent';
        // Check if there is a mismatch on the role that requires an update
        if (mappedRole !== storedUser.role) {
          const updated = { ...storedUser, role: mappedRole };
          localStorage.setItem('user', JSON.stringify(updated));
          setStoredUser(updated);
        }
      }
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
    setShowPreloader(false); // always kill preloader before entering app
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

  const loadInboxCounts = async () => {
    if (!currentUser) return;
    try {
      const res = await getInboxCounts(currentUser.teamIds[0]);
      setInboxCounts(res);
      if (res && typeof res.unread === 'number') {
        setTotalUnread(res.unread);
      }
    } catch (err) {
      console.error('Failed to load inbox counts:', err);
    }
  };

  const loadInbox = async () => {
    if (!currentUser) return;
    try {
      const res = await getInbox(currentUser.teamIds[0], inboxFilter, phoneNumberId);
      const currentId = selectedIdRef.current;
      const nextConversations = (res.conversations || []).map(c => {
        const base = c.id === currentId ? { ...c, unreadCount: 0 } : c;
        return base;
      });
      setConversations(nextConversations);

      if (!currentId && nextConversations.length > 0) {
        setSelectedConversation(nextConversations[0].id);
      }
      // Also reload counts when inbox loads
      loadInboxCounts();
    } catch (err) {
      console.error('Failed to load inbox:', err);
    }
  };

  useEffect(() => {
    loadInbox();
  }, [currentUser, inboxFilter, phoneNumberId]);

  useEffect(() => {
    loadInboxCounts();
    const interval = setInterval(loadInboxCounts, 30000);
    return () => clearInterval(interval);
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
  
  const instagramUnread = useMemo(() => {
    if (!conversations) return 0;
    return conversations
      .filter(c => c.channelType === 'instagram')
      .reduce((sum, c) => sum + (Number(c.unreadCount) || 0), 0);
  }, [conversations]);

  const loadMessages = async (silent = false) => {
    if (!selectedId) return;
    if (!silent) setIsLoadingMessages(true);
    try {
      const res = await getMessages(selectedId);
      setMessages(res.messages || []);

      // Mark as read and update local state
      await markAsRead(selectedId);
      loadInboxCounts();
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
        markAsRead(currentId).then(() => loadInboxCounts()).catch(console.error);

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
      loadInboxCounts();
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
          trigger: workflowJson.trigger,
          nodes: workflowJson.nodes,
          edges: workflowJson.edges,
          steps: workflowJson // Keep steps for legacy or local state usage
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

  // ── Sidebar helpers ────────────────────────────────────────────────────────
  const navActive = (page) => Array.isArray(page) ? page.includes(activePage) : activePage === page;
  const navBtn = (page) => ({
    display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
    width: '100%', height: 40, padding: 0, border: 'none', cursor: 'pointer',
    borderRadius: 10, overflow: 'hidden', flexShrink: 0, position: 'relative',
    background: navActive(page) ? 'rgba(0,230,118,0.1)' : 'transparent',
    color: navActive(page) ? '#00E676' : 'rgba(255,255,255,0.5)',
    borderLeft: navActive(page) ? '2px solid #00E676' : '2px solid transparent',
    boxShadow: navActive(page) ? 'inset 0 0 20px rgba(0,230,118,0.06)' : 'none',
    transition: 'all 0.2s ease',
  });

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100%', background: '#0d0d18', color: '#ffffff', fontFamily: 'inherit' }}>
      {/* Sidebar Navigation */}
      <aside className="group" style={{
        width: 64, minWidth: 64, flexShrink: 0,
        background: '#08080f',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column', paddingTop: 16, paddingBottom: 16,
        position: 'relative', zIndex: 50, overflow: 'visible',
        transition: 'width 0.3s ease',
      }}
      onMouseEnter={e => e.currentTarget.style.width = '240px'}
      onMouseLeave={e => e.currentTarget.style.width = '64px'}
      >
        {/* Green glow orb at bottom */}
        <div style={{
          position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200, borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(50% 50% at 50% 100%, rgba(0,230,118,0.12) 0%, transparent 100%)',
          filter: 'blur(20px)',
        }} />
        {/* Top green accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(0,230,118,0.4), transparent)',
        }} />

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', height: 40, width: '100%', padding: '0 12px', marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, minWidth: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <img src="/favicon.png" alt="Logo" style={{ height: 36, width: 36, objectFit: 'contain' }} />
          </div>
          <span className="whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 flex-1" style={{ marginLeft: 10 }}>
            <img src="/logo.svg" alt="Greeto" style={{ height: 26, objectFit: 'contain', filter: 'brightness(0) invert(1)', opacity: 0.9 }} />
          </span>
        </div>

        <nav className="no-scrollbar" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, width: '100%', padding: '0 10px', overflowY: 'auto', overflowX: 'hidden' }}>
          <button id="nav-dashboard" style={navBtn('dashboard')} onClick={() => setActivePage('dashboard')} title="Dashboard">
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <LayoutDashboard size={18} />
            </div>
            <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Dashboard</span>
          </button>

          <button id="tour-nav-inbox" style={navBtn('inbox')} onClick={() => setActivePage('inbox')} title="Inbox">
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
              <MessageSquare size={18} />
              {Number(totalUnread) > 0 && (
                <span style={{ position: 'absolute', top: 4, right: 4, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, height: 14, minWidth: 14, padding: '0 3px', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </div>
            <span className="whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 flex-1 text-sm font-medium" style={{ marginLeft: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: 12 }}>
              <span>Inbox</span>
              {Number(totalUnread) > 0 && (
                <span style={{ background: '#ef4444', color: '#fff', padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700 }}>{totalUnread}</span>
              )}
            </span>
          </button>

          {/* Contacts with sub-menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <button style={{...navBtn(['contacts','labels']), justifyContent: 'space-between'}} onClick={() => setIsContactsMenuOpen(!isContactsMenuOpen)} title="Contacts">
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Users size={18} />
                </div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Contacts</span>
              </div>
              <span className="whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 pr-3">
                {isContactsMenuOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
              </span>
            </button>
            {isContactsMenuOpen && (
              <div className="whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100" style={{ paddingLeft: 40, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button style={{ background: activePage === 'contacts' ? 'rgba(0,230,118,0.08)' : 'transparent', color: activePage === 'contacts' ? '#00E676' : 'rgba(255,255,255,0.45)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 12px', fontSize: 13, textAlign: 'left', width: '100%' }} onClick={() => setActivePage('contacts')}>All Contacts</button>
                <button style={{ background: activePage === 'labels' ? 'rgba(0,230,118,0.08)' : 'transparent', color: activePage === 'labels' ? '#00E676' : 'rgba(255,255,255,0.45)', border: 'none', cursor: 'pointer', borderRadius: 8, padding: '6px 12px', fontSize: 13, textAlign: 'left', width: '100%' }} onClick={() => setActivePage('labels')}>Labels</button>
              </div>
            )}
          </div>

          <button id="nav-campaigns" style={navBtn('campaigns')} onClick={() => setActivePage('campaigns')} title="Campaigns">
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Megaphone size={18} /></div>
            <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Campaigns</span>
          </button>

          {['admin', 'super_admin', 'quality_manager'].includes((currentUser.role || '').toLowerCase()) && (
            <>
              <button style={navBtn('team-members')} onClick={() => setActivePage('team-members')} title="Team Members">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Shield size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Team Members</span>
              </button>
              <button id="nav-templates" style={navBtn('templates')} onClick={() => setActivePage('templates')} title="Templates">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Templates</span>
              </button>
              <button style={navBtn('email-templates')} onClick={() => setActivePage('email-templates')} title="Email Templates">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Mail size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Email Templates</span>
              </button>
              <button id="nav-flows" style={navBtn('flows')} onClick={() => setActivePage('flows')} title="Flows">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><GitBranch size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Flows</span>
              </button>
              <button id="nav-workflows" style={navBtn('workflows')} onClick={() => setActivePage('workflows')} title="Workflows">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Workflow size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Workflows</span>
              </button>
              <button id="nav-ai-agent" style={navBtn('ai-agent')} onClick={() => setActivePage('ai-agent')} title="AI Agent">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Bot size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">AI Agent</span>
              </button>
              <button style={navBtn('rules')} onClick={() => setActivePage('rules')} title="Rules">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Zap size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Rules</span>
              </button>
              <button style={navBtn('instagram')} onClick={() => setActivePage('instagram')} title="Instagram">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <Instagram size={18} />
                  {instagramUnread > 0 && (
                    <span style={{ position: 'absolute', top: 4, right: 4, background: '#ec4899', color: '#fff', fontSize: 9, fontWeight: 700, height: 14, minWidth: 14, padding: '0 3px', borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #08080f' }}>
                      {instagramUnread > 99 ? '99+' : instagramUnread}
                    </span>
                  )}
                </div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium flex-1 flex items-center justify-between pr-3">
                  <span>Instagram</span>
                  {instagramUnread > 0 && (
                    <span style={{ background: '#ec4899', color: '#fff', padding: '1px 7px', borderRadius: 99, fontSize: 10, fontWeight: 700 }}>{instagramUnread}</span>
                  )}
                </span>
              </button>
              <button style={navBtn('telegram')} onClick={() => setActivePage('telegram')} title="Telegram">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageSquare size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Telegram</span>
              </button>
              <button style={navBtn('calls')} onClick={() => setActivePage('calls')} title="Calls">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Phone size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Calls</span>
              </button>
              <button style={navBtn('sms')} onClick={() => setActivePage('sms')} title="SMS">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageSquare size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">SMS</span>
              </button>
              <button style={navBtn('email')} onClick={() => setActivePage('email')} title="Email">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Mail size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Email</span>
              </button>
              <button style={navBtn('gallery')} onClick={() => setActivePage('gallery')} title="File Manager">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><FileText size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">File Manager</span>
              </button>
              <button style={navBtn('reports')} onClick={() => setActivePage('reports')} title="Reports">
                <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><BarChart3 size={18} /></div>
                <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Reports</span>
              </button>
            </>
          )}
        </nav>

        {/* Bottom section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 10px 8px', overflow: 'hidden' }}>
          <button id="tour-nav-settings" style={navBtn('settings')} onClick={() => setActivePage('settings')} title="Integrations">
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Puzzle size={18} /></div>
            <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Integrations</span>
          </button>

          {/* User avatar */}
          <div style={{ display: 'flex', alignItems: 'center', height: 40, padding: '0', flexShrink: 0 }}>
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg, #00E676, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0a0a14' }}>
                {currentUser?.name?.substring(0, 2).toUpperCase() || 'JD'}
              </div>
            </div>
            <span className="ml-2 text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {currentUser?.name || 'Profile'}
            </span>
          </div>

          {/* Logout */}
          <button style={{ display: 'flex', alignItems: 'center', height: 40, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 10, color: 'rgba(255,255,255,0.35)', width: '100%', flexShrink: 0 }} onClick={handleLogout} title="Log Out"
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = '#f87171'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)'; }}>
            <div style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><LogOut size={18} /></div>
            <span className="ml-2 whitespace-nowrap overflow-hidden transition-all duration-300 w-0 group-hover:w-auto opacity-0 group-hover:opacity-100 text-sm font-medium">Log Out</span>
          </button>
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

        {activePage === 'instagram' && <InstagramPage currentUser={currentUser} socket={socket} />}
        {activePage === 'telegram' && <TelegramPage currentUser={currentUser} socket={socket} />}
        {activePage === 'calls' && <CallsPage currentUser={currentUser} />}
        {activePage === 'sms' && <SmsPage currentUser={currentUser} />}
        {activePage === 'email' && <EmailPage currentUser={currentUser} />}
        {activePage === 'gallery' && <GalleryPage />}
        {activePage === 'ai-agent' && <AiAgentPage />}

        {activePage === 'team-members' && <TeamMembersPage />}
        {activePage === 'contacts' && <ContactsPage />}
        {activePage === 'reports' && <ReportsPage />}
        {activePage === 'labels' && <LabelsPage />}
        {activePage === 'campaigns' && <CampaignsPage />}

        {activePage === 'inbox' && (
          <>
            <div className="w-80 flex-none border-r border-slate-200 bg-white flex flex-col">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
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
                {linkedPhones.length > 1 && (
                  <select
                    value={phoneNumberId || ''}
                    onChange={(e) => setPhoneNumberId(e.target.value || null)}
                    className="w-full text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
                  >
                    <option value="">All Channels</option>
                    {linkedPhones.map(p => (
                      <option key={p.phone_number_id} value={p.phone_number_id}>
                        {p.display_phone_number || p.phone_number_id}
                      </option>
                    ))}
                  </select>
                )}
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
                counts={inboxCounts}
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
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-slate-500">
                          {selectedConversation?.status === 'closed' ? 'Closed' : 'Open Conversation'}
                        </p>
                        {selectedConversation?.channelDisplayName && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              via {selectedConversation.channelDisplayName}
                            </span>
                          </>
                        )}
                      </div>
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
                  channelExternalId={selectedConversation?.channelExternalId}
                  channelType={selectedConversation?.channelType}
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
      {showPreloader && !isLoggedIn && <Preloader onDone={() => setShowPreloader(false)} />}
      {showOnboarding && (
        <OnboardingTour 
          onComplete={handleOnboardingComplete} 
          activePage={activePage}
          setActivePage={setActivePage}
        />
      )}
    </div>
  );
}
