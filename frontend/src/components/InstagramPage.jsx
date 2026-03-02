import React, { useMemo, useState } from 'react';
import Inbox from './Inbox';
import CustomerCard from './CustomerCard';
import NotesPanel from './NotesPanel';
import Chat from './Chat';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Instagram, CheckCircle, ExternalLink, Search, Bell, Users } from 'lucide-react';

export default function InstagramPage({ conversations = [], selectedId, onSelect, onPin, onResolve, onDelete, currentUser, onRefresh, socket }) {
  const instagramAuthUrl = "https://www.instagram.com/oauth/authorize?force_reauth=true&client_id=1115102437313127&redirect_uri=https://inbox.xolox.io/api/auth/instagram/callback&response_type=code&scope=instagram_business_basic%2Cinstagram_business_manage_messages%2Cinstagram_business_manage_comments%2Cinstagram_business_content_publish%2Cinstagram_business_manage_insights";
  
  // Check for connected query param
  const isConnected = new URLSearchParams(window.location.search).get('connected') === 'true';

  // Filter conversations for Instagram channel only
  const [filter, setFilter] = useState('all');
  
  const instaConversations = useMemo(() => {
     if (!conversations) return [];
     return conversations.filter(c => c.channelType === 'instagram').filter(c => {
         if (filter === 'open') return c.status === 'open' || c.status === 'unassigned';
         if (filter === 'closed') return c.status === 'closed';
         if (filter === 'unassigned') return !c.assigneeUserId;
         if (filter === 'pinned') return c.isPinned;
         return true;
     });
  }, [conversations, filter]);

  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const handleExternalReassign = () => { /* reuse logic or pass handler */ };

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* Sidebar / Inbox List */}
      <div className="w-80 flex-none border-r border-slate-200 bg-white flex flex-col">
          <div className="h-16 border-b border-slate-200 flex items-center px-4 justify-between bg-pink-50">
            <div className="flex items-center gap-2">
                <Instagram className="w-5 h-5 text-pink-600" />
                <h1 className="font-semibold text-lg text-slate-900">Instagram</h1>
            </div>
            <div className="flex space-x-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-pink-700 hover:bg-pink-100">
                <Search size={16} />
              </Button>
            </div>
          </div>
          
          {instaConversations.length === 0 && (
             <div className="p-4 text-center">
                <p className="text-sm text-slate-500 mb-4">No Instagram conversations yet.</p>
                <Button 
                  onClick={() => window.location.href = instagramAuthUrl}
                  className="bg-[#E1306C] hover:bg-[#C13584] text-white w-full"
                  size="sm"
                >
                  <ExternalLink className="w-3 h-3 mr-2" />
                  Connect Account
                </Button>
             </div>
          )}

          <Inbox 
            conversations={instaConversations} 
            selectedId={selectedId} 
            onSelect={onSelect} 
            onPin={onPin} 
            onResolve={onResolve} 
            onDelete={onDelete}
            currentUser={currentUser} 
            filter={filter} 
            setFilter={setFilter} 
          />
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white">
          {selectedId ? (
            <div className="flex h-full">
                <div className="flex-1 flex flex-col min-w-0">
                    <Chat 
                        conversationId={selectedId} 
                        currentUser={currentUser} 
                        socket={socket} 
                        onRefresh={onRefresh} 
                    />
                </div>
                
                {/* Right Sidebar for Details */}
                <aside className="w-80 flex-none border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
                    <div className="p-4 pb-0 flex-none space-y-3">
                        <Card className="shadow-sm border-slate-200">
                        <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-slate-500" />
                            <CardTitle className="text-sm font-semibold text-slate-900">Assignment</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="space-y-2">
                                <label className="block text-xs font-medium text-slate-500">Reassign to</label>
                                <div className="relative">
                                    <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isAssigneeOpen}
                                    className="w-full justify-between text-left font-normal px-3 py-2 h-auto"
                                    onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                                    >
                                    <span>Select Agent...</span>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                        </Card>
                    </div>
                    
                    <div className="p-4 pb-2 flex-none">
                        <CustomerCard conversationId={selectedId} />
                    </div>
                    <div className="flex-1 flex flex-col min-h-0 p-4 pt-2">
                        <NotesPanel conversationId={selectedId} currentUser={currentUser} socket={socket} />
                    </div>
                </aside>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-slate-50/50">
                <div className="w-16 h-16 bg-pink-100 rounded-full flex items-center justify-center mb-4">
                    <Instagram size={32} className="text-pink-500" />
                </div>
                <p>Select an Instagram conversation to start chatting</p>
            </div>
          )}
      </main>
    </div>
  );
}
