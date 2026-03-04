import React, { useState, useEffect } from 'react';
import { Download, Upload, Plus, Search, MoreHorizontal, User, MessageCircle, Instagram, Database, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { getContacts, getContactChannels, addContact } from '../api';

// Small helper to pick the right icon for a channel type
function ChannelIcon({ type }) {
    if (type === 'whatsapp') return <MessageCircle size={14} className="text-green-600" />;
    if (type === 'instagram') return <Instagram size={14} className="text-pink-600" />;
    return <Database size={14} className="text-slate-500" />;
}

const CHANNEL_TYPE_LABELS = {
    whatsapp: 'WhatsApp',
    instagram: 'Instagram',
};

function channelLabel(ch) {
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

                    {/* Channel type badge */}
                    {selectedChannel && (
                        <div className="mt-2 flex items-center gap-1.5">
                            <ChannelIcon type={selectedChannel.type} />
                            <span className="text-xs text-slate-500 capitalize">
                                {CHANNEL_TYPE_LABELS[selectedChannel.type] || selectedChannel.type} channel
                            </span>
                        </div>
                    )}
                </div>

                {/* External ID / Phone */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        {selectedChannel?.type === 'whatsapp' ? 'Phone Number' :
                            selectedChannel?.type === 'instagram' ? 'Instagram User ID' : 'External ID'}
                        {' '}<span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        placeholder={
                            selectedChannel?.type === 'whatsapp' ? 'e.g. 919876543210 (with country code)' :
                                selectedChannel?.type === 'instagram' ? 'e.g. 1234567890' : 'Unique external identifier'
                        }
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

                {/* Raw JSON profile data — show for raw/unknown channels */}
                {isRaw && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Raw Profile Data (JSON)</label>
                        <textarea
                            rows={4}
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={rawJson}
                            onChange={e => setRawJson(e.target.value)}
                        />
                    </div>
                )}

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

    const [channels, setChannels] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchContacts = async (pageNum, search) => {
        setIsLoading(true);
        try {
            const res = await getContacts(pageNum, 10, search);
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

    // Fetch channels once (for the Add Contact dropdown)
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

    // After a contact is created successfully, prepend it and bump total count
    const handleContactAdded = (newContact) => {
        setContacts(prev => [newContact, ...prev]);
        setTotalContacts(prev => prev + 1);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">

            {/* Header */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="font-semibold text-xl text-slate-800">All Contacts</h1>
                    <p className="text-sm text-slate-500">{totalContacts} contacts total</p>
                </div>
                <div className="flex items-center space-x-3">
                    <Button variant="outline" className="flex items-center gap-2">
                        <Upload size={16} />
                        <span className="hidden sm:inline">Upload CSV</span>
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                        <Download size={16} />
                        <span className="hidden sm:inline">Export</span>
                    </Button>
                    <Button
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
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
                    <div className="flex items-center w-full max-w-md bg-white border border-slate-300 rounded-md px-3 py-2">
                        <Search className="w-5 h-5 text-slate-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search contacts by name or external ID..."
                            className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium whitespace-nowrap">
                                    <tr>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">External ID</th>
                                        <th className="px-6 py-4">Channel</th>
                                        <th className="px-6 py-4">Assigned To</th>
                                        <th className="px-6 py-4">Created At</th>
                                        <th className="px-6 py-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-slate-500">Loading contacts...</td>
                                        </tr>
                                    ) : contacts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-slate-500">No contacts found.</td>
                                        </tr>
                                    ) : (
                                        contacts.map(contact => (
                                            <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                            <User className="text-slate-400" size={18} />
                                                        </div>
                                                        <span className="font-medium text-slate-900">
                                                            {contact.display_name || 'Unknown Contact'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600 font-mono text-xs">{contact.external_id}</td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize border border-blue-100">
                                                        <ChannelIcon type={contact.channel_type} />
                                                        {CHANNEL_TYPE_LABELS[contact.channel_type] || contact.channel_type || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {contact.assignee_name ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                            {contact.assignee_name}
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                                            Unassigned
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">{new Date(contact.created_at).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-900">
                                                        <MoreHorizontal size={16} />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {!isLoading && totalPages > 1 && (
                            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
                                <div className="text-sm text-slate-500">
                                    Page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button variant="outline" size="sm" disabled={page === 1} onClick={() => handlePageChange(page - 1)}>Previous</Button>
                                    <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => handlePageChange(page + 1)}>Next</Button>
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
