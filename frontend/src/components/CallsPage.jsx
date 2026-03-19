'use strict';
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { getExotelSettings, getExotelCallLogs, initiateExotelCall } from '../api';
import { cn } from '../lib/utils';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall,
  Loader2, RefreshCw, Search, X, Clock, Mic, MicOff,
  User, ArrowDownLeft, ArrowUpRight, CheckCircle2, XCircle,
  AlertCircle, Delete, Volume2, Settings2, ChevronRight
} from 'lucide-react';
import { Button } from './ui/Button';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtDuration(seconds) {
  if (!seconds || seconds === 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffH = diffMs / 3600000;
  if (diffH < 24 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diffH < 48) return 'Yesterday';
  return d.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

function StatusBadge({ status }) {
  const cfg = {
    completed:   { label: 'Answered',  cls: 'bg-green-100 text-green-700' },
    'in-progress': { label: 'Live',    cls: 'bg-blue-100 text-blue-700 animate-pulse' },
    initiated:   { label: 'Initiated', cls: 'bg-slate-100 text-slate-600' },
    ringing:     { label: 'Ringing',   cls: 'bg-yellow-100 text-yellow-700' },
    failed:      { label: 'Failed',    cls: 'bg-red-100 text-red-700' },
    busy:        { label: 'Busy',      cls: 'bg-orange-100 text-orange-700' },
    'no-answer': { label: 'No Answer', cls: 'bg-orange-100 text-orange-700' },
    canceled:    { label: 'Canceled',  cls: 'bg-slate-100 text-slate-500' },
  };
  const c = cfg[status] || { label: status, cls: 'bg-slate-100 text-slate-500' };
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${c.cls}`}>{c.label}</span>;
}

function DirectionIcon({ direction, status }) {
  const missed = ['failed', 'busy', 'no-answer'].includes(status);
  if (missed) return <PhoneMissed size={15} className="text-red-500" />;
  if (direction === 'inbound') return <PhoneIncoming size={15} className="text-green-500" />;
  return <PhoneOutgoing size={15} className="text-orange-500" />;
}

// ─── Dial Pad ─────────────────────────────────────────────────────────────────

const KEYS = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

function DialPad({ value, onChange, onCall, isDialing, callerIdDefault }) {
  const [showFrom, setShowFrom] = useState(false);
  const [fromNumber, setFromNumber] = useState('');

  const press = (key) => onChange(prev => prev + key);
  const del = () => onChange(prev => prev.slice(0, -1));

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Number display */}
      <div className="relative w-full">
        <input
          type="tel"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="+91 XXXXX XXXXX"
          className="w-full text-center text-2xl font-bold tracking-widest bg-transparent border-0 border-b-2 border-slate-200 focus:border-orange-400 outline-none py-2 text-slate-800 placeholder:text-slate-300 placeholder:text-base placeholder:font-normal"
        />
        {value && (
          <button onClick={del} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
            <Delete size={18} />
          </button>
        )}
      </div>

      {/* Dial pad grid */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
        {KEYS.map(([digit, letters]) => (
          <button
            key={digit}
            onClick={() => press(digit)}
            className="flex flex-col items-center justify-center h-14 rounded-2xl bg-slate-50 border border-slate-100 hover:bg-slate-100 active:bg-slate-200 transition-colors select-none"
          >
            <span className="text-lg font-bold text-slate-800 leading-none">{digit}</span>
            {letters && <span className="text-[8px] font-bold text-slate-400 tracking-widest mt-0.5">{letters}</span>}
          </button>
        ))}
      </div>

      {/* Caller ID (optional) */}
      <button
        onClick={() => setShowFrom(f => !f)}
        className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Settings2 size={12} />
        {showFrom ? 'Hide caller ID' : 'Set caller ID (optional)'}
      </button>
      {showFrom && (
        <input
          type="tel"
          value={fromNumber}
          onChange={e => setFromNumber(e.target.value)}
          placeholder={callerIdDefault || 'ExoPhone / virtual number'}
          className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-400/30 text-center font-mono"
        />
      )}

      {/* Call button */}
      <button
        onClick={() => onCall(value, fromNumber || undefined)}
        disabled={!value || isDialing}
        className="w-16 h-16 rounded-full bg-green-500 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-green-500/30 transition-all active:scale-95"
      >
        {isDialing
          ? <Loader2 size={24} className="text-white animate-spin" />
          : <Phone size={24} className="text-white" />
        }
      </button>
    </div>
  );
}

// ─── Call Detail Panel ────────────────────────────────────────────────────────

function CallDetail({ log, onCallBack, isDialing }) {
  const isMissed = ['failed', 'busy', 'no-answer'].includes(log.status);
  const isInbound = log.direction === 'inbound';
  const displayNumber = isInbound ? log.from_number : log.to_number;

  return (
    <div className="flex flex-col h-full">
      {/* Hero */}
      <div className={`p-8 flex flex-col items-center gap-3 border-b border-slate-100 ${isMissed ? 'bg-red-50' : isInbound ? 'bg-green-50' : 'bg-orange-50'}`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-sm ${isMissed ? 'bg-red-100' : isInbound ? 'bg-green-100' : 'bg-orange-100'}`}>
          {log.contact_name
            ? <span className={`text-3xl font-black ${isMissed ? 'text-red-500' : isInbound ? 'text-green-600' : 'text-orange-500'}`}>{log.contact_name[0].toUpperCase()}</span>
            : <User size={32} className={isMissed ? 'text-red-400' : isInbound ? 'text-green-500' : 'text-orange-400'} />
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

      {/* Stats row */}
      <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100">
        {[
          { label: 'Duration', value: fmtDuration(log.duration) },
          { label: 'Date', value: new Date(log.created_at).toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) },
          { label: 'Time', value: new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ].map(s => (
          <div key={s.label} className="py-4 px-3 text-center">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{s.label}</p>
            <p className="text-sm font-bold text-slate-800 mt-0.5">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="p-5 space-y-3 flex-1 overflow-y-auto">
        {[
          { label: 'Call SID', value: log.call_sid },
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

        {log.recording_url && (
          <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Call Recording</p>
            <audio controls src={log.recording_url} className="w-full h-10" />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-100 flex gap-3">
        <button
          onClick={() => onCallBack(displayNumber)}
          disabled={isDialing}
          className="flex-1 flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white font-bold py-3 rounded-2xl transition-colors shadow-sm shadow-green-500/20"
        >
          <Phone size={16} />
          Call Back
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CallsPage({ currentUser }) {
  const teamId = useMemo(() => {
    if (!currentUser) return null;
    return (currentUser.teamIds || [])[0] || null;
  }, [currentUser]);

  const [settings, setSettings] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filter, setFilter] = useState('all');  // all | inbound | outbound | answered | missed
  const [search, setSearch] = useState('');
  const [isDialing, setIsDialing] = useState(false);
  const [dialerNumber, setDialerNumber] = useState('');
  const [dialerResult, setDialerResult] = useState(null); // null | { success, message }
  const [showDialer, setShowDialer] = useState(true);
  const [page, setPage] = useState(0);
  const PER_PAGE = 50;

  // Load settings & call logs on mount
  useEffect(() => {
    if (!teamId) return;
    (async () => {
      try {
        const s = await getExotelSettings(teamId);
        if (s?.settings) setSettings(s.settings);
      } catch {}
    })();
    loadLogs();
  }, [teamId]);

  const loadLogs = useCallback(async (reset = true) => {
    if (!teamId) return;
    setLoading(true);
    try {
      const offset = reset ? 0 : page * PER_PAGE;
      const res = await getExotelCallLogs(teamId, { limit: PER_PAGE, offset });
      const newLogs = res.calls || [];
      setLogs(reset ? newLogs : prev => [...prev, ...newLogs]);
      if (reset) setPage(0);
    } catch (err) {
      console.error('Failed to load call logs', err);
    } finally {
      setLoading(false);
    }
  }, [teamId, page]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = logs;
    if (filter === 'inbound') list = list.filter(l => l.direction === 'inbound');
    if (filter === 'outbound') list = list.filter(l => l.direction === 'outbound');
    if (filter === 'answered') list = list.filter(l => l.status === 'completed');
    if (filter === 'missed') list = list.filter(l => ['failed', 'busy', 'no-answer'].includes(l.status));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(l =>
        (l.from_number || '').includes(q) ||
        (l.to_number || '').includes(q) ||
        (l.contact_name || '').toLowerCase().includes(q) ||
        (l.call_sid || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [logs, filter, search]);

  // Stats
  const stats = useMemo(() => ({
    total: logs.length,
    answered: logs.filter(l => l.status === 'completed').length,
    missed: logs.filter(l => ['failed', 'busy', 'no-answer'].includes(l.status)).length,
    inbound: logs.filter(l => l.direction === 'inbound').length,
    outbound: logs.filter(l => l.direction === 'outbound').length,
  }), [logs]);

  const handleCall = useCallback(async (to, from) => {
    if (!to) return;
    setIsDialing(true);
    setDialerResult(null);
    try {
      const res = await initiateExotelCall({ to, from }, teamId);
      if (res.error) throw new Error(res.error);
      setDialerResult({ success: true, message: `Call initiated! SID: ${res.call?.callSid || '—'}` });
      setDialerNumber('');
      setTimeout(() => { loadLogs(); setDialerResult(null); }, 3000);
    } catch (err) {
      setDialerResult({ success: false, message: err.message || 'Call failed' });
    } finally {
      setIsDialing(false);
    }
  }, [teamId, loadLogs]);

  const handleCallBack = useCallback((number) => {
    setDialerNumber(number);
    setShowDialer(true);
    setSelectedLog(null);
  }, []);

  const FILTERS = [
    { id: 'all', label: 'All', count: stats.total },
    { id: 'outbound', label: 'Outbound', count: stats.outbound },
    { id: 'inbound', label: 'Inbound', count: stats.inbound },
    { id: 'answered', label: 'Answered', count: stats.answered },
    { id: 'missed', label: 'Missed', count: stats.missed },
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
              <div className="p-2 bg-orange-100 rounded-lg">
                <Phone className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h2 className="font-bold text-slate-900 text-sm leading-none">Calls</h2>
                <p className="text-[11px] text-slate-400 mt-0.5">Exotel VoIP</p>
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
            { label: 'Total', value: stats.total, color: 'text-slate-800' },
            { label: 'Answered', value: stats.answered, color: 'text-green-600' },
            { label: 'Missed', value: stats.missed, color: 'text-red-500' },
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
              placeholder="Search number or contact…"
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
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-slate-500 border-slate-200 hover:bg-orange-50 hover:border-orange-200'
              )}
            >
              {f.label} {f.count > 0 && <span className="opacity-70">({f.count})</span>}
            </button>
          ))}
        </div>

        {/* Call log list */}
        <div className="flex-1 overflow-y-auto">
          {loading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-5 h-5 animate-spin text-slate-300" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center">
              <PhoneCall className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No calls found</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtered.map(log => {
                const isSelected = selectedLog?.id === log.id;
                const displayNum = log.direction === 'inbound' ? log.from_number : log.to_number;
                const isMissed = ['failed', 'busy', 'no-answer'].includes(log.status);
                return (
                  <li
                    key={log.id}
                    onClick={() => { setSelectedLog(log); setShowDialer(false); }}
                    className={cn(
                      'px-4 py-3 cursor-pointer transition-colors relative group',
                      isSelected
                        ? 'bg-orange-50 border-l-4 border-orange-500'
                        : 'hover:bg-slate-100 border-l-4 border-transparent'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {/* Direction icon */}
                      <div className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                        isMissed ? 'bg-red-50' : log.direction === 'inbound' ? 'bg-green-50' : 'bg-orange-50'
                      )}>
                        <DirectionIcon direction={log.direction} status={log.status} />
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-slate-800 truncate">{log.contact_name || displayNum}</span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">{fmtTime(log.created_at)}</span>
                        </div>
                        {log.contact_name && <p className="text-[11px] text-slate-400 font-mono truncate">{displayNum}</p>}
                        <div className="flex items-center gap-1.5 mt-1">
                          <StatusBadge status={log.status} />
                          {log.duration > 0 && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                              <Clock size={9} />{fmtDuration(log.duration)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* New Call button at bottom */}
        <div className="p-3 border-t border-slate-100 bg-white">
          <button
            onClick={() => { setShowDialer(true); setSelectedLog(null); }}
            className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-sm transition-colors shadow-sm shadow-orange-500/20"
          >
            <Phone size={15} />
            New Call
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
              <p className="text-sm font-bold text-amber-800">Exotel not connected</p>
              <p className="text-xs text-amber-600 mt-0.5">Go to <strong>Settings → Integrations → Exotel</strong> to configure your API credentials and enable calling.</p>
            </div>
          </div>
        )}

        {/* Dialer view */}
        {(showDialer || !selectedLog) && (
          <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
            <div className="w-full max-w-sm">
              {/* Dialer header */}
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Phone size={28} className="text-orange-500" />
                </div>
                <h2 className="text-xl font-black text-slate-900">Make a Call</h2>
                <p className="text-sm text-slate-400 mt-1">Enter a number to initiate a VoIP call via Exotel</p>
                {settings?.caller_id && (
                  <p className="text-[11px] text-slate-400 mt-1">Caller ID: <span className="font-mono font-bold text-slate-600">{settings.caller_id}</span></p>
                )}
              </div>

              <DialPad
                value={dialerNumber}
                onChange={setDialerNumber}
                onCall={handleCall}
                isDialing={isDialing}
                callerIdDefault={settings?.caller_id}
              />

              {/* Result feedback */}
              {dialerResult && (
                <div className={cn(
                  'mt-4 p-3 rounded-xl flex items-center gap-2 text-sm font-medium',
                  dialerResult.success ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                )}>
                  {dialerResult.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {dialerResult.message}
                </div>
              )}

              {/* Quick dial from recent calls */}
              {logs.length > 0 && (
                <div className="mt-8">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Recent</p>
                  <div className="space-y-1">
                    {logs.slice(0, 5).map(log => {
                      const num = log.direction === 'inbound' ? log.from_number : log.to_number;
                      return (
                        <button
                          key={log.id}
                          onClick={() => setDialerNumber(num)}
                          className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-orange-50 border border-slate-100 hover:border-orange-100 rounded-xl transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <DirectionIcon direction={log.direction} status={log.status} />
                            <div className="text-left">
                              <p className="text-sm font-semibold text-slate-800">{log.contact_name || num}</p>
                              {log.contact_name && <p className="text-[10px] text-slate-400 font-mono">{num}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={log.status} />
                            <ChevronRight size={14} className="text-slate-300 group-hover:text-orange-400 transition-colors" />
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

        {/* Call detail view */}
        {!showDialer && selectedLog && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Top bar */}
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-white">
              <button
                onClick={() => { setShowDialer(true); setSelectedLog(null); }}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-orange-500 transition-colors font-medium"
              >
                <Phone size={14} />
                New Call
              </button>
              <button
                onClick={() => loadLogs()}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CallDetail log={selectedLog} onCallBack={handleCallBack} isDialing={isDialing} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
