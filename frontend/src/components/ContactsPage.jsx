import React, { useState, useEffect } from 'react';
import { Download, Upload, Plus, Search, MoreHorizontal, User } from 'lucide-react';
import { Button } from './ui/Button';
import { getContacts, getTeamUsers, reassignConversation } from '../api';

export default function ContactsPage() {
    const [contacts, setContacts] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalContacts, setTotalContacts] = useState(0);
    const [teamMembers, setTeamMembers] = useState([]);
    const [isAssigning, setIsAssigning] = useState(null);

    // Get current team configuration
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const teamId = storedUser?.teamIds?.[0] || 'default_team';

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

    useEffect(() => {
        // Debounce search
        const handler = setTimeout(() => {
            setPage(1);
            fetchContacts(1, searchTerm);
        }, 300);

        return () => clearTimeout(handler);
    }, [searchTerm]);

    useEffect(() => {
        const fetchTeamData = async () => {
            try {
                const membersRes = await getTeamUsers();
                if (membersRes.success) {
                    setTeamMembers(membersRes.users);
                }
            } catch (e) {
                console.error('Failed to load team members:', e);
            }
        };
        fetchTeamData();
    }, []);

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            fetchContacts(newPage, searchTerm);
        }
    };

    const handleAssign = async (contactId, conversationId, assigneeId) => {
        if (!conversationId) {
            alert("This contact does not have an active conversation to assign.");
            return;
        }

        setIsAssigning(contactId);
        try {
            const res = await reassignConversation(conversationId, teamId, assigneeId);
            if (res.success) {
                // Instantly update UI optimistically
                const assignedUser = teamMembers.find(m => m.id === assigneeId);
                if (assignedUser) {
                    setContacts(prev => prev.map(c => c.id === contactId ? { ...c, assignee_name: assignedUser.name, assignee_id: assignedUser.id } : c));
                }
            }
        } catch (e) {
            console.error("Failed to assign:", e);
            alert("Failed to assign contact.");
        } finally {
            setIsAssigning(null);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">
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
                    <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus size={16} />
                        <span>Add Contact</span>
                    </Button>
                </div>
            </div>

            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-7xl mx-auto space-y-4">

                    <div className="flex items-center w-full max-w-md bg-white border border-slate-300 rounded-md px-3 py-2">
                        <Search className="w-5 h-5 text-slate-400 mr-2" />
                        <input
                            type="text"
                            placeholder="Search contacts by name or external ID..."
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
                                            <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                                Loading contacts...
                                            </td>
                                        </tr>
                                    ) : contacts.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-6 py-12 text-center text-slate-500">
                                                No contacts found.
                                            </td>
                                        </tr>
                                    ) : (
                                        contacts.map((contact) => (
                                            <tr key={contact.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                            <User className="text-slate-400" size={20} />
                                                        </div>
                                                        <div className="font-medium text-slate-900">
                                                            {contact.display_name || 'Unknown Contact'}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">
                                                    {contact.external_id}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 capitalize border border-blue-100">
                                                        {contact.channel_type || 'Unknown'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    {contact.assignee_name ? (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                                                            {contact.assignee_name}
                                                        </span>
                                                    ) : contact.conversation_id ? (
                                                        <select
                                                            disabled={isAssigning === contact.id}
                                                            onChange={(e) => handleAssign(contact.id, contact.conversation_id, e.target.value)}
                                                            className="text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200 rounded-lg p-1 outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
                                                        >
                                                            <option value="">{isAssigning === contact.id ? 'Assigning...' : 'Unassigned (Assign)'}</option>
                                                            {teamMembers.map((member) => (
                                                                <option key={member.id} value={member.id}>
                                                                    {member.name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200" title="No conversation exists to assign">
                                                            Unassigned
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-slate-500">
                                                    {new Date(contact.created_at).toLocaleDateString()}
                                                </td>
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
                                    Showing page <span className="font-medium text-slate-900">{page}</span> of <span className="font-medium text-slate-900">{totalPages}</span>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === 1}
                                        onClick={() => handlePageChange(page - 1)}
                                    >
                                        Previous
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page === totalPages}
                                        onClick={() => handlePageChange(page + 1)}
                                    >
                                        Next
                                    </Button>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
