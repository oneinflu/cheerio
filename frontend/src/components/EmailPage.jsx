'use strict';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getEmailSettings, getEmailMessages, sendEmailMessage, syncEmails, markEmailRead, deleteEmailMessage } from '../api';
import { cn } from '../lib/utils';
import {
  Mail, MailOpen, Send, RefreshCw, Loader2, Search, X,
  Inbox, Trash2, Reply, Forward, ArrowDownLeft, ArrowUpRight,
  AlertCircle, CheckCircle2, XCircle, ChevronRight, Plus,
  Paperclip, User, Clock, Star, MoreHorizontal, Edit3
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffH = (now - d) / 3600000;
  if (diffH < 24 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffH < 48) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function fmtFull(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function initials(name, email) {
  const s = name || email || '?';
  return s.slice(0, 2).toUpperCase();
}

function AvatarCircle({ name, email, size = 9, color = 'bg-indigo-100 text-indigo-700' }) {
  return (
    <div className={`w-${size} h-${size} rounded-full ${color} flex items-center justify-center font-black text-xs shrink-0`}>
      {initials(name, email)}
    </div>
  );
}

// ─── Compose / Reply ──────────────────────────────────────────────────────────

function ComposePanel({ settings, onSend, isSending, sendResult, defaultTo, defaultSubject, defaultBody, isReply, onClose }) {
  const [to, setTo] = useState(defaultTo || '');
  const [subject, setSubject] = useState(defaultSubject || '');
  const [body, setBody] = useState(defaultBody || '');
  const [cc, setCc] = useState('');
  const [showCc, setShowCc] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <h3 className="font-black text-slate-800 text-sm flex items-center gap-2">
          <Edit3 size={15} className="text-indigo-500" />
          {isReply ? 'Reply' : 'New Email'}
        </h3>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col overflow-y-auto p-5 gap-3">
        {/* From */}
        {settings?.email_address && (
          <div className="flex items-center gap-2 text-xs text-slate-500 pb-2 border-b border-slate-50">
            <span className="font-bold text-slate-400 w-10 shrink-0">From</span>
            <span className="font-medium text-slate-700">{settings.display_name ? `${settings.display_name} <${settings.email_address}>` : settings.email_address}</span>
          </div>
        )}

        {/* To */}
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <span className="text-xs font-bold text-slate-400 w-10 shrink-0">To</span>
          <input
            type="email"
            value={to}
            onChange={e => setTo(e.target.value)}
            placeholder="recipient@example.com"
            className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-300"
          />
          <button onClick={() => setShowCc(v => !v)} className="text-[10px] font-bold text-slate-400 hover:text-indigo-500">Cc</button>
        </div>

        {/* Cc */}
        {showCc && (
          <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
            <span className="text-xs font-bold text-slate-400 w-10 shrink-0">Cc</span>
            <input
              type="email"
              value={cc}
              onChange={e => setCc(e.target.value)}
              placeholder="cc@example.com"
              className="flex-1 text-sm bg-transparent outline-none text-slate-800 placeholder:text-slate-300"
            />
          </div>
        )}

        {/* Subject */}
        <div className="flex items-center gap-2 border-b border-slate-50 pb-2">
          <span className="text-xs font-bold text-slate-400 w-10 shrink-0">Sub</span>
          <input
            type="text"
            value={subject}
            onChange={e => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 text-sm font-semibold bg-transparent outline-none text-slate-800 placeholder:text-slate-300"
          />
        </div>

        {/* Body */}
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Write your email here…"
          className="flex-1 min-h-[200px] text-sm text-slate-800 bg-transparent outline-none resize-none placeholder:text-slate-300 leading-relaxed"
        />

        {/* Result */}
        {sendResult && (
          <div className={cn(
            'p-3 rounded-xl flex items-center gap-2 text-sm font-medium',
            sendResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
          )}>
            {sendResult.success ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
            {sendResult.message}
          </div>
        )}
      </div>

      {/* Send bar */}
      <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3">
        <button
          onClick={() => onSend({ to, subject, bodyText: body, cc: cc || undefined })}
          disabled={!to || !subject || !body || isSending}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold px-5 py-2.5 rounded-xl text-sm transition-all shadow-sm shadow-indigo-500/20"
        >
          {isSending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {isSending ? 'Sending…' : 'Send'}
        </button>
        <span className="text-[11px] text-slate-400">{body.length} chars</span>
      </div>
    </div>
  );
}

// ─── Email Detail ─────────────────────────────────────────────────────────────

function EmailDetail({ msg, settings, onReply, onDelete, isSending, sendResult }) {
  const [replyOpen, setReplyOpen] = useState(false);
  const isInbound = msg.direction === 'inbound';

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 bg-white">
        <h2 className="text-base font-black text-slate-900 leading-snug mb-3">{msg.subject || '(no subject)'}</h2>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <AvatarCircle
              name={isInbound ? msg.from_name : msg.to_name}
              email={isInbound ? msg.from_address : msg.to_address}
              size={10}
              color={isInbound ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}
            />
            <div>
              <p className="text-sm font-bold text-slate-800">{isInbound ? (msg.from_name || msg.from_address) : (msg.to_name || msg.to_address)}</p>
              <p className="text-xs text-slate-400 font-mono">{isInbound ? msg.from_address : msg.to_address}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                {isInbound ? `To: ${msg.to_address}` : `From: ${msg.from_address}`}
                {msg.cc && ` · CC: ${msg.cc}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400">{fmtFull(msg.received_at)}</span>
            <button
              onClick={() => onDelete(msg.id)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto">
        {msg.body_html ? (
          <div
            className="px-6 py-5 text-sm text-slate-800 leading-relaxed prose prose-sm max-w-none"
            dangerouslySetInnerHTML={{ __html: msg.body_html }}
          />
        ) : (
          <pre className="px-6 py-5 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
            {msg.body_text || '(empty)'}
          </pre>
        )}

        {/* Reply inline */}
        {replyOpen && (
          <div className="mx-4 mb-4 rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <ComposePanel
              settings={settings}
              onSend={(data) => onReply({ ...data, inReplyTo: msg.message_id, defaultSubject: `Re: ${msg.subject}` })}
              isSending={isSending}
              sendResult={sendResult}
              defaultTo={isInbound ? msg.from_address : msg.to_address}
              defaultSubject={`Re: ${msg.subject || ''}`}
              isReply
              onClose={() => setReplyOpen(false)}
            />
          </div>
        )}
      </div>

      {/* Actions */}
      {!replyOpen && (
        <div className="px-5 py-3 border-t border-slate-100 flex items-center gap-3 bg-white">
          <button
            onClick={() => setReplyOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition-colors shadow-sm"
          >
            <Reply size={14} />
            Reply
          </button>
          <button
            onClick={() => onReply({ to: '', subject: `Fwd: ${msg.subject}`, bodyText: `\n\n---------- Forwarded message ----------\nFrom: ${msg.from_address}\nSubject: ${msg.subject}\n\n${msg.body_text || ''}` })}
            className="flex items-center gap-2 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold px-4 py-2 rounded-xl text-sm transition-colors"
          >
            <Forward size={14} />
            Forward
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EmailPage({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    return (currentUser.teamIds || [])[0] || null;
  }, [currentUser]);

  const [settings, setSettings] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState(null);
  const [selectedMsg, setSelectedMsg] = useState(null);
  const [filter, setFilter] = useState('all');  // all | inbound | outbound | unread
  const [search, setSearch] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [composeDefaults, setComposeDefaults] = useState({});

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const s = await getEmailSettings(teamId);
        if (s?.settings) setSettings(s.settings);
      } catch {}
    })();
    loadMessages();
  }, [teamId]);

  const loadMessages = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await getEmailMessages(teamId, { limit: 50 });
      setMessages(res.messages || []);
    } catch (err) {
      console.error('Failed to load emails', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const handleSync = useCallback(async () => {
    if (!teamId) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncEmails(teamId, 30);
      if (res.error) throw new Error(res.error);
      setSyncMsg({ success: true, message: `Synced ${res.fetched} new email${res.fetched !== 1 ? 's' : ''}` });
      await loadMessages();
      setTimeout(() => setSyncMsg(null), 3000);
    } catch (err) {
      setSyncMsg({ success: false, message: err.message || 'Sync failed' });
    } finally {
      setSyncing(false);
    }
  }, [teamId, loadMessages]);

  const handleSend = useCallback(async (data) => {
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await sendEmailMessage(data, teamId);
      if (res.error) throw new Error(res.error);
      setSendResult({ success: true, message: `Email sent! ID: ${res.messageId || '—'}` });
      setTimeout(async () => { setSendResult(null); setShowCompose(false); await loadMessages(); }, 2500);
    } catch (err) {
      setSendResult({ success: false, message: err.message || 'Failed to send email' });
    } finally {
      setIsSending(false);
    }
  }, [teamId, loadMessages]);

  const handleSelectMsg = useCallback(async (msg) => {
    setSelectedMsg(msg);
    setShowCompose(false);
    if (!msg.is_read) {
      await markEmailRead(msg.id, teamId).catch(() => {});
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, is_read: true } : m));
    }
  }, [teamId]);

  const handleDelete = useCallback(async (id) => {
    await deleteEmailMessage(id, teamId).catch(() => {});
    setMessages(prev => prev.filter(m => m.id !== id));
    if (selectedMsg?.id === id) setSelectedMsg(null);
  }, [teamId, selectedMsg]);

  const handleReply = useCallback((data) => {
    setComposeDefaults(data);
    setShowCompose(true);
    setSelectedMsg(null);
  }, []);

  const filtered = useMemo(() => {
    let list = messages;
    if (filter === 'inbound')  list = list.filter(m => m.direction === 'inbound');
    if (filter === 'outbound') list = list.filter(m => m.direction === 'outbound');
    if (filter === 'unread')   list = list.filter(m => !m.is_read && m.direction === 'inbound');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(m =>
        (m.subject || '').toLowerCase().includes(q) ||
        (m.from_address || '').toLowerCase().includes(q) ||
        (m.to_address || '').toLowerCase().includes(q) ||
        (m.from_name || '').toLowerCase().includes(q) ||
        (m.body_text || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [messages, filter, search]);

  const stats = useMemo(() => ({
    total:   messages.length,
    unread:  messages.filter(m => !m.is_read && m.direction === 'inbound').length,
    sent:    messages.filter(m => m.direction === 'outbound').length,
    inbox:   messages.filter(m => m.direction === 'inbound').length,
  }), [messages]);

  const FILTERS = [
    { id: 'all',      label: 'All',     count: stats.total },
    { id: 'inbound',  label: 'Inbox',   count: stats.inbox },
    { id: 'unread',   label: 'Unread',  count: stats.unread },
    { id: 'outbound', label: 'Sent',    count: stats.sent },
  ];

  const notConnected = !settings;

  return (
    <div className="flex flex-1 h-full w-full bg-white overflow-hidden">

      {/* ── Left Sidebar ──────────────────────────────────────────────── */}
      <div className="w-80 min-w-[280px] border-r border-slate-200 flex flex-col bg-slate-50">

        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Mail className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm leading-none">Email</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">{settings?.email_address || 'IMAP / SMTP'}</p>
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing || notConnected}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-40"
              title="Sync inbox from IMAP"
            >
              <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Sync status */}
          {syncMsg && (
            <div className={cn(
              'mt-2 px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5',
              syncMsg.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            )}>
              {syncMsg.success ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
              {syncMsg.message}
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-white">
          {[
            { label: 'Total',  value: stats.total,  color: 'text-slate-800' },
            { label: 'Unread', value: stats.unread, color: 'text-indigo-600' },
            { label: 'Sent',   value: stats.sent,   color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="py-2.5 text-center">
              <p className={`text-base font-black ${s.color}`}>{s.value}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-9">
            <Search size={13} className="text-slate-400 shrink-0" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search subject, sender, body…"
              className="flex-1 text-xs bg-transparent outline-none text-slate-700 placeholder:text-slate-300"
            />
            {search && <button onClick={() => setSearch('')}><X size={13} className="text-slate-300 hover:text-slate-500" /></button>}
          </div>
        </div>

        {/* Filter chips */}
        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                'px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors border whitespace-nowrap',
                filter === f.id
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
              )}
            >
              {f.label}{f.count > 0 && ` (${f.count})`}
            </button>
          ))}
        </div>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto">
          {loading && messages.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <Mail className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No emails found</p>
              {!notConnected && <button onClick={handleSync} className="mt-2 text-xs text-indigo-500 hover:text-indigo-700 font-medium">Sync inbox</button>}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map(msg => {
                const isSelected = selectedMsg?.id === msg.id;
                const isInbound = msg.direction === 'inbound';
                const isUnread = !msg.is_read && isInbound;
                const displayName = isInbound ? (msg.from_name || msg.from_address) : (msg.to_name || msg.to_address);
                const displayAddr = isInbound ? msg.from_address : msg.to_address;
                return (
                  <li
                    key={msg.id}
                    onClick={() => handleSelectMsg(msg)}
                    className={cn(
                      'px-4 py-3 cursor-pointer transition-colors relative group border-l-4',
                      isSelected
                        ? 'bg-indigo-50 border-indigo-600'
                        : isUnread
                          ? 'bg-white border-indigo-300 hover:bg-indigo-50/50'
                          : 'border-transparent hover:bg-slate-100'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <AvatarCircle
                        name={displayName}
                        email={displayAddr}
                        size={9}
                        color={isInbound ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn('text-sm truncate', isUnread ? 'font-black text-slate-900' : 'font-semibold text-slate-700')}>
                            {displayName}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0">{fmtTime(msg.received_at)}</span>
                        </div>
                        <p className={cn('text-xs truncate mt-0.5', isUnread ? 'font-bold text-slate-800' : 'text-slate-600')}>
                          {msg.subject || '(no subject)'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {msg.body_text?.slice(0, 80) || ''}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {isInbound
                            ? <span className="text-[9px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full border border-indigo-100">INBOX</span>
                            : <span className="text-[9px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">SENT</span>
                          }
                          {isUnread && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Compose button */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <button
            onClick={() => { setShowCompose(true); setSelectedMsg(null); setComposeDefaults({}); }}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-indigo-500/20"
          >
            <Plus size={15} />
            Compose
          </button>
        </div>
      </div>

      {/* ── Right Panel ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Not connected banner */}
        {notConnected && (
          <div className="m-4 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-800">Email not connected</p>
              <p className="text-xs text-amber-600 mt-0.5">Go to <strong>Settings → Integrations → Business Email</strong> to configure your IMAP/SMTP credentials.</p>
            </div>
          </div>
        )}

        {/* Compose panel */}
        {showCompose && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <button
                onClick={() => { setShowCompose(false); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-500 transition-colors font-medium"
              >
                <Mail size={14} />
                Back to inbox
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ComposePanel
                settings={settings}
                onSend={handleSend}
                isSending={isSending}
                sendResult={sendResult}
                defaultTo={composeDefaults.to || ''}
                defaultSubject={composeDefaults.subject || ''}
                defaultBody={composeDefaults.bodyText || ''}
                isReply={!!composeDefaults.inReplyTo}
              />
            </div>
          </div>
        )}

        {/* Email detail */}
        {!showCompose && selectedMsg && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <button
                onClick={() => setSelectedMsg(null)}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-indigo-500 transition-colors font-medium"
              >
                <Inbox size={14} />
                Back to inbox
              </button>
              <button onClick={handleSync} disabled={syncing} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <EmailDetail
                msg={selectedMsg}
                settings={settings}
                onReply={handleReply}
                onDelete={handleDelete}
                isSending={isSending}
                sendResult={sendResult}
              />
            </div>
          </div>
        )}

        {/* Empty state */}
        {!showCompose && !selectedMsg && (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-lg font-black text-slate-700 mb-1">Your Inbox</h3>
              <p className="text-sm text-slate-400 mb-4">Select an email to read, or compose a new one</p>
              {!notConnected && (
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  className="flex items-center gap-2 mx-auto text-sm font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                  {syncing ? 'Syncing…' : 'Sync inbox'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
