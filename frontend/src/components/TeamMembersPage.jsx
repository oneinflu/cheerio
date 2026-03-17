'use strict';
import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Shield, Mail, Search, ChevronLeft, ChevronRight, Filter, X, Edit2, Check, User, Trash2 } from 'lucide-react';
import { getTeamUsers, getLocalTeamUsers, updateTeamUser, createTeamUser, deleteTeamUser } from '../api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export default function TeamMembersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [teamSource, setTeamSource] = useState('starforze'); // 'starforze' | 'local'

  // Edit State
  const [editingUser, setEditingUser] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    course: '',
    language: ''
  });

  // Create State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    role: 'agent',
    course: '',
    language: ''
  });

  // Filter & Search States
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const fetcher = teamSource === 'starforze' ? getTeamUsers : getLocalTeamUsers;
        const res = await fetcher();
        // Handle response format: { success: true, data: { count: 57, data: [...] } }
        let data = [];
        if (res && res.data && Array.isArray(res.data.data)) {
            data = res.data.data;
        } else if (res && Array.isArray(res.data)) {
            data = res.data;
        } else if (Array.isArray(res)) {
            data = res;
        }
        setUsers(data);
      } catch (err) {
        console.error('Failed to load team users:', err);
        setError('Failed to load team members.');
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, [teamSource]);

  // Filter Logic
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = (
        (user.firstname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.lastname || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.role || '').toLowerCase().includes(searchTerm.toLowerCase())
      );

      const matchesRole = roleFilter === 'all' || (user.role || '') === roleFilter;
      
      const userStatus = user.isBlocked ? 'blocked' : (user.status || 'logout');
      const matchesStatus = statusFilter === 'all' || 
        (statusFilter === 'blocked' && user.isBlocked) ||
        (statusFilter === 'active' && userStatus === 'active') ||
        (statusFilter === 'logout' && userStatus === 'logout');

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const paginatedUsers = filteredUsers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, roleFilter, statusFilter]);

  const uniqueRoles = useMemo(() => {
    const roles = new Set(users.map(u => u.role).filter(Boolean));
    return Array.from(roles);
  }, [users]);

  const handleEditClick = (user) => {
    const attrs = user.attributes || {};
    setEditingUser(user);
    
    // Normalize to strings for editing
    let courseText = '';
    if (Array.isArray(attrs.courses)) courseText = attrs.courses.join(', ');
    else if (attrs.course) courseText = attrs.course;

    let langText = '';
    if (Array.isArray(attrs.languages)) langText = attrs.languages.join(', ');
    else if (attrs.language) langText = attrs.language;

    setEditFormData({
        course: courseText,
        language: langText
    });
    setIsEditModalOpen(true);
  };

  const handleSaveAttributes = async () => {
    if (!editingUser) return;
    try {
        const attributes = {
            courses: editFormData.course.split(',').map(s => s.trim()).filter(Boolean),
            languages: editFormData.language.split(',').map(s => s.trim()).filter(Boolean)
        };
        const res = await updateTeamUser(editingUser.id, { attributes });
        if (res.success) {
            // Update local state
            setUsers(users.map(u => u.id === editingUser.id ? { ...u, attributes } : u));
            setIsEditModalOpen(false);
            setEditingUser(null);
        } else {
            alert('Failed to update user attributes');
        }
    } catch (err) {
        console.error('Failed to update user:', err);
        alert('Error updating user');
    }
  };

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this local user? This action cannot be undone.')) return;
    try {
        const res = await deleteTeamUser(id);
        if (res.success) {
            setUsers(users.filter(u => u.id !== id));
        } else {
            alert(res.error || 'Failed to delete user');
        }
    } catch (err) {
        console.error('Delete failed:', err);
        alert('Error deleting user');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center h-full text-red-500">
        {error}
      </div>
    );
  }

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        firstname: createFormData.firstname,
        lastname: createFormData.lastname,
        email: createFormData.email,
        password: createFormData.password,
        role: createFormData.role,
        attributes: {
          courses: createFormData.courses ? createFormData.courses.split(',').map(s => s.trim()).filter(Boolean) : [],
          languages: createFormData.languages ? createFormData.languages.split(',').map(s => s.trim()).filter(Boolean) : []
        }
      };
      const res = await createTeamUser(payload);
      if (res.success) {
        setUsers([...users, res.user]);
        setIsCreateModalOpen(false);
        setCreateFormData({ firstname: '', lastname: '', email: '', password: '', role: 'agent', course: '', language: '' });
      } else {
        alert(res.error || 'Failed to create user');
      }
    } catch (err) {
      console.error(err);
      alert('Error creating user');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
             <h1 className="text-lg font-semibold text-slate-900">Team Members</h1>
             <p className="text-sm text-slate-500">Manage your team and permissions</p>
          </div>
          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
                 onClick={() => setTeamSource('starforze')}
                 className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${teamSource === 'starforze' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
             >
                 Starforze Users
             </button>
             <button 
                 onClick={() => setTeamSource('local')}
                 className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${teamSource === 'local' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
             >
                 Local Native Users
             </button>
          </div>
          {teamSource === 'local' && (
              <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm">
                 <User className="h-4 w-4 mr-2" /> Add Local Member
              </Button>
          )}
        </div>
      </div>

      <div className="p-8 space-y-6">
        {/* Filters & Search Toolbar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                    placeholder="Search by name, email, or role..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                />
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                <div className="relative">
                    <select
                        className="h-10 pl-3 pr-8 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950 capitalize"
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                    >
                        <option value="all">All Roles</option>
                        {uniqueRoles.map(role => (
                            <option key={role} value={role}>{role.replace(/_/g, ' ')}</option>
                        ))}
                    </select>
                </div>
                <div className="relative">
                    <select
                        className="h-10 pl-3 pr-8 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-950"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="all">All Status</option>
                        <option value="active">Available</option>
                        <option value="logout">Logged Out</option>
                        <option value="blocked">Blocked</option>
                    </select>
                </div>
                {(searchTerm || roleFilter !== 'all' || statusFilter !== 'all') && (
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => {
                            setSearchTerm('');
                            setRoleFilter('all');
                            setStatusFilter('all');
                        }}
                        title="Clear filters"
                    >
                        <X className="h-4 w-4 text-slate-500" />
                    </Button>
                )}
            </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-slate-500" />
                <span>{filteredUsers.length} Members</span>
              </div>
              <div className="text-sm font-normal text-slate-500">
                Page {currentPage} of {totalPages || 1}
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto min-h-[400px]">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-100 bg-slate-50/50">
                    <th className="py-3 px-4 font-medium rounded-tl-lg">User</th>
                    <th className="py-3 px-4 font-medium">Role</th>
                    <th className="py-3 px-4 font-medium">Skills</th>
                    <th className="py-3 px-4 font-medium">Status</th>
                    <th className="py-3 px-4 font-medium rounded-tr-lg">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedUsers.map((user) => {
                    const isBlocked = user.isBlocked;
                    const status = user.status;
                    let badgeVariant = "outline";
                    let badgeClass = "text-slate-500 border-slate-200";
                    let statusText = status || "Unknown";

                    if (isBlocked) {
                        badgeClass = "bg-red-50 text-red-700 border-red-200 hover:bg-red-100";
                        statusText = "Blocked";
                        badgeVariant = "secondary";
                    } else if (status === 'active') {
                        badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100";
                        statusText = "Available";
                        badgeVariant = "secondary";
                    } else if (status === 'logout') {
                        badgeClass = "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100";
                        statusText = "Logged Out";
                        badgeVariant = "secondary";
                    }

                    return (
                        <tr key={user._id || user.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600 border border-slate-200">
                                {(user.firstname?.[0] || user.name?.[0] || user.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div>
                                <div className="font-medium text-slate-900">
                                {user.firstname} {user.lastname} {(!user.firstname && !user.lastname) && (user.name || 'Unknown')}
                                </div>
                                <div className="text-slate-500 text-xs flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {user.email}
                                </div>
                                {user.mobile && (
                                    <div className="text-slate-400 text-xs mt-0.5 ml-4">
                                        {user.countryCode} {user.mobile}
                                    </div>
                                )}
                            </div>
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <div className="flex flex-col gap-1">
                                <span className="capitalize font-medium text-slate-700">
                                    {user.role?.replace(/_/g, ' ') || 'Member'}
                                </span>
                                {user.department && (
                                    <span className="text-xs text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded-full w-fit">
                                        {user.department}
                                    </span>
                                )}
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <div className="flex flex-col gap-1 items-start">
                                {user.attributes && (user.attributes.course || user.attributes.language || user.attributes.courses || user.attributes.languages) ? (
                                    <div className="flex flex-wrap gap-1">
                                        {/* Plural Courses */}
                                        {Array.isArray(user.attributes.courses) && user.attributes.courses.map(c => (
                                            <Badge key={c} variant="outline" className="text-[10px] py-0 h-5 border-blue-200 bg-blue-50 text-blue-700">
                                                {c}
                                            </Badge>
                                        ))}
                                        {/* Singular Course (Legacy) */}
                                        {!user.attributes.courses && user.attributes.course && (
                                            <Badge variant="outline" className="text-[10px] py-0 h-5 border-blue-200 bg-blue-50 text-blue-700">
                                                {user.attributes.course}
                                            </Badge>
                                        )}
                                        {/* Plural Languages */}
                                        {Array.isArray(user.attributes.languages) && user.attributes.languages.map(l => (
                                            <Badge key={l} variant="outline" className="text-[10px] py-0 h-5 border-purple-200 bg-purple-50 text-purple-700">
                                                {l}
                                            </Badge>
                                        ))}
                                        {/* Singular Language (Legacy) */}
                                        {!user.attributes.languages && user.attributes.language && (
                                            <Badge variant="outline" className="text-[10px] py-0 h-5 border-purple-200 bg-purple-50 text-purple-700">
                                                {user.attributes.language}
                                            </Badge>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs text-slate-400 italic">No skills set</span>
                                )}
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-6 px-2 text-[10px] text-slate-400 hover:text-blue-600 -ml-2"
                                    onClick={() => handleEditClick(user)}
                                >
                                    <Edit2 className="h-3 w-3 mr-1" /> Edit
                                </Button>
                                {teamSource === 'local' && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-6 px-2 text-[10px] text-slate-400 hover:text-red-600 -ml-2"
                                        onClick={() => handleDeleteUser(user.id)}
                                    >
                                        <Trash2 className="h-3 w-3 mr-1" /> Delete
                                    </Button>
                                )}
                            </div>
                        </td>
                        <td className="py-3 px-4">
                            <Badge variant={badgeVariant} className={`capitalize ${badgeClass}`}>
                                {statusText}
                            </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '-'}
                        </td>
                        </tr>
                    );
                  })}
                  {paginatedUsers.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-slate-500">
                        <div className="flex flex-col items-center justify-center gap-2">
                            <Filter className="h-8 w-8 text-slate-300" />
                            <p>No team members found matching your filters.</p>
                            <Button 
                                variant="link" 
                                onClick={() => {
                                    setSearchTerm('');
                                    setRoleFilter('all');
                                    setStatusFilter('all');
                                }}
                            >
                                Clear all filters
                            </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="gap-1"
                    >
                        <ChevronLeft className="h-4 w-4" /> Previous
                    </Button>
                    <div className="flex gap-1">
                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                            // Simple logic to show first 5 pages or sliding window could be better but sticking to simple for now
                            // Actually let's do a simple sliding window if needed, or just 1..N if small.
                            // Given N=57/10 = 6 pages, simple mapping is fine.
                            let pageNum = i + 1;
                            if (totalPages > 5 && currentPage > 3) {
                                pageNum = currentPage - 2 + i;
                                if (pageNum > totalPages) pageNum = i + (totalPages - 4); // clamp to end
                            }
                            
                            return (
                                <Button
                                    key={pageNum}
                                    variant={currentPage === pageNum ? "default" : "ghost"}
                                    size="sm"
                                    onClick={() => setCurrentPage(pageNum)}
                                    className="w-8 h-8 p-0"
                                >
                                    {pageNum}
                                </Button>
                            );
                        })}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="gap-1"
                    >
                        Next <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Agent Skills">
        <div className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600 mb-4">
                Assign skills to <strong>{editingUser?.name}</strong>. These attributes are used by automation rules for "Round Robin" assignment.
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Course</label>
                <Input 
                    placeholder="e.g. CPA, CMA, ACCA" 
                    value={editFormData.course}
                    onChange={(e) => setEditFormData({...editFormData, course: e.target.value})}
                />
            </div>
            
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Language</label>
                <Input 
                    placeholder="e.g. English, Spanish, Hindi" 
                    value={editFormData.language}
                    onChange={(e) => setEditFormData({...editFormData, language: e.target.value})}
                />
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button onClick={handleSaveAttributes}>
                    <Check className="h-4 w-4 mr-2" />
                    Save Changes
                </Button>
            </div>
        </div>
      </Modal>

      <Modal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} title="Create Local Member">
        <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-600 mb-4">
                This creates a native user account bypassing the external team sync. 
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">First Name <span className="text-red-500">*</span></label>
                    <Input 
                        placeholder="John" 
                        required
                        value={createFormData.firstname}
                        onChange={(e) => setCreateFormData({...createFormData, firstname: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Last Name</label>
                    <Input 
                        placeholder="Doe" 
                        value={createFormData.lastname}
                        onChange={(e) => setCreateFormData({...createFormData, lastname: e.target.value})}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email Address <span className="text-red-500">*</span></label>
                <Input 
                    type="email"
                    required
                    placeholder="john@example.com" 
                    value={createFormData.email}
                    onChange={(e) => setCreateFormData({...createFormData, email: e.target.value})}
                />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Password <span className="text-red-500">*</span></label>
                    <Input 
                        type="password"
                        required
                        placeholder="••••••••" 
                        value={createFormData.password}
                        onChange={(e) => setCreateFormData({...createFormData, password: e.target.value})}
                    />
                </div>
                <div className="space-y-2 flex flex-col justify-start mt-0.5">
                    <label className="text-sm font-medium text-slate-700 mb-1">Role <span className="text-red-500">*</span></label>
                    <select 
                        required
                        className="h-9 px-3 py-1 rounded-md border border-slate-200 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 capitalize"
                        value={createFormData.role}
                        onChange={(e) => setCreateFormData({...createFormData, role: e.target.value})}
                    >
                        <option value="agent">Agent</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="quality_manager">Quality Manager</option>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 mt-2">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 text-slate-500">Courses (Comma separated)</label>
                    <Input 
                        placeholder="e.g. CPA, CMA, ACCA" 
                        value={createFormData.courses}
                        onChange={(e) => setCreateFormData({...createFormData, courses: e.target.value})}
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 text-slate-500">Languages (Comma separated)</label>
                    <Input 
                        placeholder="e.g. English, Spanish" 
                        value={createFormData.languages}
                        onChange={(e) => setCreateFormData({...createFormData, languages: e.target.value})}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="ghost" onClick={() => setIsCreateModalOpen(false)}>Cancel</Button>
                <Button type="submit">
                    <Check className="h-4 w-4 mr-2" />
                    Create Member
                </Button>
            </div>
        </form>
      </Modal>
    </div>
  );
}
