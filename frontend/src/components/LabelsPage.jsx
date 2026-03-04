import React, { useState, useEffect } from 'react';
import { Tag, Plus, Search, MoreHorizontal, Users, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { getLabels, createLabel, deleteLabel } from '../api';

export default function LabelsPage() {
    const [labels, setLabels] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');

    const fetchLabels = async () => {
        setIsLoading(true);
        try {
            const res = await getLabels();
            if (res.success) {
                setLabels(res.labels);
            }
        } catch (e) {
            console.error('Failed to fetch labels:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLabels();
    }, []);

    const handleCreateLabel = async () => {
        if (!newLabelName.trim()) return;
        try {
            const res = await createLabel(newLabelName);
            if (res.success) {
                setLabels(prev => [res.label, ...prev]);
                setNewLabelName('');
                setIsCreating(false);
            }
        } catch (e) {
            console.error('Failed to create label:', e);
            alert('Failed to create label. It might already exist.');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm("Are you sure you want to delete this group? This will simply remove the group mapping and the contacts inside this group will NOT be deleted.")) return;

        try {
            const res = await deleteLabel(id);
            if (res.success) {
                setLabels(prev => prev.filter(l => l.id !== id));
            }
        } catch (e) {
            console.error('Failed to delete label:', e);
        }
    };

    const filteredLabels = labels.filter(label =>
        label.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="font-semibold text-xl text-slate-800">Contact Groups (Labels)</h1>
                    <p className="text-sm text-slate-500">{labels.length} groups total</p>
                </div>
                <div className="flex items-center space-x-3">
                    <Button
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setIsCreating(true)}
                        disabled={isCreating}
                    >
                        <Plus size={16} />
                        <span>Create Group</span>
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-4">

                    {isCreating && (
                        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 p-4 rounded-lg">
                            <input
                                type="text"
                                placeholder="Enter new group name..."
                                className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
                                value={newLabelName}
                                onChange={(e) => setNewLabelName(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateLabel() }}
                            />
                            <Button onClick={handleCreateLabel} variant="primary" className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
                            <Button onClick={() => { setIsCreating(false); setNewLabelName(''); }} variant="outline">Cancel</Button>
                        </div>
                    )}

                    <div className="flex items-center w-full max-w-md bg-white border border-slate-300 rounded-md px-3 py-2">
                        <Search className="w-5 h-5 text-slate-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search groups by name..."
                            className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
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
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                                Loading groups...
                                            </td>
                                        </tr>
                                    ) : filteredLabels.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                                No groups found. Create one to get started!
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredLabels.map((label) => (
                                            <tr key={label.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                                                            <Tag className="text-blue-500" size={18} />
                                                        </div>
                                                        <div className="font-semibold text-slate-900">
                                                            {label.name}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2 text-slate-600">
                                                        <Users size={16} className="text-slate-400" />
                                                        <span className="font-medium">{label.assigned_count}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    {new Date(label.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center space-x-2">
                                                        <Button variant="outline" size="sm" className="hidden lg:flex">
                                                            View Contacts
                                                        </Button>
                                                        <Button variant="outline" size="sm" className="hidden lg:flex">
                                                            Upload Contacts
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => handleDelete(label.id)}
                                                            title="Delete Group"
                                                        >
                                                            <Trash2 size={16} />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
