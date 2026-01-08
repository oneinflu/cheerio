'use strict';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Plus, Search, Smartphone, Image as ImageIcon, CheckCircle, Clock, AlertCircle, ChevronRight, FileText, MoreVertical } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TemplatesPage() {
  const [selectedId, setSelectedId] = useState('t1');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');

  // Mock Data
  const [templates, setTemplates] = useState([
    {
      id: 't1',
      name: 'proposal_invoice',
      language: 'en_US',
      status: 'approved',
      category: 'MARKETING',
      headerType: 'NONE',
      headerText: '',
      bodyText: 'Here is your proposal for {{1}} package {{2}}. Total: {{3}}',
      footerText: '',
      buttons: [{ type: 'URL', text: 'Pay Now' }]
    },
    {
      id: 't2',
      name: 'welcome_message',
      language: 'en_US',
      status: 'pending',
      category: 'UTILITY',
      headerType: 'IMAGE',
      headerText: '',
      bodyText: 'Welcome to our service, {{1}}! We are glad to have you.',
      footerText: 'Reply STOP to unsubscribe',
      buttons: []
    }
  ]);

  // Editor State
  const [formData, setFormData] = useState(null);

  // Initialize editor when selection changes
  React.useEffect(() => {
    if (isCreating) {
      setFormData({
        id: 'new',
        name: '',
        language: 'en_US',
        status: 'draft',
        category: 'MARKETING',
        headerType: 'NONE',
        headerText: '',
        bodyText: 'Hello {{1}}, ...',
        footerText: '',
        buttons: []
      });
    } else if (selectedId) {
      const t = templates.find(t => t.id === selectedId);
      if (t) setFormData({ ...t });
    }
  }, [selectedId, isCreating, templates]);

  const handleSave = () => {
    if (isCreating) {
      const newId = `t${Date.now()}`;
      setTemplates([...templates, { ...formData, id: newId, status: 'pending' }]);
      setIsCreating(false);
      setSelectedId(newId);
    } else {
      setTemplates(templates.map(t => t.id === formData.id ? formData : t));
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex h-full w-full bg-slate-50">
      {/* LEFT SIDEBAR: LIST */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Templates</h2>
            <Button size="sm" onClick={() => { setIsCreating(true); setSelectedId(null); }}>
              <Plus size={16} className="mr-1" /> New
            </Button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
            <Input 
              placeholder="Search templates..." 
              className="pl-9 bg-slate-50 border-slate-200"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          
          {/* Filter Chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {['ALL', 'AUTHENTICATION', 'UTILITY', 'MARKETING'].map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-medium transition-colors whitespace-nowrap border",
                  filterCategory === cat 
                    ? "bg-slate-900 text-white border-slate-900" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                )}
              >
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {filteredTemplates.map(t => (
            <div 
              key={t.id}
              onClick={() => { setSelectedId(t.id); setIsCreating(false); }}
              className={cn(
                "p-4 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors group relative",
                selectedId === t.id && !isCreating ? "bg-blue-50/50 border-l-4 border-l-blue-600" : "border-l-4 border-l-transparent"
              )}
            >
              <div className="flex justify-between items-start mb-1">
                <span className="font-medium text-sm text-slate-900 truncate pr-2">{t.name}</span>
                {t.status === 'approved' && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                {t.status === 'pending' && <Clock size={14} className="text-amber-500 flex-shrink-0" />}
                {t.status === 'rejected' && <AlertCircle size={14} className="text-red-500 flex-shrink-0" />}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                <Badge variant="outline" className="text-[10px] h-5 px-1">{t.category}</Badge>
                <span>{t.language}</span>
              </div>
              <p className="text-xs text-slate-400 line-clamp-2">
                {t.bodyText}
              </p>
            </div>
          ))}
          {filteredTemplates.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-sm">
              No templates found
            </div>
          )}
        </div>
      </div>

      {/* RIGHT MAIN AREA: EDITOR */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {!formData ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            Select a template or create a new one
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="h-16 border-b border-slate-200 bg-white px-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                 <div>
                   <h1 className="font-semibold text-lg text-slate-900">
                     {isCreating ? 'New Template' : formData.name}
                   </h1>
                   <div className="flex items-center gap-2 text-xs text-slate-500">
                     <span>{isCreating ? 'Draft' : formData.status}</span>
                     {formData.status === 'approved' && <span className="text-green-600">• Live</span>}
                   </div>
                 </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { /* cancel logic */ }}>Discard</Button>
                <Button onClick={handleSave}>
                  {isCreating ? 'Submit for Approval' : 'Save Changes'}
                </Button>
              </div>
            </div>

            {/* Content Area (Split View) */}
            <div className="flex-1 overflow-hidden flex">
              
              {/* Form / Editor */}
              <div className="w-[900px] overflow-y-auto p-6 bg-slate-50/50 border-r border-slate-200 flex-shrink-0">
                <div className="max-w-full space-y-6">
                  {/* Metadata */}
                  <Card className="border-slate-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-white">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <div className="w-1 h-4 bg-blue-600 rounded-full" />
                        Configuration
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
                       <div className="space-y-2">
                         <label className="text-sm font-medium text-slate-700">Template Name</label>
                         <Input 
                           value={formData.name} 
                           onChange={e => setFormData({...formData, name: e.target.value})}
                           placeholder="e.g. shipping_update"
                           className="bg-white"
                         />
                         <p className="text-[11px] text-slate-500">Lowercase, underscores only.</p>
                       </div>
                       <div className="space-y-2">
                         <label className="text-sm font-medium text-slate-700">Category</label>
                         <select 
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all"
                            value={formData.category}
                            onChange={e => setFormData({...formData, category: e.target.value})}
                         >
                           <option value="MARKETING">Marketing</option>
                           <option value="UTILITY">Utility</option>
                           <option value="AUTHENTICATION">Authentication</option>
                         </select>
                       </div>
                       <div className="space-y-2">
                         <label className="text-sm font-medium text-slate-700">Language</label>
                         <select 
                            className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 transition-all"
                            value={formData.language}
                            onChange={e => setFormData({...formData, language: e.target.value})}
                         >
                           <option value="en_US">English (US)</option>
                           <option value="es_ES">Spanish</option>
                         </select>
                       </div>
                    </CardContent>
                  </Card>

                  {/* Message Content */}
                  <Card className="border-slate-200 shadow-sm h-full">
                    <CardHeader className="pb-3 border-b border-slate-100 bg-white">
                      <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        <div className="w-1 h-4 bg-purple-600 rounded-full" />
                        Message Content
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-8">
                      
                      {/* Header */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Header</label>
                          <span className="text-xs text-slate-500">Optional media or text header</span>
                        </div>
                        <div className="md:col-span-3 space-y-4">
                          <div className="flex gap-2">
                            {['NONE', 'TEXT', 'IMAGE'].map(type => (
                              <button
                                key={type}
                                onClick={() => setFormData({...formData, headerType: type})}
                                className={cn(
                                  "px-4 py-2 rounded-md text-sm font-medium border transition-all shadow-sm",
                                  formData.headerType === type 
                                    ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900 ring-offset-2" 
                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50 hover:border-slate-300"
                                )}
                              >
                                {type.charAt(0) + type.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </div>
                          {formData.headerType === 'TEXT' && (
                            <Input 
                              value={formData.headerText} 
                              onChange={e => setFormData({...formData, headerText: e.target.value})}
                              placeholder="Enter header text..."
                              className="max-w-md"
                            />
                          )}
                          {formData.headerType === 'IMAGE' && (
                             <div className="h-32 w-full max-w-md bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 gap-2 hover:bg-slate-50 transition-colors cursor-pointer">
                               <ImageIcon className="w-8 h-8 opacity-50" />
                               <span className="text-xs font-medium">Click to upload image</span>
                             </div>
                          )}
                        </div>
                      </div>

                      <div className="h-px bg-slate-100" />

                      {/* Body */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Body Text</label>
                          <span className="text-xs text-slate-500">Main message content. Use {'{{1}}'} for variables.</span>
                        </div>
                        <div className="md:col-span-3">
                          <textarea
                            className="flex min-h-[160px] w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 shadow-sm resize-y"
                            value={formData.bodyText}
                            onChange={e => setFormData({...formData, bodyText: e.target.value})}
                            placeholder="Hello {{1}}, we have an update regarding your order {{2}}..."
                          />
                        </div>
                      </div>

                      <div className="h-px bg-slate-100" />

                      {/* Footer */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Footer</label>
                          <span className="text-xs text-slate-500">Small text at the bottom</span>
                        </div>
                        <div className="md:col-span-3">
                          <Input 
                            value={formData.footerText} 
                            onChange={e => setFormData({...formData, footerText: e.target.value})}
                            placeholder="e.g. Reply STOP to unsubscribe"
                            className="max-w-md"
                          />
                        </div>
                      </div>

                      <div className="h-px bg-slate-100" />

                      {/* Buttons */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                         <div className="md:col-span-1">
                           <label className="text-sm font-medium text-slate-700 block mb-1">Buttons</label>
                           <span className="text-xs text-slate-500">Interactive elements</span>
                         </div>
                         <div className="md:col-span-3 space-y-3">
                           {formData.buttons.map((btn, idx) => (
                             <div key={idx} className="flex gap-2 max-w-md">
                               <Input value={btn.text} readOnly className="flex-1 bg-slate-50" />
                               <Button size="icon" variant="ghost" className="hover:bg-red-50 hover:text-red-600" onClick={() => {
                                 const newBtns = [...formData.buttons];
                                 newBtns.splice(idx, 1);
                                 setFormData({...formData, buttons: newBtns});
                               }}>
                                 <AlertCircle size={16} />
                               </Button>
                             </div>
                           ))}
                           <div className="flex gap-2">
                             <Button 
                               variant="outline" 
                               size="sm" 
                               className="border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                               onClick={() => setFormData({
                                 ...formData, 
                                 buttons: [...formData.buttons, { type: 'QUICK_REPLY', text: 'New Button' }]
                               })}
                             >
                               <Plus size={16} className="mr-1" /> Add Button
                             </Button>
                           </div>
                         </div>
                      </div>

                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Preview */}
              <div className="flex-1 bg-slate-100 flex flex-col items-center justify-center p-8 relative overflow-hidden">
                <div className="absolute top-4 right-4 text-xs text-slate-400 font-mono">LIVE PREVIEW</div>
                
                <div className="w-[350px] bg-white rounded-[2rem] border-8 border-slate-800 shadow-2xl overflow-hidden relative h-[700px] flex flex-col transform scale-90 sm:scale-100 transition-transform">
                  {/* Status Bar */}
                  <div className="h-6 bg-slate-800 w-full flex items-center justify-center">
                    <div className="w-20 h-4 bg-black rounded-b-xl" />
                  </div>
                  
                  {/* Header Bar */}
                  <div className="h-14 bg-[#075E54] flex items-center px-4 gap-3 shadow-md z-10">
                    <div className="w-8 h-8 rounded-full bg-white/20" />
                    <div className="flex-1">
                      <div className="h-2 w-20 bg-white/20 rounded mb-1" />
                      <div className="h-1.5 w-12 bg-white/10 rounded" />
                    </div>
                  </div>

                  {/* Chat Area */}
                  <div className="flex-1 bg-[#E5DDD5] p-4 overflow-y-auto bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-repeat">
                     
                     <div className="bg-white rounded-lg shadow-sm max-w-[90%] mb-2 overflow-hidden relative">
                        {/* Header */}
                        {formData.headerType === 'IMAGE' && (
                          <div className="h-36 bg-slate-200 flex items-center justify-center">
                            <ImageIcon className="text-slate-400 w-8 h-8" />
                          </div>
                        )}
                        {formData.headerType === 'TEXT' && formData.headerText && (
                          <div className="px-3 pt-3 font-bold text-slate-900 text-sm">{formData.headerText}</div>
                        )}

                        {/* Body */}
                        <div className="px-3 py-2 text-sm text-slate-900 whitespace-pre-wrap leading-relaxed">
                          {formData.bodyText}
                        </div>

                        {/* Footer */}
                        {formData.footerText && (
                          <div className="px-3 pb-2 text-[10px] text-slate-500">
                            {formData.footerText}
                          </div>
                        )}
                        
                        {/* Timestamp */}
                        <div className="px-2 pb-1 text-[10px] text-slate-400 text-right flex justify-end gap-1">
                          12:00 PM <span className="text-blue-500">✓✓</span>
                        </div>
                     </div>

                     {/* Buttons */}
                     {formData.buttons.length > 0 && (
                       <div className="max-w-[90%] space-y-1">
                         {formData.buttons.map((btn, i) => (
                           <div key={i} className="bg-white rounded-lg shadow-sm py-2.5 text-center text-blue-500 font-medium text-sm cursor-pointer hover:bg-slate-50">
                             {btn.text}
                           </div>
                         ))}
                       </div>
                     )}

                  </div>
                </div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
