import React, { useState, useEffect, useMemo } from 'react';
import { Download, Upload, Plus, Search, MoreHorizontal, User, MessageCircle, Instagram, Database, X, Trash2, RefreshCcw, Filter, ChevronLeft, ChevronRight, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { getContacts, getContactChannels, addContact, deleteContact, syncXoloxContacts, getXoloxSyncStatus } from '../api';

// Small helper to pick the right icon for a channel type
function ChannelIcon({ type, name }) {
    if (name === 'XOLOX') return <Database size={14} className="text-blue-500" />;
    if (type === 'whatsapp') return <MessageCircle size={14} className="text-green-600" />;
    if (type === 'instagram') return <Instagram size={14} className="text-pink-600" />;
    return <User size={14} className="text-slate-500" />;
}

const CHANNEL_TYPE_LABELS = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
    raw: 'System/API',
};

function channelLabel(ch) {
    if (ch.name === 'XOLOX') return 'XOLOX – API';
    return `${CHANNEL_TYPE_LABELS[ch.type] || ch.type} – ${ch.name}`;
}

// ──────────────────────────────────────────
// Add Contact Modal
// ──────────────────────────────────────────
function AddContactModal({ isOpen, onClose, channels, onSuccess }) {
    const [form, setForm] = useState({ channel_id: '', external_id: '', display_name: '' });
    const [rawJson, setRawJson] = useState('{}');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    // Reset when opened
    useEffect(() => {
        if (isOpen) {
            setForm({ channel_id: channels[0]?.id || '', external_id: '', display_name: '' });
            setRawJson('{}');
            setError('');
        }
    }, [isOpen, channels]);

    const selectedChannel = channels.find(c => c.id === form.channel_id);
    const isRaw = selectedChannel?.type === 'raw' || (!selectedChannel && false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!form.channel_id) { setError('Please select a channel.'); return; }
        if (!form.external_id.trim()) { setError('External ID / Phone is required.'); return; }

        let profile = {};
        if (isRaw) {
            try { profile = JSON.parse(rawJson); } catch {
                setError('Raw Data must be valid JSON.'); return;
            }
        }

        setSaving(true);
        try {
            const res = await addContact({
                channel_id: form.channel_id,
                external_id: form.external_id.trim(),
                display_name: form.display_name.trim() || null,
                profile,
            });

            if (res.success) {
                onSuccess(res.contact);
                onClose();
            } else {
                setError(res.error || 'Failed to create contact.');
            }
        } catch (err) {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Contact">
            <form onSubmit={handleSubmit} className="space-y-5">

                {/* Channel selector */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Channel <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <select
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 appearance-none pr-8"
                            value={form.channel_id}
                            onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))}
                        >
                            {channels.length === 0 && (
                                <option value="">No channels available</option>
                            )}
                            {channels.map(ch => (
                                <option key={ch.id} value={ch.id}>
                                    {channelLabel(ch)}
                                </option>
                            ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </div>
                    </div>
                </div>

                {/* External ID / Phone */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        External ID / Phone <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="e.g. 919876543210"
                        value={form.external_id}
                        onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))}
                    />
                </div>

                {/* Display Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Display Name <span className="text-slate-400 font-normal">(optional)</span>
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder="Full name"
                        value={form.display_name}
                        onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                    />
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                        <X size={14} />
                        {error}
                    </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-1 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
                        {saving ? 'Adding...' : 'Add Contact'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ──────────────────────────────────────────
// Main Contacts Page
// ──────────────────────────────────────────
export default function ContactsPage() {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalContacts, setTotalContacts] = useState(0);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);

    const [channels, setChannels] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);

    // Filter and Column Visibility State
    const [filters, setFilters] = useState({
        leadStage: '',
        course: '',
        assignedTo: ''
    });

    const [visibleColumns, setVisibleColumns] = useState({
        contact: true,
        channel: true,
        externalId: true,
        leadStage: true,
        course: true,
        assignedTo: true,
        source: false,
        syncAt: false,
        createdAt: true,
        actions: true
    });

    const fetchContacts = async (pageNum, search, activeFilters = filters) => {
        setIsLoading(true);
        try {
            const res = await getContacts(pageNum, 15, search, activeFilters);
            if (res.success) {
                setContacts(res.contacts);
                setTotalPages(res.pagination.totalPages);
                setTotalContacts(res.pagination.total);
            }
        } catch (e) {
            console.error('Failed to fetch contacts:', e);
        } finally {
            setIsLoading(false);
        }
    };

    // New Background Sync Logic
    const handleSyncAll = async () => {
        setIsSyncing(true);
        try {
            setSyncProgress(`Requesting background sync...`);
            const res = await syncXoloxContacts(1, 100, true);
            if (res.success) {
                setSyncProgress(`Background sync started! Moving to status tracking...`);
                // Polling starts automatically via the useEffect below
            } else {
                alert(res.message || 'Sync failed');
                setIsSyncing(false);
            }
        } catch (e) {
            console.error('Backend Sync Error:', e);
            alert('Could not start background sync');
            setIsSyncing(false);
        }
    };

    // Background Status Polling
    useEffect(() => {
        let pollTimer;
        const checkStatus = async () => {
            try {
                const res = await getXoloxSyncStatus();
                if (res.success && res.status.isRunning) {
                    setIsSyncing(true);
                    const s = res.status;
                    const percent = s.totalPages > 0 ? Math.round((s.currentPage / s.totalPages) * 100) : 0;
                    setSyncProgress(`Background Sync: Page ${s.currentPage} of ${s.totalPages} (${percent}%) - ${s.syncedLeads} leads`);
                    if (s.currentPage % 20 === 0) fetchContacts(page, searchTerm);
                    pollTimer = setTimeout(checkStatus, 3000);
                } else if (res.success && res.status.completedTime) {
                    setIsSyncing(false);
                    if (syncProgress && syncProgress.includes('Sync')) {
                        setSyncProgress(`✅ Full sync finished! Total Synced: ${res.status.syncedLeads}`);
                        fetchContacts(1, searchTerm);
                        setTimeout(() => setSyncProgress(null), 10000);
                    }
                } else if (res.success && res.status.lastError) {
                    setIsSyncing(false);
                    setSyncProgress(`❌ Sync failed: ${res.status.lastError}`);
                }
            } catch (err) {
                console.warn('Status poll failed:', err);
            }
        };
        checkStatus();
        return () => clearTimeout(pollTimer);
    }, [page, searchTerm]); 

    // Fetch channels for modal
    useEffect(() => {
        getContactChannels()
            .then(res => { if (res.success) setChannels(res.channels); })
            .catch(console.error);
    }, []);

    // Debounced search
    useEffect(() => {
        const handler = setTimeout(() => {
            setPage(1);
            fetchContacts(1, searchTerm);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchTerm]);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            fetchContacts(newPage, searchTerm);
        }
    };

    const handleContactAdded = (newContact) => {
        setContacts(prev => [newContact, ...prev]);
        setTotalContacts(prev => prev + 1);
    };

    const handleDeleteContact = async (contact) => {
        if (!window.confirm(`Are you sure? This will remove ${contact.display_name || contact.external_id}.`)) return;
        try {
            const res = await deleteContact(contact.id);
            if (res.success) {
                setContacts(prev => prev.filter(c => c.id !== contact.id));
                setTotalContacts(prev => prev - 1);
            }
        } catch (err) { console.error(err); }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">

            {/* Header */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0 z-10">
                <div className="flex items-center gap-4">
                    <h1 className="font-bold text-xl text-slate-900 tracking-tight">Contacts</h1>
                    <div className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[11px] font-bold uppercase tracking-wider border border-blue-100">
                        {totalContacts} Total
                    </div>
                </div>

                <div className="flex items-center space-x-3">
                    {syncProgress && (
                        <div className="text-xs font-semibold text-blue-600 animate-pulse hidden md:block mr-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100 italic">
                            {syncProgress}
                        </div>
                    )}
                    
                    <Button 
                        variant="outline" 
                        className={`flex items-center gap-2 bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50 relative overflow-hidden ${isSyncing ? 'pointer-events-none opacity-80' : ''}`}
                        onClick={() => handleSyncAll()}
                    >
                        <RefreshCcw size={16} className={isSyncing ? 'animate-spin' : ''} />
                        <span className="font-semibold">{isSyncing ? 'Batch Syncing...' : 'Bulk Sync XOLOX'}</span>
                    </Button>

                    <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block"></div>

                    <Button variant="outline" className="flex items-center gap-2 bg-white shadow-sm border-slate-200 text-slate-700 hover:bg-slate-50">
                        <Upload size={16} />
                        <span className="hidden sm:inline font-semibold">Import</span>
                    </Button>
                    <Button
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-100 transition-all font-semibold"
                        onClick={() => setShowAddModal(true)}
                    >
                        <Plus size={16} />
                        <span>Add Contact</span>
                    </Button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-4">

                    {/* Search & Filters */}
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search by name, ID or mobile..."
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all font-medium"
                                value={searchTerm}
                                onChange={(e) => {
                                    setSearchTerm(e.target.value);
                                    setPage(1);
                                    fetchContacts(1, e.target.value, filters);
                                }}
                            />
                        </div>

                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            <select 
                                className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.leadStage}
                                onChange={(e) => {
                                    const nf = { ...filters, leadStage: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Stage: All</option>
                                <option value="N2 Fresh Leads">N2 Fresh Leads</option>
                                <option value="N3 Working Leads">N3 Working Leads</option>
                                <option value="Interested">Interested</option>
                                <option value="Follow-up">Follow-up</option>
                                <option value="Converted">Converted</option>
                            </select>

                            <select 
                                className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.course}
                                onChange={(e) => {
                                    const nf = { ...filters, course: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Course: All</option>
                                <option value="CMA (USA)">CMA (USA)</option>
                                <option value="ACCA (UK)">ACCA (UK)</option>
                                <option value="CPA (USA)">CPA (USA)</option>
                            </select>

                            <select 
                                className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.assignedTo}
                                onChange={(e) => {
                                    const nf = { ...filters, assignedTo: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Agent: All</option>
                                <option value="Test User">Test User</option>
                            </select>

                            <div className="relative group ml-1">
                                <Button variant="outline" className="flex items-center gap-2 bg-white shadow-sm border-slate-200 text-slate-600 h-9 px-3 rounded-lg">
                                    <Filter size={14} className="text-slate-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Columns</span>
                                </Button>
                                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2 overflow-hidden transform scale-95 origin-top-right group-hover:scale-100">
                                    <div className="mb-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 -mx-2 -mt-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Column Visibility</span>
                                    </div>
                                    <div className="max-h-[300px] overflow-y-auto space-y-0.5 custom-scrollbar">
                                        {Object.keys(visibleColumns).map(col => (
                                            <label key={col} className="flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50/50 rounded-lg cursor-pointer transition-colors group/item">
                                                <input 
                                                    type="checkbox" 
                                                    checked={visibleColumns[col]} 
                                                    onChange={(e) => {
                                                        e.stopPropagation();
                                                        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
                                                    }}
                                                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500/20"
                                                />
                                                <span className="text-xs font-semibold text-slate-600 capitalize group-hover/item:text-blue-700">{col.replace(/([A-Z])/g, ' $1')}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden border-separate">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">
                                    <tr>
                                        {visibleColumns.contact && <th className="px-6 py-4">Identity</th>}
                                        {visibleColumns.channel && <th className="px-6 py-4">Channel</th>}
                                        {visibleColumns.externalId && <th className="px-6 py-4">Mobile/ID</th>}
                                        {visibleColumns.leadStage && <th className="px-6 py-4">Status / Stage</th>}
                                        {visibleColumns.course && <th className="px-6 py-4">Course</th>}
                                        {visibleColumns.assignedTo && <th className="px-6 py-4">Assigned To</th>}
                                        {visibleColumns.source && <th className="px-6 py-4">Source</th>}
                                        {visibleColumns.syncAt && <th className="px-6 py-4">Synced At</th>}
                                        {visibleColumns.createdAt && <th className="px-6 py-4">Created At</th>}
                                        {visibleColumns.actions && <th className="px-6 py-4 text-right"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="10" className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-3">
                                                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-slate-400 font-medium text-xs">Loading filtered leads...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : contacts.length === 0 ? (
                                        <tr>
                                            <td colSpan="10" className="px-6 py-20 text-center text-slate-400 font-medium italic text-xs">No leads found matching these filters. Try syncing with XOLOX.</td>
                                        </tr>
                                    ) : (
                                        contacts.map(contact => {
                                            const p = contact.profile || {};
                                            return (
                                                <tr key={contact.id} className="hover:bg-slate-50/70 transition-all group not-italic">
                                                    {visibleColumns.contact && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm border-2 ${p.syncedAt ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                                                    {contact.display_name?.charAt(0).toUpperCase() || <User size={18} />}
                                                                </div>
                                                                <div className="flex flex-col min-w-0">
                                                                    <span className="font-bold text-slate-900 truncate max-w-[150px]">{contact.display_name || 'Anonymous'}</span>
                                                                    <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">{p.email || 'No email'}</span>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.channel && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-1.5">
                                                                <ChannelIcon type={contact.channel_type} name={contact.channel_name} />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                    {contact.channel_name === 'XOLOX' ? 'Synced' : contact.channel_type}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.externalId && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs font-bold text-slate-700">{contact.external_id}</span>
                                                                {p.leadId && <span className="text-[9px] text-blue-500 font-bold">ID: {p.leadId}</span>}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.leadStage && (
                                                        <td className="px-6 py-4">
                                                            {p.leadStage ? (
                                                                <div className="inline-flex items-center px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 uppercase tracking-tight">
                                                                    {p.leadStage}
                                                                </div>
                                                            ) : <span className="text-slate-300 italic text-[10px]">None</span>}
                                                        </td>
                                                    )}
                                                    {visibleColumns.course && (
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-semibold text-slate-600 truncate max-w-[100px] block">{p.course || '—'}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.assignedTo && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">{(contact.assignee_name || p.assignedTo || 'U').charAt(0)}</div>
                                                                <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">{contact.assignee_name || p.assignedTo || 'Unassigned'}</span>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.source && <td className="px-6 py-4 text-xs text-slate-500">{p.leadSource || 'Direct'}</td>}
                                                    {visibleColumns.syncAt && (
                                                        <td className="px-6 py-4 text-[10px] text-slate-400 font-medium">
                                                            {p.syncedAt ? new Date(p.syncedAt).toLocaleDateString() : 'Never'}
                                                        </td>
                                                    )}
                                                    {visibleColumns.createdAt && (
                                                        <td className="px-6 py-4 text-[10px] text-slate-400 font-medium whitespace-nowrap">
                                                            {new Date(contact.created_at).toLocaleDateString()}
                                                        </td>
                                                    )}
                                                    {visibleColumns.actions && (
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
                                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ExternalLink size={16} /></Button>
                                                                <Button 
                                                                    variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                    onClick={() => handleDeleteContact(contact)}
                                                                ><Trash2 size={16} /></Button>
                                                            </div>
                                                        </td>
                                                    )}
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!isLoading && totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <div className="text-xs text-slate-500 font-bold">
                                    <span className="text-slate-900">{(page-1)*15 + 1}-{Math.min(page*15, totalContacts)}</span> OF {totalContacts}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        disabled={page === 1} 
                                        onClick={() => handlePageChange(page - 1)}
                                        className="h-8 px-3 text-[11px] font-bold bg-white"
                                    >
                                        <ChevronLeft size={14} className="mr-1" />
                                        PREV
                                    </Button>
                                    <div className="w-8 h-8 flex items-center justify-center rounded bg-blue-600 text-white text-xs font-bold shadow-sm">{page}</div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        disabled={page === totalPages} 
                                        onClick={() => handlePageChange(page + 1)}
                                        className="h-8 px-3 text-[11px] font-bold bg-white"
                                    >
                                        NEXT
                                        <ChevronRight size={14} className="ml-1" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                </div>
            </div>

            {/* Add Contact Modal */}
            <AddContactModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                channels={channels}
                onSuccess={handleContactAdded}
            />
        </div>
    );
}
