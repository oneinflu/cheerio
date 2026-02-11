'use strict';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import { Plus, Search, Smartphone, Image as ImageIcon, CheckCircle, Clock, AlertCircle, ChevronRight, FileText, MoreVertical, RefreshCw, Send, Upload } from 'lucide-react';
import { cn } from '../lib/utils';
import { getTemplates, createTemplate, sendTestTemplate, uploadTemplateExampleMedia } from '../api';

export default function TemplatesPage() {
  const [selectedId, setSelectedId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Test Modal State
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testPhoneNumber, setTestPhoneNumber] = useState('');
  const [testSelectedTemplate, setTestSelectedTemplate] = useState('');
  const [sendingTest, setSendingTest] = useState(false);

  // Templates Data
  const [templates, setTemplates] = useState([]);

  // Variable Editor State
  const [newVarName, setNewVarName] = useState('');
  const [newVarExample, setNewVarExample] = useState('');

  const fetchTemplatesData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTemplates();
      if (res && res.data) {
        const mapped = res.data.map(t => {
          const bodyComp = t.components.find(c => c.type === 'BODY');
          const headerComp = t.components.find(c => c.type === 'HEADER');
          const footerComp = t.components.find(c => c.type === 'FOOTER');
          const buttonsComp = t.components.find(c => c.type === 'BUTTONS');

          return {
            id: t.id,
            name: t.name,
            language: t.language,
            status: t.status, // Meta returns APPROVED, PENDING, REJECTED (uppercase)
            category: t.category,
            headerType: headerComp ? headerComp.format : 'NONE',
            headerText: headerComp && headerComp.format === 'TEXT' ? headerComp.text : '',
            bodyText: bodyComp ? bodyComp.text : '',
            footerText: footerComp ? footerComp.text : '',
            buttons: buttonsComp ? buttonsComp.buttons : []
          };
        });
        setTemplates(mapped);
      } else if (res && res.error) {
        throw new Error(res.error);
      } else {
        // Handle empty or unexpected response
        setTemplates([]);
      }
    } catch (err) {
      console.error('Failed to fetch templates', err);
      setError('Failed to load templates. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchTemplatesData();
  }, []);

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
        variables: [],
        footerText: '',
        buttons: []
      });
    } else if (selectedId) {
      const t = templates.find(t => t.id === selectedId);
      if (t) setFormData({ ...t, variables: [] }); // Start with empty variables for edit
    }
  }, [selectedId, isCreating, templates]);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Create a local preview URL
    const previewUrl = URL.createObjectURL(file);
    
    setFormData(prev => ({
      ...prev,
      headerFile: file,
      headerFileName: file.name,
      headerPreviewUrl: previewUrl,
      headerHandle: null // Clear previous handle as we have a new file to upload on save
    }));
  };

  const handleSave = async () => {
    if (isCreating) {
      // Validation
      if (!formData.name) { alert('Please enter a template name'); return; }
      if (!formData.bodyText) { alert('Please enter body text'); return; }
      
      // Validate Buttons
      if (formData.buttons && formData.buttons.length > 0) {
        const hasQuickReply = formData.buttons.some(b => b.type === 'QUICK_REPLY');
        const hasCTA = formData.buttons.some(b => ['URL', 'PHONE_NUMBER'].includes(b.type));
        
        if (hasQuickReply && hasCTA) {
          alert('You cannot mix Quick Reply buttons with Call to Action buttons (URL/Phone). Please use only one type.');
          return;
        }
        
        if (hasCTA && formData.buttons.length > 2) {
           alert('You can only have up to 2 Call to Action buttons.');
           return;
        }
      }

      const components = [];
      
      try {
        setLoading(true);

        // Header
        if (formData.headerType !== 'NONE') {
          const header = { type: 'HEADER', format: formData.headerType };
          if (formData.headerType === 'TEXT') {
              header.text = formData.headerText;
          } else if (formData.headerType === 'IMAGE') {
              let handle = formData.headerHandle;
              
              // If we have a file to upload, do it now
              if (formData.headerFile) {
                  try {
                      const uploadRes = await uploadTemplateExampleMedia(formData.headerFile);
                      if (uploadRes.h) {
                          handle = uploadRes.h;
                      } else {
                          throw new Error('Image upload failed: No handle returned');
                      }
                  } catch (uploadErr) {
                      throw new Error(`Failed to upload image header: ${uploadErr.message}`);
                  }
              }

              if (!handle) {
                  alert('Please upload an example image for the header.');
                  setLoading(false);
                  return;
              }
              header.example = { header_handle: [handle] };
          }
          components.push(header);
        }
        
        // Body
        const bodyComponent = { type: 'BODY', text: formData.bodyText };
        if (formData.variables && formData.variables.length > 0) {
            bodyComponent.example = {
                body_text_named_params: formData.variables.map(v => ({
                    param_name: v.name,
                    example: v.example
                }))
            };
        }
        components.push(bodyComponent);
        
        // Footer
        if (formData.footerText) {
          components.push({ type: 'FOOTER', text: formData.footerText });
        }
        
        // Buttons
        if (formData.buttons && formData.buttons.length > 0) {
          components.push({ type: 'BUTTONS', buttons: formData.buttons });
        }

        const payload = {
          name: formData.name,
          category: formData.category,
          language: formData.language,
          components
        };
        
        if (formData.variables && formData.variables.length > 0) {
            payload.parameter_format = "named";
        }
        
        const res = await createTemplate(payload);
        if (res.error) {
            throw new Error(res.error.message || JSON.stringify(res.error));
        }
        setIsCreating(false);
        setSelectedId(null);
        alert('Template submitted for approval!');
        await fetchTemplatesData();
      } catch (err) {
        console.error('Error creating template:', err);
        alert(`Failed to create template: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    } else {
      // setTemplates(templates.map(t => t.id === formData.id ? formData : t));
      alert('Editing existing templates is not fully supported in this demo yet.');
    }
  };

  const filteredTemplates = templates.filter(t => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'ALL' || t.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const handleTestSend = async () => {
    if (!testPhoneNumber || !testSelectedTemplate) {
      alert('Please enter a phone number and select a template.');
      return;
    }
    
    setSendingTest(true);
    try {
      // Find language code for selected template
      const tmpl = templates.find(t => t.name === testSelectedTemplate);
      const lang = tmpl ? tmpl.language : 'en_US';
      
      await sendTestTemplate(testPhoneNumber, testSelectedTemplate, lang);
      alert('Test message sent successfully!');
      setIsTestModalOpen(false);
      setTestPhoneNumber('');
      setTestSelectedTemplate('');
    } catch (err) {
      console.error('Failed to send test message:', err);
      alert('Failed to send test message. Check console.');
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="flex-1 flex h-full bg-slate-50 relative">
      {/* Test Modal Overlay */}
      {isTestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[400px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-semibold text-slate-900">Send Test Message</h3>
              <button 
                onClick={() => setIsTestModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Template</label>
                <select 
                  className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                  value={testSelectedTemplate}
                  onChange={e => setTestSelectedTemplate(e.target.value)}
                >
                  <option value="">Select a template...</option>
                  {templates.filter(t => t.status === 'APPROVED').map(t => (
                    <option key={t.id} value={t.name}>
                      {t.name} ({t.language})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Phone Number</label>
                <Input 
                  placeholder="e.g. 919876543210" 
                  value={testPhoneNumber}
                  onChange={e => setTestPhoneNumber(e.target.value.replace(/[^0-9]/g, ''))}
                />
                <p className="text-xs text-slate-500">Enter number with country code, no + sign.</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsTestModalOpen(false)}>Cancel</Button>
                <Button onClick={handleTestSend} disabled={sendingTest}>
                  {sendingTest ? 'Sending...' : 'Send Test'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR: LIST */}
      <div className="w-80 border-r border-slate-200 bg-white flex flex-col z-0 flex-shrink-0">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Templates</h2>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => setIsTestModalOpen(true)} title="Send Test Message">
                <Send size={16} className="text-slate-500" />
              </Button>
              <Button size="icon" variant="ghost" onClick={fetchTemplatesData} title="Refresh Status">
                <RefreshCw size={16} className={cn("text-slate-500", loading && "animate-spin")} />
              </Button>
              <Button size="sm" onClick={() => { setIsCreating(true); setSelectedId(null); }}>
                <Plus size={16} className="mr-1" /> New
              </Button>
            </div>
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
          {error && (
            <div className="mt-2 p-2 bg-red-50 text-red-600 text-xs rounded border border-red-100">
              {error}
            </div>
          )}
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
                {t.status === 'APPROVED' && <CheckCircle size={14} className="text-green-500 flex-shrink-0" />}
                {t.status === 'PENDING' && <Clock size={14} className="text-amber-500 flex-shrink-0" />}
                {t.status === 'REJECTED' && <AlertCircle size={14} className="text-red-500 flex-shrink-0" />}
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
                      {formData.status === 'APPROVED' && <span className="text-green-600">• Live</span>}
                    </div>
                 </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { setIsCreating(false); setSelectedId(null); }}>Discard</Button>
                <Button onClick={handleSave} disabled={loading}>
                  {loading ? 'Submitting...' : (isCreating ? 'Submit for Approval' : 'Save Changes')}
                </Button>
              </div>
            </div>

            {/* Content Area (Split View) */}
            <div className="flex-1 overflow-hidden flex">
              
              {/* Form / Editor */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 border-r border-slate-200 min-w-[500px]">
                <div className="max-w-3xl space-y-6 mx-auto">
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
                           onChange={e => {
                             const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
                             setFormData({...formData, name: val});
                           }}
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
                             <div className="relative">
                               <input 
                                 type="file" 
                                 accept="image/*"
                                 className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                 onChange={handleImageUpload}
                               />
                               <div className={cn(
                                  "h-32 w-full max-w-md bg-slate-100 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-500 gap-2 transition-colors relative overflow-hidden",
                                  (formData.headerHandle || formData.headerPreviewUrl) ? "bg-blue-50 border-blue-300 text-blue-600" : "hover:bg-slate-50"
                                )}>
                                  {formData.headerPreviewUrl ? (
                                      <div className="relative w-full h-full flex items-center justify-center group">
                                          <img src={formData.headerPreviewUrl} alt="Preview" className="max-h-full max-w-full object-contain p-2" />
                                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                              <span className="text-white text-xs font-medium bg-black/50 px-2 py-1 rounded">Click to replace</span>
                                          </div>
                                      </div>
                                  ) : formData.headerHandle ? (
                                    <>
                                      <CheckCircle className="w-8 h-8 text-blue-500" />
                                      <span className="text-xs font-medium">{formData.headerFileName || 'Image Uploaded'}</span>
                                      <span className="text-[10px] text-blue-400">Click to replace</span>
                                    </>
                                  ) : (
                                    <>
                                      {loading ? <RefreshCw className="w-8 h-8 animate-spin opacity-50" /> : <Upload className="w-8 h-8 opacity-50" />}
                                      <span className="text-xs font-medium">{loading ? 'Uploading...' : 'Click to upload image example'}</span>
                                    </>
                                  )}
                                </div>
                             </div>
                          )}
                        </div>
                      </div>

                      {/* Body */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Body</label>
                          <span className="text-xs text-slate-500">Main message text. Use named variables like {'{{name}}'}.</span>
                        </div>
                        <div className="md:col-span-3 space-y-4">
                          <div className="relative">
                            <textarea 
                              className="w-full min-h-[120px] rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 resize-y font-mono"
                              value={formData.bodyText}
                              onChange={e => setFormData({...formData, bodyText: e.target.value})}
                              placeholder="Hello {{name}}, your order {{order_id}} is ready."
                            />
                          </div>

                          {/* Variable Manager */}
                          <div className="bg-slate-50 p-3 rounded-md border border-slate-200 space-y-3">
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 font-medium mb-1 block">Variable Name</label>
                                    <Input 
                                        placeholder="e.g. name" 
                                        value={newVarName}
                                        onChange={e => setNewVarName(e.target.value)}
                                        className="h-8 bg-white"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-xs text-slate-500 font-medium mb-1 block">Example Value</label>
                                    <Input 
                                        placeholder="e.g. John Doe" 
                                        value={newVarExample}
                                        onChange={e => setNewVarExample(e.target.value)}
                                        className="h-8 bg-white"
                                    />
                                </div>
                                <Button 
                                    size="sm"
                                    className="h-8"
                                    disabled={!newVarName || !newVarExample}
                                    onClick={() => {
                                        if (!newVarName || !newVarExample) return;
                                        const newVar = { name: newVarName, example: newVarExample };
                                        setFormData(prev => ({
                                            ...prev,
                                            variables: [...(prev.variables || []), newVar]
                                        }));
                                        setNewVarName('');
                                        setNewVarExample('');
                                    }}
                                >
                                    Add
                                </Button>
                            </div>

                            {formData.variables && formData.variables.length > 0 && (
                                <div className="space-y-2 pt-2 border-t border-slate-200">
                                    <label className="text-xs text-slate-500 font-medium">Defined Variables</label>
                                    <div className="flex flex-wrap gap-2">
                                        {formData.variables.map((v, idx) => (
                                            <div key={idx} className="flex items-center gap-1 bg-white border border-blue-200 rounded-md px-2 py-1 shadow-sm">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono text-blue-700 font-bold">{`{{${v.name}}}`}</span>
                                                    <span className="text-[10px] text-slate-500 truncate max-w-[80px]">{v.example}</span>
                                                </div>
                                                <div className="flex flex-col gap-0.5 ml-1 border-l border-slate-100 pl-1">
                                                    <button 
                                                        className="text-[10px] text-slate-400 hover:text-blue-600"
                                                        title="Insert into text"
                                                        onClick={() => setFormData(prev => ({
                                                            ...prev,
                                                            bodyText: prev.bodyText + ` {{${v.name}}}`
                                                        }))}
                                                    >
                                                        <Plus size={10} />
                                                    </button>
                                                    <button 
                                                        className="text-[10px] text-slate-400 hover:text-red-600"
                                                        title="Remove"
                                                        onClick={() => {
                                                            const newVars = formData.variables.filter((_, i) => i !== idx);
                                                            setFormData(prev => ({...prev, variables: newVars}));
                                                        }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Footer</label>
                          <span className="text-xs text-slate-500">Optional small text at bottom</span>
                        </div>
                        <div className="md:col-span-3">
                          <Input 
                            value={formData.footerText} 
                            onChange={e => setFormData({...formData, footerText: e.target.value})}
                            placeholder="e.g. Reply STOP to unsubscribe"
                          />
                        </div>
                      </div>

                      {/* Buttons */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="md:col-span-1">
                          <label className="text-sm font-medium text-slate-700 block mb-1">Buttons</label>
                          <span className="text-xs text-slate-500">Up to 3 buttons (Quick Reply) or 2 (Call to Action)</span>
                        </div>
                        <div className="md:col-span-3 space-y-4">
                          {formData.buttons.map((btn, idx) => (
                            <div key={idx} className="flex gap-2 items-start bg-white p-3 rounded-md border border-slate-200 shadow-sm">
                              <div className="flex-1 space-y-2">
                                <div className="flex gap-2">
                                  <select 
                                    className="h-9 rounded-md border border-slate-200 text-sm px-2 bg-slate-50"
                                    value={btn.type}
                                    onChange={e => {
                                      const newButtons = [...formData.buttons];
                                      newButtons[idx] = { ...newButtons[idx], type: e.target.value };
                                      // Reset fields based on type
                                      if (e.target.value === 'QUICK_REPLY') {
                                        delete newButtons[idx].url;
                                        delete newButtons[idx].phone_number;
                                      } else if (e.target.value === 'URL') {
                                        newButtons[idx].url = '';
                                        delete newButtons[idx].phone_number;
                                      } else if (e.target.value === 'PHONE_NUMBER') {
                                        newButtons[idx].phone_number = '';
                                        delete newButtons[idx].url;
                                      }
                                      setFormData({...formData, buttons: newButtons});
                                    }}
                                  >
                                    <option value="QUICK_REPLY">Quick Reply</option>
                                    <option value="URL">URL</option>
                                    <option value="PHONE_NUMBER">Phone Number</option>
                                  </select>
                                  <Input 
                                    className="h-9 flex-1"
                                    value={btn.text}
                                    onChange={e => {
                                      const newButtons = [...formData.buttons];
                                      newButtons[idx].text = e.target.value;
                                      setFormData({...formData, buttons: newButtons});
                                    }}
                                    placeholder="Button Text"
                                  />
                                </div>
                                
                                {btn.type === 'URL' && (
                                  <Input 
                                    className="h-9"
                                    value={btn.url || ''}
                                    onChange={e => {
                                      const newButtons = [...formData.buttons];
                                      newButtons[idx].url = e.target.value;
                                      setFormData({...formData, buttons: newButtons});
                                    }}
                                    placeholder="https://example.com"
                                  />
                                )}
                                
                                {btn.type === 'PHONE_NUMBER' && (
                                  <Input 
                                    className="h-9"
                                    value={btn.phone_number || ''}
                                    onChange={e => {
                                      const newButtons = [...formData.buttons];
                                      newButtons[idx].phone_number = e.target.value;
                                      setFormData({...formData, buttons: newButtons});
                                    }}
                                    placeholder="+15550000000"
                                  />
                                )}
                              </div>
                              <button 
                                onClick={() => {
                                  const newButtons = formData.buttons.filter((_, i) => i !== idx);
                                  setFormData({...formData, buttons: newButtons});
                                }}
                                className="text-slate-400 hover:text-red-500 p-1"
                              >
                                ✕
                              </button>
                            </div>
                          ))}
                          
                          {formData.buttons.length < 3 && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="border-dashed border-slate-300 text-slate-600 hover:border-slate-400 hover:bg-slate-50 w-full"
                              onClick={() => setFormData({
                                ...formData, 
                                buttons: [...formData.buttons, { type: 'QUICK_REPLY', text: '' }]
                              })}
                            >
                              <Plus size={16} className="mr-1" /> Add Button
                            </Button>
                          )}
                        </div>
                      </div>



                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Preview */}
              <div className="w-[450px] bg-slate-100 flex flex-col items-center justify-center p-8 relative overflow-hidden flex-shrink-0 border-l border-slate-200">
                <div className="absolute top-4 right-4 text-xs text-slate-400 font-mono">LIVE PREVIEW</div>
                
                <div className="w-[320px] bg-white rounded-[2rem] border-8 border-slate-800 shadow-2xl overflow-hidden relative h-[650px] flex flex-col transform transition-transform">
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
