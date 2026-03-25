import React, { useState, useEffect, useMemo } from 'react';
import { Download, Upload, Plus, Search, MoreHorizontal, User, MessageCircle, Instagram, Database, X, Trash2, RefreshCcw, Filter, ChevronLeft, ChevronRight, ChevronDown, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { useToast } from './ui/use-toast';
import { getContacts, getContactChannels, addContact, deleteContact, syncXoloxContacts, getXoloxSyncStatus, putContact } from '../api';

const LEAD_STAGES = [
    'N2 Fresh Leads',
    'N2 Minus',
    'N2 Plus',
    'N3 Interested',
    'N3 Plus',
    'N3 Minus',
    'Lost',
    'Converted'
];

const LEAD_STATUSES = [
    'new',
    'renewed',
    'assigned',
    'contacted',
    'interested',
    'not_interested',
    'counseling',
    'won',
    'lost'
];

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
// Contact Details Side Modal (Drawer)
// ──────────────────────────────────────────
function ContactDetailsModal({ contact, isOpen, onClose, onDelete, onUpdate }) {
    if (!contact) return null;
    const { toast } = useToast();
    const p = contact.profile || {};
    const [isSaving, setIsSaving] = useState(false);
    const [editForm, setEditForm] = useState({ 
        display_name: contact.display_name || '', 
        course: contact.course || p.course || '',
        lead_stage: contact.lead_stage || p.leadStage || '',
        lead_status: contact.lead_status || 'new'
    });

    const handleUpdateContact = async () => {
        setIsSaving(true);
        try {
            // Re-using a generic update contact API or creating one if needed
            // For now, we'll use putContact for direct Registry updates
            const res = await putContact(contact.id, editForm);
            if (res.success) {
                toast({ description: "Registry record updated", duration: 1200 });
                onUpdate(res.contact);
                onClose();
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className={`fixed inset-0 z-[100] transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
            
            {/* Slide-out Panel */}
            <div className={`absolute right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-out border-l border-slate-200 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="text-lg font-bold text-slate-900">Lead Registry Details</h2>
                        <p className="text-xs text-slate-500 font-medium">Internal System ID: <span className="text-blue-600 font-bold">{contact.id.slice(0, 8)}...</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-8 space-y-9 no-scrollbar">
                    
                    {/* Hero Section */}
                    <div className="flex flex-col items-center text-center space-y-4">
                        <div className="relative">
                            <div className="w-20 h-20 rounded-2xl bg-blue-600 flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-blue-100 border-4 border-white ring-1 ring-blue-50">
                                {contact.display_name?.charAt(0).toUpperCase() || <User size={32} />}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-white rounded-lg shadow-md border border-slate-100 flex items-center justify-center">
                                <ChannelIcon type={contact.channel_type} name={contact.channel_name} />
                            </div>
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">{contact.display_name || 'Anonymous Lead'}</h3>
                            <div className="flex items-center justify-center gap-2 mt-1.5">
                                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-wider border border-slate-200">
                                    {contact.channel_name}
                                </span>
                                {(contact.lead_stage || p.leadStage) && (
                                    <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold uppercase tracking-wider border border-orange-200">
                                        {contact.lead_stage || p.leadStage}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100/50 text-center">
                            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Assigned Agent</p>
                            <p className="text-sm font-bold text-slate-700">{contact.assignee_name || contact.assigned_to || p.assignedTo || 'Unassigned'}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100/50 text-center">
                            <p className="text-[10px] font-bold text-purple-400 uppercase tracking-widest mb-1">Selected Course</p>
                            <p className="text-sm font-bold text-slate-700">{contact.course || p.course || 'None'}</p>
                        </div>
                    </div>

                    {/* Metadata Groups */}
                    <div className="space-y-6">
                        <section>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                                <div className="h-px bg-slate-100 flex-1"></div>
                                Contact Information
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                                <DataField icon={<User size={14}/>} label="Full Identity" value={contact.display_name || 'N/A'} />
                                <DataField icon={<MessageCircle size={14}/>} label="Primary Mobile" value={contact.external_id} />
                                <DataField icon={<Download size={14}/>} label="Email Address" value={p.email || 'N/A'} />
                                <DataField icon={<RefreshCcw size={14}/>} label="Lead Source" value={p.leadSource || 'Direct Import'} />
                            </div>
                        </section>

                        <section>
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                                <div className="h-px bg-slate-100 flex-1"></div>
                                System Attributes
                            </h4>
                            <div className="grid grid-cols-1 gap-4">
                                <DataField label="Registered At" value={new Date(contact.created_at).toLocaleString()} />
                                <DataField label="Last XOLOX Sync" value={(contact.last_sync_at || p.syncedAt) ? new Date(contact.last_sync_at || p.syncedAt).toLocaleString() : 'Never'} />
                                <DataField label="Lead Score / ID" value={contact.lead_id || p.leadId || 'N/A'} />
                            </div>
                        </section>

                        <section className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                            <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4">Lead Categorization</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Lead Status (CRT Track)</label>
                                    <select 
                                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-blue-500"
                                        value={editForm.lead_status}
                                        onChange={e => setEditForm(v => ({ ...v, lead_status: e.target.value }))}
                                    >
                                        {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block">Lead Stage (N2 Track)</label>
                                    <select 
                                        className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 outline-none focus:border-blue-500"
                                        value={editForm.lead_stage}
                                        onChange={e => setEditForm(v => ({ ...v, lead_stage: e.target.value }))}
                                    >
                                        <option value="">SELECT STAGE</option>
                                        {LEAD_STAGES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                                    </select>
                                </div>
                            </div>
                        </section>

                        {contact.profile && Object.keys(contact.profile).length > 0 && (
                            <section>
                                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-4 flex items-center gap-2">
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                    Raw Profile Snapshot
                                </h4>
                                <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
                                    <pre className="text-[11px] font-mono text-blue-300/80 leading-relaxed">
                                        {JSON.stringify(contact.profile, null, 2)}
                                    </pre>
                                </div>
                            </section>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-5 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                    <Button variant="outline" className="flex-1 font-bold text-xs" onClick={() => { onDelete(contact); onClose(); }}>
                        <Trash2 size={14} className="mr-2 text-red-500" />
                        DELETE RECORD
                    </Button>
                    <Button 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs" 
                        onClick={handleUpdateContact}
                        disabled={isSaving}
                    >
                        <ExternalLink size={14} className="mr-2" />
                        {isSaving ? 'SAVING...' : 'UPDATE DATA'}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function DataField({ icon, label, value }) {
    return (
        <div className="flex items-start gap-3">
            {icon && <div className="mt-1 text-slate-400">{icon}</div>}
            <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">{label}</span>
                <span className="text-sm font-semibold text-slate-700 break-words">{value}</span>
            </div>
        </div>
    );
}

// ──────────────────────────────────────────
// Add Contact Modal
// ──────────────────────────────────────────
function AddContactModal({ isOpen, onClose, channels, onSuccess }) {
    const [form, setForm] = useState({ channel_id: '', external_id: '', display_name: '' });
    const [rawJson, setRawJson] = useState('{}');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setForm({ channel_id: channels[0]?.id || '', external_id: '', display_name: '' });
            setRawJson('{}');
            setError('');
        }
    }, [isOpen, channels]);

    const selectedChannel = channels.find(c => c.id === form.channel_id);
    const isRaw = selectedChannel?.type === 'raw';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!form.channel_id) { setError('Select a channel.'); return; }
        if (!form.external_id.trim()) { setError('Mobile/ID required.'); return; }

        setSaving(true);
        try {
            const res = await addContact({
                channel_id: form.channel_id,
                external_id: form.external_id.trim(),
                display_name: form.display_name.trim() || null,
                profile: isRaw ? JSON.parse(rawJson) : {},
            });
            if (res.success) { onSuccess(res.contact); onClose(); }
            else setError(res.error || 'Failed.');
        } catch (err) { setError('Network error.'); }
        finally { setSaving(false); }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Add New Contact">
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Channel</label>
                    <select
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                        value={form.channel_id}
                        onChange={e => setForm(f => ({ ...f, channel_id: e.target.value }))}
                    >
                        {channels.map(ch => <option key={ch.id} value={ch.id}>{channelLabel(ch)}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile / ID</label>
                    <input
                        type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        value={form.external_id} onChange={e => setForm(f => ({ ...f, external_id: e.target.value }))}
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Display Name</label>
                    <input
                        type="text" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                    />
                </div>
                {error && <div className="text-xs text-red-500 font-bold">{error}</div>}
                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
                        {saving ? 'Saving...' : 'Add Contact'}
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
    const [rowsPerPage, setRowsPerPage] = useState(15);
    const [totalPages, setTotalPages] = useState(1);
    const [totalContacts, setTotalContacts] = useState(0);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncProgress, setSyncProgress] = useState(null);

    const [channels, setChannels] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedContact, setSelectedContact] = useState(null);
    const [showColumnMenu, setShowColumnMenu] = useState(false);

    // Filter and Column Visibility State
    const [filters, setFilters] = useState({
        leadStage: '',
        leadStatus: '',
        course: '',
        assignedTo: ''
    });

    const [visibleColumns, setVisibleColumns] = useState({
        contact: true,
        channel: true,
        externalId: true,
        leadStage: true,
        leadStatus: true,
        course: true,
        assignedTo: true,
        source: false,
        syncAt: false,
        createdAt: true,
        actions: true
    });

    const fetchContacts = async (pageNum, search, activeFilters = filters, limit = rowsPerPage) => {
        setIsLoading(true);
        try {
            const res = await getContacts(pageNum, limit, search, activeFilters);
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
                                {LEAD_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            <select 
                                className="text-[11px] font-bold bg-white border border-slate-200 rounded-lg px-2 py-2 focus:ring-2 focus:ring-blue-500/10 outline-none uppercase tracking-wide text-slate-600 cursor-pointer"
                                value={filters.leadStatus}
                                onChange={(e) => {
                                    const nf = { ...filters, leadStatus: e.target.value };
                                    setFilters(nf); setPage(1); fetchContacts(1, searchTerm, nf);
                                }}
                            >
                                <option value="">Status: All</option>
                                {LEAD_STATUSES.map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
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
                                <option value="CPA">CPA</option>
                                <option value="CMA USA">CMA USA</option>
                                <option value="ACCA">ACCA</option>
                                <option value="EA">EA</option>
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

                            <div className="relative ml-1">
                                <Button 
                                    variant="outline" 
                                    className={`flex items-center gap-2 bg-white shadow-sm border-slate-200 text-slate-600 h-9 px-3 rounded-lg ${showColumnMenu ? 'ring-2 ring-blue-500/20 border-blue-200' : ''}`}
                                    onClick={() => setShowColumnMenu(!showColumnMenu)}
                                >
                                    <Filter size={14} className="text-slate-400" />
                                    <span className="text-[11px] font-bold uppercase tracking-wider">Columns</span>
                                </Button>
                                {showColumnMenu && (
                                    <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 p-2 transform origin-top-right transition-all whitespace-normal">
                                        <div className="flex items-center justify-between mb-2 px-3 py-1.5 bg-slate-50 border-b border-slate-100 -mx-2 -mt-2">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Visibility Control</span>
                                        </div>
                                        <div className="max-h-[350px] overflow-y-auto space-y-0.5 custom-scrollbar pb-1">
                                            {Object.keys(visibleColumns).map(col => (
                                                <div 
                                                    key={col} 
                                                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-blue-50/70 rounded-lg cursor-pointer transition-all group/item select-none"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setVisibleColumns(prev => ({ ...prev, [col]: !prev[col] }));
                                                    }}
                                                >
                                                    <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${visibleColumns[col] ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                                                        {visibleColumns[col] && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                                    </div>
                                                    <span className={`text-xs font-semibold capitalize transition-colors ${visibleColumns[col] ? 'text-blue-700' : 'text-slate-500'}`}>
                                                        {col.replace(/([A-Z])/g, ' $1')}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
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
                                        {visibleColumns.leadStage && <th className="px-6 py-4">Lead Stage</th>}
                                        {visibleColumns.leadStatus && <th className="px-6 py-4">Lead Status</th>}
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
                                                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm border-2 ${(contact.last_sync_at || p.syncedAt) ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                                                    {contact.display_name?.charAt(0).toUpperCase() || <User size={18} />}
                                                                </div>
                                                                <div className="flex flex-col min-w-0 cursor-pointer group/name" onClick={() => setSelectedContact(contact)}>
                                                                    <span className="font-bold text-slate-900 truncate max-w-[150px] group-hover/name:text-blue-600 transition-colors">{contact.display_name || 'Anonymous'}</span>
                                                                    <span className="text-[11px] text-slate-400 font-medium truncate max-w-[150px]">{contact.email || p.email || 'No email'}</span>
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
                                                                {(contact.lead_id || p.leadId) && <span className="text-[9px] text-blue-500 font-bold">ID: {contact.lead_id || p.leadId}</span>}
                                                            </div>
                                                        </td>
                                                    )}
                                                    {visibleColumns.leadStage && (
                                                        <td className="px-6 py-4">
                                                            {(contact.lead_stage || p.leadStage) ? (
                                                                <div className="inline-flex items-center px-2 py-1 rounded bg-amber-50 text-amber-700 text-[10px] font-bold border border-amber-100 uppercase tracking-tight">
                                                                    {contact.lead_stage || p.leadStage}
                                                                </div>
                                                            ) : <span className="text-slate-300 italic text-[10px]">None</span>}
                                                        </td>
                                                    )}
                                                    {visibleColumns.leadStatus && (
                                                        <td className="px-6 py-4">
                                                            {(contact.lead_status || p.leadStatus) ? (
                                                                <div className="inline-flex items-center px-2 py-1 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100 uppercase tracking-tight">
                                                                    {contact.lead_status || p.leadStatus}
                                                                </div>
                                                            ) : <span className="text-slate-300 italic text-[10px]">None</span>}
                                                        </td>
                                                    )}
                                                    {visibleColumns.course && (
                                                        <td className="px-6 py-4">
                                                            <span className="text-xs font-semibold text-slate-600 truncate max-w-[100px] block">{contact.course || p.course || '—'}</span>
                                                        </td>
                                                    )}
                                                    {visibleColumns.assignedTo && (
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-500">{(contact.assignee_name || contact.assigned_to || p.assignedTo || 'U').charAt(0)}</div>
                                                                <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">{contact.assignee_name || contact.assigned_to || p.assignedTo || 'Unassigned'}</span>
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
                                                                <Button 
                                                                    variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                                    onClick={() => setSelectedContact(contact)}
                                                                >
                                                                    <ExternalLink size={16} />
                                                                </Button>
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
                        {!isLoading && totalContacts > 0 && (
                            <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <div className="flex items-center gap-6">
                                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                                        <span className="text-slate-900">{(page-1)*rowsPerPage + 1}-{Math.min(page*rowsPerPage, totalContacts)}</span> OF {totalContacts}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rows:</span>
                                        <select 
                                            value={rowsPerPage}
                                            onChange={(e) => {
                                                const newLimit = Number(e.target.value);
                                                setRowsPerPage(newLimit);
                                                setPage(1);
                                                fetchContacts(1, searchTerm, filters, newLimit);
                                            }}
                                            className="bg-transparent text-[11px] font-bold text-slate-600 outline-none cursor-pointer border-b border-slate-300 focus:border-blue-500 pb-0.5"
                                        >
                                            <option value={10}>10</option>
                                            <option value={15}>15</option>
                                            <option value={25}>25</option>
                                            <option value={50}>50</option>
                                            <option value={100}>100</option>
                                        </select>
                                    </div>
                                </div>

                                {totalPages > 1 && (
                                    <div className="flex items-center gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            disabled={page === 1} 
                                            onClick={() => handlePageChange(page - 1)}
                                            className="h-8 px-3 text-[11px] font-bold bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                                        >
                                            <ChevronLeft size={14} className="mr-1" />
                                            PREV
                                        </Button>
                                        
                                        <div className="relative group/page">
                                            <select 
                                                value={page}
                                                onChange={(e) => handlePageChange(Number(e.target.value))}
                                                className="h-8 pl-3 pr-8 bg-blue-600 text-white text-xs font-bold rounded shadow-sm appearance-none cursor-pointer outline-none hover:bg-blue-700 transition-colors border-none ring-offset-2 focus:ring-2 focus:ring-blue-500"
                                            >
                                                {Array.from({ length: Math.min(totalPages, 5000) }, (_, i) => i + 1).map(p => (
                                                    <option key={p} value={p} className="bg-white text-slate-900 font-semibold">{p}</option>
                                                ))}
                                            </select>
                                            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/80 pointer-events-none group-hover/page:text-white transition-colors" />
                                        </div>

                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            disabled={page === totalPages} 
                                            onClick={() => handlePageChange(page + 1)}
                                            className="h-8 px-3 text-[11px] font-bold bg-white border-slate-200 hover:bg-slate-50 text-slate-600"
                                        >
                                            NEXT
                                            <ChevronRight size={14} className="ml-1" />
                                        </Button>
                                    </div>
                                )}
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

            <ContactDetailsModal
                contact={selectedContact}
                isOpen={!!selectedContact}
                onClose={() => setSelectedContact(null)}
                onDelete={handleDeleteContact}
            />
        </div>
    );
}
