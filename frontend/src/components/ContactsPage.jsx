import React, { useState, useEffect, useMemo } from 'react';
import { Download, Upload, Plus, Search, MoreHorizontal, User, MessageCircle, Instagram, Database, X, Trash2, RefreshCcw, Filter, ChevronLeft, ChevronRight, ArrowRight, ExternalLink } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { getContacts, getContactChannels, addContact, deleteContact, syncXoloxContacts } from '../api';

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

    const fetchContacts = async (pageNum, search) => {
        setIsLoading(true);
        try {
            const res = await getContacts(pageNum, 15, search);
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

    // Global Sync logic
    const handleSyncXolox = async (pageNum = 1) => {
        setIsSyncing(true);
        setSyncProgress(`Syncing page ${pageNum}...`);
        try {
            const res = await syncXoloxContacts(pageNum, 100);
            if (res.success) {
                setSyncProgress(`Synced ${res.data.created + res.data.updated} contacts from page ${pageNum}.`);
                // Refresh contacts list
                fetchContacts(page, searchTerm);
                
                // Show a brief success message and clear after 3s
                setTimeout(() => setSyncProgress(null), 3000);
            } else {
                alert(res.message || 'Sync failed');
                setSyncProgress(null);
            }
        } catch (e) {
            console.error('Sync Error:', e);
            alert('A network error occurred during sync');
            setSyncProgress(null);
        } finally {
            setIsSyncing(false);
        }
    };

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
                        onClick={() => handleSyncXolox(1)}
                    >
                        <RefreshCcw size={16} className={isSyncing ? 'animate-spin' : ''} />
                        <span className="font-semibold">{isSyncing ? 'Syncing...' : 'Sync With XOLOX'}</span>
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

                    {/* Search */}
                    <div className="relative max-w-md w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, email or stage..."
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm shadow-sm outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden border-separate">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] whitespace-nowrap">
                                    <tr>
                                        <th className="px-6 py-4">Identity</th>
                                        <th className="px-6 py-4">Internal / Channel</th>
                                        <th className="px-6 py-4">Status / Stage</th>
                                        <th className="px-6 py-4">Assigned To</th>
                                        <th className="px-6 py-4">Synced/Created</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center">
                                                <div className="flex flex-col items-center justify-center space-y-3">
                                                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                    <span className="text-slate-400 font-medium">Loading contacts...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : contacts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-20 text-center text-slate-400 font-medium italic">No contacts found. Try syncing with XOLOX.</td>
                                        </tr>
                                    ) : (
                                        contacts.map(contact => {
                                            const p = contact.profile || {};
                                            return (
                                                <tr key={contact.id} className="hover:bg-slate-50/70 transition-all group">
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 font-bold text-sm border-2 ${p.syncedAt ? 'bg-indigo-50 text-indigo-600 border-indigo-100' : 'bg-slate-50 text-slate-600 border-slate-100'}`}>
                                                                {contact.display_name?.charAt(0).toUpperCase() || <User size={18} />}
                                                            </div>
                                                            <div className="flex flex-col min-w-0">
                                                                <span className="font-bold text-slate-900 truncate max-w-[180px]">
                                                                    {contact.display_name || 'Anonymous'}
                                                                </span>
                                                                {p.leadId && (
                                                                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 px-1 rounded-sm w-fit mb-0.5">ID: {p.leadId}</span>
                                                                )}
                                                                <span className="text-[11px] text-slate-400 font-medium truncate max-w-[180px]">
                                                                    {p.email || 'No email'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-slate-700">{contact.external_id}</span>
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <ChannelIcon type={contact.channel_type} name={contact.channel_name} />
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                                                    {contact.channel_name === 'XOLOX' ? 'Synced (API)' : (CHANNEL_TYPE_LABELS[contact.channel_type] || contact.channel_type)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col gap-1.5">
                                                            {p.leadStage ? (
                                                                <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-600 border border-orange-100 text-[10px] font-bold w-fit uppercase tabular-nums tracking-tight">
                                                                    {p.leadStage}
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-400 font-medium italic">General</span>
                                                            )}
                                                            {p.course && (
                                                                <span className="text-[10px] text-blue-600 font-semibold bg-blue-50/50 px-2 py-0.5 rounded-sm border border-blue-100/50 w-fit">
                                                                    {p.course}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        {contact.assignee_name || p.assignedTo ? (
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 text-[9px] flex items-center justify-center font-bold ring-2 ring-purple-50 shadow-sm uppercase">
                                                                    {(contact.assignee_name || p.assignedTo).charAt(0)}
                                                                </div>
                                                                <span className="text-xs font-bold text-slate-700 truncate max-w-[120px]">
                                                                    {contact.assignee_name || p.assignedTo}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-[11px] font-medium text-slate-400 italic">Unassigned</span>
                                                        )}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-slate-600">
                                                                {new Date(contact.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                            </span>
                                                            {p.syncedAt && (
                                                                <span className="text-[9px] text-green-500 font-bold uppercase mt-0.5 flex items-center gap-1">
                                                                    <RefreshCcw size={8} /> Synced
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex justify-end gap-1">
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                            >
                                                                <ExternalLink size={16} />
                                                            </Button>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="icon" 
                                                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                onClick={() => handleDeleteContact(contact)}
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        </div>
                                                    </td>
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
