'use strict';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getTwilioSettings, getTwilioLogs, sendTwilioSms } from '../api';
import { cn } from '../lib/utils';
import {
  MessageSquare, Loader2, RefreshCw, Search, X, Clock,
  Send, ArrowDownLeft, ArrowUpRight, CheckCircle2, XCircle,
  AlertCircle, Delete, User, ChevronRight
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffH = (now - d) / 3600000;
  if (diffH < 24 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffH < 48) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function StatusBadge({ status }) {
  const cfg = {
    sent:        { label: 'Sent',       cls: 'bg-blue-100 text-blue-700' },
    delivered:   { label: 'Delivered',  cls: 'bg-green-100 text-green-700' },
    read:        { label: 'Read',       cls: 'bg-green-100 text-green-800' },
    queued:      { label: 'Queued',     cls: 'bg-yellow-100 text-yellow-700' },
    sending:     { label: 'Sending',    cls: 'bg-blue-100 text-blue-700 animate-pulse' },
    failed:      { label: 'Failed',     cls: 'bg-red-100 text-red-700' },
    undelivered: { label: 'Undelivered',cls: 'bg-orange-100 text-orange-700' },
    initiated:   { label: 'Initiated',  cls: 'bg-slate-100 text-slate-600' },
    received:    { label: 'Received',   cls: 'bg-purple-100 text-purple-700' },
  };
  const c = cfg[status] || { label: status, cls: 'bg-slate-100 text-slate-500' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${c.cls}`}>{c.label}</span>;
}

function DirectionIcon({ direction, status }) {
  if (status === 'failed' || status === 'undelivered') return <XCircle size={15} className="text-red-500" />;
  if (direction === 'inbound') return <ArrowDownLeft size={15} className="text-purple-500" />;
  return <ArrowUpRight size={15} className="text-blue-500" />;
}

// ─── SMS Composer ─────────────────────────────────────────────────────────────

function SmsComposer({ onSend, isSending, defaultTo, callerIdDefault }) {
  const [to, setTo] = useState(defaultTo || '');
  const [body, setBody] = useState('');
  const MAX = 160;

  useEffect(() => { setTo(defaultTo || ''); }, [defaultTo]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-xs font-bold text-slate-600 block mb-1">To (phone number)</label>
        <input
          type="tel"
          value={to}
          onChange={e => setTo(e.target.value)}
          placeholder="+91 XXXXX XXXXX"
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400/30 font-mono"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-bold text-slate-600">Message</label>
          <span className={`text-[10px] font-medium ${body.length > MAX ? 'text-red-500' : 'text-slate-400'}`}>
            {body.length}/{MAX}
          </span>
        </div>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Type your message…"
          rows={5}
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-400/30 resize-none"
        />
      </div>

      {callerIdDefault && (
        <p className="text-[11px] text-slate-400">
          From: <span className="font-mono font-bold text-slate-600">{callerIdDefault}</span>
        </p>
      )}

      <button
        onClick={() => onSend(to, body, () => { setTo(''); setBody(''); })}
        disabled={!to || !body || isSending}
        className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-2xl transition-all active:scale-95 shadow-sm shadow-red-500/20"
      >
        {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        {isSending ? 'Sending…' : 'Send SMS'}
      </button>
    </div>
  );
}

// ─── Message Detail ───────────────────────────────────────────────────────────

function SmsDetail({ log, onReply, isSending }) {
  const isInbound = log.direction === 'inbound';
  const displayNumber = isInbound ? log.from_number : log.to_number;

  return (
    <div className="flex flex-col h-full">
      {/* Hero */}
      <div className={`p-8 flex flex-col items-center gap-3 border-b border-slate-100 ${isInbound ? 'bg-purple-50' : 'bg-blue-50'}`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-sm ${isInbound ? 'bg-purple-100' : 'bg-blue-100'}`}>
          {log.contact_name
            ? <span className={`text-3xl font-black ${isInbound ? 'text-purple-500' : 'text-blue-600'}`}>{log.contact_name[0].toUpperCase()}</span>
            : <User size={32} className={isInbound ? 'text-purple-400' : 'text-blue-400'} />
          }
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black text-slate-900">{log.contact_name || displayNumber}</h2>
          {log.contact_name && <p className="text-sm text-slate-500 font-mono mt-0.5">{displayNumber}</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={log.status} />
          <span className="text-[10px] text-slate-400 uppercase font-bold">{log.direction}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { label: 'Date', value: new Date(log.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) },
          { label: 'Time', value: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ].map(s => (
          <div key={s.label} className="py-4 px-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Message bubble */}
      {log.body && (
        <div className="p-5 border-b border-slate-50">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Message</p>
          <div className={`p-4 rounded-2xl text-sm leading-relaxed ${isInbound ? 'bg-purple-50 text-purple-900 border border-purple-100' : 'bg-blue-50 text-blue-900 border border-blue-100'}`}>
            {log.body}
          </div>
        </div>
      )}

      {/* Metadata */}
      <div className="p-5 space-y-3 flex-1 overflow-y-auto">
        {[
          { label: 'Message SID', value: log.sid },
          { label: 'From', value: log.from_number },
          { label: 'To', value: log.to_number },
          { label: 'Direction', value: log.direction },
          { label: 'Status', value: log.status },
          { label: 'Initiated by', value: log.initiated_by || 'System / Workflow' },
        ].filter(r => r.value).map(row => (
          <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-50">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{row.label}</span>
            <span className="text-xs font-semibold text-slate-700 font-mono">{row.value}</span>
          </div>
        ))}
      </div>

      {/* Reply button */}
      <div className="p-4 border-t border-slate-100 flex gap-3">
        <button
          onClick={() => onReply(displayNumber)}
          disabled={isSending}
          className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-colors shadow-sm shadow-red-500/20"
        >
          <Send size={16} />
          Reply / New SMS
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SmsPage({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    return (currentUser.teamIds || [])[0] || null;
  }, [currentUser]);

  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showComposer, setShowComposer] = useState(true);
  const [composerTo, setComposerTo] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const PER_PAGE = 50;

  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const s = await getTwilioSettings(teamId);
        if (s?.settings) setSettings(s.settings);
      } catch {}
    })();
    loadLogs();
  }, [teamId]);

  const loadLogs = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    try {
      const res = await getTwilioLogs(teamId, { type: 'sms', limit: PER_PAGE, offset: 0 });
      setLogs(res.logs || []);
    } catch (err) {
      console.error('Failed to load SMS logs', err);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const filtered = useMemo(() => {
    let list = logs;
    if (filter === 'inbound')   list = list.filter(l => l.direction === 'inbound');
    if (filter === 'outbound')  list = list.filter(l => l.direction === 'outbound');
    if (filter === 'delivered') list = list.filter(l => l.status === 'delivered');
    if (filter === 'failed')    list = list.filter(l => ['failed', 'undelivered'].includes(l.status));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(l =>
        (l.from_number || '').includes(q) ||
        (l.to_number || '').includes(q) ||
        (l.contact_name || '').toLowerCase().includes(q) ||
        (l.body || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, filter, search]);

  const stats = useMemo(() => ({
    total:     logs.length,
    delivered: logs.filter(l => l.status === 'delivered').length,
    failed:    logs.filter(l => ['failed', 'undelivered'].includes(l.status)).length,
    inbound:   logs.filter(l => l.direction === 'inbound').length,
    outbound:  logs.filter(l => l.direction === 'outbound').length,
  }), [logs]);

  const handleSend = useCallback(async (to, body, clearForm) => {
    if (!to || !body) return;
    setIsSending(true);
    setSendResult(null);
    try {
      const res = await sendTwilioSms({ to, body }, teamId);
      if (res.error) throw new Error(res.error);
      setSendResult({ success: true, message: `SMS sent! SID: ${res.message?.sid || '—'}` });
      clearForm();
      setTimeout(() => { loadLogs(); setSendResult(null); }, 2500);
    } catch (err) {
      setSendResult({ success: false, message: err.message || 'Failed to send SMS' });
    } finally {
      setIsSending(false);
    }
  }, [teamId, loadLogs]);

  const handleReply = useCallback((number) => {
    setComposerTo(number);
    setShowComposer(true);
    setSelectedLog(null);
  }, []);

  const FILTERS = [
    { id: 'all',       label: 'All',       count: stats.total },
    { id: 'outbound',  label: 'Outbound',  count: stats.outbound },
    { id: 'inbound',   label: 'Inbound',   count: stats.inbound },
    { id: 'delivered', label: 'Delivered', count: stats.delivered },
    { id: 'failed',    label: 'Failed',    count: stats.failed },
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
              <div className="p-2 bg-red-100 rounded-lg">
                <MessageSquare className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm leading-none">SMS</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Twilio messaging</p>
              </div>
            </div>
            <button onClick={() => loadLogs()} disabled={loading} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-white">
          {[
            { label: 'Total',     value: stats.total,     color: 'text-slate-800' },
            { label: 'Delivered', value: stats.delivered, color: 'text-green-600' },
            { label: 'Failed',    value: stats.failed,    color: 'text-red-500' },
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
              placeholder="Search number, contact or message…"
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
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-red-50 hover:border-red-200'
              )}
            >
              {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
            </button>
          ))}
        </div>

        {/* SMS log list */}
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <MessageSquare className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No SMS messages found</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map(log => {
                const isSelected = selectedLog?.id === log.id;
                const displayNum = log.direction === 'inbound' ? log.from_number : log.to_number;
                const isFailed = ['failed', 'undelivered'].includes(log.status);
                return (
                  <li
                    key={log.id}
                    onClick={() => { setSelectedLog(log); setShowComposer(false); }}
                    className={cn(
                      'px-4 py-3 cursor-pointer transition-colors relative group',
                      isSelected
                        ? 'bg-red-50 border-l-4 border-red-500'
                        : 'hover:bg-slate-100 border-l-4 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                        isFailed ? 'bg-red-50' : log.direction === 'inbound' ? 'bg-purple-50' : 'bg-blue-50'
                      )}>
                        <DirectionIcon direction={log.direction} status={log.status} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-800 truncate">{log.contact_name || displayNum}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{fmtTime(log.created_at)}</span>
                        </div>
                        {log.contact_name && <p className="text-[11px] text-slate-400 font-mono truncate">{displayNum}</p>}
                        {log.body && <p className="text-[11px] text-slate-500 truncate mt-0.5">{log.body}</p>}
                        <div className="flex items-center gap-1.5 mt-1">
                          <StatusBadge status={log.status} />
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* New SMS button */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <button
            onClick={() => { setShowComposer(true); setSelectedLog(null); setComposerTo(''); }}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-red-500/20"
          >
            <MessageSquare size={15} />
            New SMS
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
              <p className="text-sm font-bold text-amber-800">Twilio not connected</p>
              <p className="text-xs text-amber-600 mt-0.5">Go to <strong>Settings → Integrations → Twilio</strong> to configure your Account SID, Auth Token and phone number.</p>
            </div>
          </div>
        )}

        {/* Composer view */}
        {(showComposer || !selectedLog) && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <div className="w-full max-w-sm">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={28} className="text-red-500" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Send SMS</h2>
                <p className="text-sm text-slate-400 mt-1">Send a message via Twilio to any number</p>
                {settings?.phone_number && (
                  <p className="text-[11px] text-slate-400 mt-1">From: <span className="font-mono font-bold text-slate-600">{settings.phone_number}</span></p>
                )}
              </div>

              <SmsComposer
                onSend={handleSend}
                isSending={isSending}
                defaultTo={composerTo}
                callerIdDefault={settings?.phone_number}
              />

              {/* Result feedback */}
              {sendResult && (
                <div className={cn(
                  'mt-4 p-3 rounded-xl flex items-center gap-2 text-sm font-medium',
                  sendResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                )}>
                  {sendResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {sendResult.message}
                </div>
              )}

              {/* Quick-reply from recent messages */}
              {logs.length > 0 && (
                <div className="mt-8">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recent Contacts</p>
                  <div className="space-y-1">
                    {[...new Map(logs.map(l => {
                      const num = l.direction === 'inbound' ? l.from_number : l.to_number;
                      return [num, l];
                    })).values()].slice(0, 5).map(log => {
                      const num = log.direction === 'inbound' ? log.from_number : log.to_number;
                      return (
                        <button
                          key={log.id}
                          onClick={() => setComposerTo(num)}
                          className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-red-50 border border-slate-100 hover:border-red-100 rounded-xl transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <DirectionIcon direction={log.direction} status={log.status} />
                            <div className="text-left">
                              <p className="text-sm font-semibold text-slate-800">{log.contact_name || num}</p>
                              {log.contact_name && <p className="text-[10px] text-slate-400 font-mono">{num}</p>}
                              {log.body && <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{log.body}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={log.status} />
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-red-400 transition-colors" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Detail view */}
        {!showComposer && selectedLog && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <button
                onClick={() => { setShowComposer(true); setSelectedLog(null); setComposerTo(''); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-red-500 transition-colors font-medium"
              >
                <MessageSquare size={14} />
                New SMS
              </button>
              <button
                onClick={() => loadLogs()}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <SmsDetail log={selectedLog} onReply={handleReply} isSending={isSending} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
