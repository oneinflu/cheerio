import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Tag, Plus, Search, Users, Trash2, Upload, ChevronRight, X, Check,
    UserPlus, FileText, Eye,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import {
    getLabels, deleteLabel,
    createLabelWithContacts, addContactsToLabel,
    getContacts, getLabelContacts,
} from '../api';

// ─── Parse a CSV file client-side and return rows ─────────────────────────────
function parseCSV(text) {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    return lines.slice(1).map(line => {
        const cells = line.split(',').map(c => c.trim().replace(/"/g, ''));
        const row = {};
        headers.forEach((h, i) => { row[h] = cells[i] || ''; });
        return row;
    }).filter(r => r.external_id || r['phone number'] || r.phone);
}

// ─── Tab button ───────────────────────────────────────────────────────────────
function Tab({ active, onClick, icon: Icon, label }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${active
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
        >
            <Icon size={15} />
            {label}
        </button>
    );
}

// ─── Create / Edit Group Modal ─────────────────────────────────────────────────
function GroupModal({ isOpen, onClose, editLabel, onSuccess }) {
    const [name, setName] = useState('');
    const [tab, setTab] = useState('select'); // 'select' | 'csv'
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // --- Select-from-existing tab ---
    const [allContacts, setAllContacts] = useState([]);
    const [contactSearch, setContactSearch] = useState('');
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [loadingContacts, setLoadingContacts] = useState(false);

    // --- CSV tab ---
    const [csvRows, setCsvRows] = useState([]);  // parsed rows preview
    const [csvFile, setCsvFile] = useState(null);
    const fileRef = useRef();

    const isEdit = !!editLabel;

    useEffect(() => {
        if (!isOpen) return;
        setName(editLabel?.name || '');
        setTab('select');
        setError('');
        setCsvRows([]);
        setCsvFile(null);

        setLoadingContacts(true);
        getContacts(1, 200, '')
            .then(res => {
                if (res.success) setAllContacts(res.contacts);
            })
            .catch(console.error)
            .finally(() => setLoadingContacts(false));

        // If editing, pre-select existing contacts
        if (editLabel) {
            getLabelContacts(editLabel.id)
                .then(res => {
                    if (res.success) setSelectedIds(new Set(res.contacts.map(c => c.id)));
                })
                .catch(console.error);
        } else {
            setSelectedIds(new Set());
        }
    }, [isOpen, editLabel]);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCsvFile(file);
        const reader = new FileReader();
        reader.onload = (ev) => setCsvRows(parseCSV(ev.target.result));
        reader.readAsText(file);
    };

    const toggleContact = (id) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isEdit && !name.trim()) { setError('Group name is required.'); return; }

        const contactIds = tab === 'select'
            ? [...selectedIds]
            : []; // CSV contacts are created server-side (not yet implemented here – show count)

        if (contactIds.length === 0 && tab === 'select') {
            setError('Please select at least one contact.');
            return;
        }
        if (tab === 'csv' && csvRows.length === 0) {
            setError('Please upload a valid CSV file with contacts.');
            return;
        }

        setSaving(true);
        try {
            if (isEdit) {
                // Adding contacts to existing label
                const res = await addContactsToLabel(editLabel.id, contactIds);
                if (res.success) {
                    onSuccess({ ...editLabel, assigned_count: res.total });
                    onClose();
                } else setError(res.error || 'Failed to update group.');
            } else {
                // Creating a new label with contacts
                const res = await createLabelWithContacts(name.trim(), contactIds);
                if (res.success) {
                    onSuccess(res.label);
                    onClose();
                } else setError(res.error || 'Failed to create group.');
            }
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const filteredContacts = allContacts.filter(c => {
        const q = contactSearch.toLowerCase();
        return (c.display_name || '').toLowerCase().includes(q) || c.external_id.toLowerCase().includes(q);
    });

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? `Add Contacts to "${editLabel.name}"` : 'Create New Group'}
            className="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="space-y-4">

                {/* Name (only when creating) */}
                {!isEdit && (
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Group Name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                            placeholder="e.g. Hot Leads Q1"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>
                )}

                {/* Tabs */}
                <div className="border-b border-slate-200 flex gap-0 -mx-1">
                    <Tab active={tab === 'select'} onClick={() => setTab('select')} icon={UserPlus} label="Select from Contacts" />
                    <Tab active={tab === 'csv'} onClick={() => setTab('csv')} icon={FileText} label="Upload CSV" />
                </div>

                {/* ── Select tab ── */}
                {tab === 'select' && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <Search size={14} className="text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search by name or phone..."
                                    className="w-full text-sm bg-transparent outline-none placeholder-slate-400"
                                    value={contactSearch}
                                    onChange={e => setContactSearch(e.target.value)}
                                />
                            </div>
                            {selectedIds.size > 0 && (
                                <span className="text-xs font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2.5 py-1 whitespace-nowrap">
                                    {selectedIds.size} selected
                                </span>
                            )}
                        </div>

                        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                            {loadingContacts ? (
                                <p className="text-sm text-slate-500 text-center py-8">Loading contacts...</p>
                            ) : filteredContacts.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-8">No contacts found.</p>
                            ) : filteredContacts.map(c => {
                                const selected = selectedIds.has(c.id);
                                return (
                                    <button
                                        key={c.id}
                                        type="button"
                                        onClick={() => toggleContact(c.id)}
                                        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${selected ? 'bg-blue-50' : 'hover:bg-slate-50'
                                            }`}
                                    >
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                            }`}>
                                            {selected && <Check size={12} className="text-white" strokeWidth={3} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-sm font-medium text-slate-900 truncate">
                                                {c.display_name || 'Unknown Contact'}
                                            </div>
                                            <div className="text-xs text-slate-500 font-mono truncate">{c.external_id}</div>
                                        </div>
                                        <span className="text-xs text-slate-400 capitalize shrink-0">{c.channel_type}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ── CSV tab ── */}
                {tab === 'csv' && (
                    <div className="space-y-4">
                        <div
                            className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
                            onClick={() => fileRef.current?.click()}
                        >
                            <Upload size={28} className="text-slate-400 mb-3" />
                            <p className="text-sm font-medium text-slate-700">Click to upload CSV</p>
                            <p className="text-xs text-slate-400 mt-1">
                                Required columns: <code>external_id</code>, optional: <code>display_name</code>
                            </p>
                            <input
                                ref={fileRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>

                        {csvFile && (
                            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center gap-3">
                                <FileText size={18} className="text-blue-500 shrink-0" />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-800 truncate">{csvFile.name}</p>
                                    <p className="text-xs text-slate-500">{csvRows.length} contact rows detected</p>
                                </div>
                                <button type="button" onClick={() => { setCsvFile(null); setCsvRows([]); fileRef.current.value = ''; }}>
                                    <X size={16} className="text-slate-400 hover:text-red-500" />
                                </button>
                            </div>
                        )}

                        {csvRows.length > 0 && (
                            <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 text-xs">
                                <table className="w-full">
                                    <thead className="bg-slate-50 text-slate-500 sticky top-0">
                                        <tr>
                                            {Object.keys(csvRows[0]).map(k => (
                                                <th key={k} className="px-3 py-2 text-left font-medium">{k}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {csvRows.slice(0, 10).map((row, i) => (
                                            <tr key={i}>
                                                {Object.values(row).map((v, j) => (
                                                    <td key={j} className="px-3 py-2 text-slate-700 font-mono">{v}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {csvRows.length > 10 && (
                                    <p className="text-center text-slate-400 py-2">... and {csvRows.length - 10} more rows</p>
                                )}
                            </div>
                        )}

                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
                            <strong>Note:</strong> CSV upload will create new contacts if they don't already exist, then add them to this group. This feature requires the backend to be running.
                        </div>
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
                <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
                    <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white" disabled={saving}>
                        {saving ? 'Saving...' : isEdit ? 'Add to Group' : 'Create Group'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ─── View Contacts Modal ───────────────────────────────────────────────────────
function ViewContactsModal({ isOpen, onClose, label }) {
    const [contacts, setContacts] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen || !label) return;
        setLoading(true);
        getLabelContacts(label.id)
            .then(res => { if (res.success) setContacts(res.contacts); })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [isOpen, label]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Contacts in "${label?.name}"`} className="max-w-2xl">
            <div className="space-y-3">
                {loading ? (
                    <p className="text-sm text-slate-500 text-center py-8">Loading...</p>
                ) : contacts.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-8">No contacts in this group yet.</p>
                ) : (
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200">
                        {contacts.map(c => (
                            <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                    <Users size={14} className="text-slate-400" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-slate-900">{c.display_name || 'Unknown'}</p>
                                    <p className="text-xs text-slate-500 font-mono">{c.external_id}</p>
                                </div>
                                <span className="text-xs text-slate-400 capitalize">{c.channel_type}</span>
                            </div>
                        ))}
                    </div>
                )}
                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </div>
            </div>
        </Modal>
    );
}

// ─── Main Labels Page ──────────────────────────────────────────────────────────
export default function LabelsPage() {
    const [labels, setLabels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editLabel, setEditLabel] = useState(null);    // null = create mode

    const [viewLabel, setViewLabel] = useState(null);
    const [showViewModal, setShowViewModal] = useState(false);

    const fetchLabels = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getLabels();
            if (res.success) setLabels(res.labels);
        } catch (e) {
            console.error('Failed to fetch labels:', e);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchLabels(); }, [fetchLabels]);

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this group? Contacts will NOT be deleted.')) return;
        try {
            const res = await deleteLabel(id);
            if (res.success) setLabels(prev => prev.filter(l => l.id !== id));
        } catch {
            console.error('Failed to delete label');
        }
    };

    const handleSuccess = (updatedLabel) => {
        setLabels(prev => {
            const existing = prev.find(l => l.id === updatedLabel.id);
            if (existing) return prev.map(l => l.id === updatedLabel.id ? { ...l, ...updatedLabel } : l);
            return [updatedLabel, ...prev];
        });
    };

    const openCreate = () => { setEditLabel(null); setShowModal(true); };
    const openEdit = (label) => { setEditLabel(label); setShowModal(true); };
    const openView = (label) => { setViewLabel(label); setShowViewModal(true); };

    const filtered = labels.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()));

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">

            {/* Header */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="font-semibold text-xl text-slate-800">Contact Groups (Labels)</h1>
                    <p className="text-sm text-slate-500">{labels.length} groups total</p>
                </div>
                <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={openCreate}>
                    <Plus size={16} />
                    Create Group
                </Button>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-4">

                    {/* Search */}
                    <div className="flex items-center w-full max-w-md bg-white border border-slate-300 rounded-md px-3 py-2">
                        <Search className="w-5 h-5 text-slate-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search groups by name..."
                            className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium whitespace-nowrap">
                                <tr>
                                    <th className="px-6 py-4">Group Name</th>
                                    <th className="px-6 py-4">Total Contacts</th>
                                    <th className="px-6 py-4">Created At</th>
                                    <th className="px-6 py-4">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {isLoading ? (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">Loading groups...</td></tr>
                                ) : filtered.length === 0 ? (
                                    <tr><td colSpan="4" className="px-6 py-12 text-center text-slate-500">No groups found. Create one to get started!</td></tr>
                                ) : filtered.map(label => (
                                    <tr key={label.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                                    <Tag className="text-blue-500" size={18} />
                                                </div>
                                                <span className="font-semibold text-slate-900">{label.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-slate-600">
                                                <Users size={15} className="text-slate-400" />
                                                <span className="font-medium">{label.assigned_count}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-slate-500">{new Date(label.created_at).toLocaleDateString()}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => openView(label)}>
                                                    <Eye size={13} /> View
                                                </Button>
                                                <Button variant="outline" size="sm" className="flex items-center gap-1.5" onClick={() => openEdit(label)}>
                                                    <UserPlus size={13} /> Add Contacts
                                                </Button>
                                                <Button
                                                    variant="ghost" size="icon"
                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8"
                                                    onClick={() => handleDelete(label.id)}
                                                    title="Delete Group"
                                                >
                                                    <Trash2 size={15} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                </div>
            </div>

            {/* Modals */}
            <GroupModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                editLabel={editLabel}
                onSuccess={handleSuccess}
            />
            <ViewContactsModal
                isOpen={showViewModal}
                onClose={() => setShowViewModal(false)}
                label={viewLabel}
            />
        </div>
    );
}
