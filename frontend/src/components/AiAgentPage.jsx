import React, { useState, useEffect } from 'react';
import { 
  Bot, Power, Plus, Trash2, FileText, Globe, Upload, Settings, 
  RefreshCw, CheckCircle, AlertCircle, File 
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useToast } from './ui/use-toast';
import { 
  getAiConfig, updateAiConfig, getAiKnowledge, 
  addAiTextKnowledge, deleteAiKnowledge, uploadAiDocument 
} from '../api';

export default function AiAgentPage() {
  const { toast } = useToast();
  const [config, setConfig] = useState({ is_active: false, system_prompt: '', model_name: 'gpt-4-turbo' });
  const [knowledge, setKnowledge] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingKnow, setLoadingKnow] = useState(false);
  
  // Modals
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [urlForm, setUrlForm] = useState({ title: '', url: '' });
  const [fileForm, setFileForm] = useState({ title: '', file: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [confRes, knowRes] = await Promise.all([
        getAiConfig(),
        getAiKnowledge()
      ]);
      if (confRes) setConfig(confRes);
      if (Array.isArray(knowRes)) setKnowledge(knowRes);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', description: 'Failed to load AI settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    const newState = !config.is_active;
    try {
      const res = await updateAiConfig({ is_active: newState });
      setConfig(res);
      toast({ 
        description: newState ? "AI Agent Activated" : "AI Agent Deactivated",
        className: newState ? "bg-green-50 border-green-200 text-green-800" : ""
      });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to update status' });
    }
  };

  const handleSaveConfig = async () => {
    try {
      const res = await updateAiConfig({ 
        system_prompt: config.system_prompt,
        model_name: config.model_name
      });
      setConfig(res);
      toast({ description: "Configuration saved" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to save config' });
    }
  };

  const handleAddUrl = async () => {
    if (!urlForm.title || !urlForm.url) return;
    setLoadingKnow(true);
    try {
      await addAiTextKnowledge({
        title: urlForm.title,
        source_url: urlForm.url,
        source_type: 'website',
        content: '' // Crawler would fetch this
      });
      setUrlForm({ title: '', url: '' });
      setShowAddUrl(false);
      loadData(); // Refresh list
      toast({ description: "Website added to knowledge base" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to add website' });
    } finally {
      setLoadingKnow(false);
    }
  };

  const handleUploadFile = async () => {
    if (!fileForm.file) return;
    setLoadingKnow(true);
    try {
      await uploadAiDocument(fileForm.file, fileForm.title);
      setFileForm({ title: '', file: null });
      setShowUpload(false);
      loadData();
      toast({ description: "Document uploaded successfully" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Upload failed' });
    } finally {
      setLoadingKnow(false);
    }
  };

  const handleDeleteSource = async (id) => {
    if (!confirm('Remove this knowledge source?')) return;
    try {
      await deleteAiKnowledge(id);
      setKnowledge(prev => prev.filter(k => k.id !== id));
      toast({ description: "Source removed" });
    } catch (e) {
      toast({ variant: 'destructive', description: 'Failed to delete source' });
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
      {/* Header */}
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-lg">
            <Bot className="text-purple-600" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900">AI Agent</h1>
            <p className="text-xs text-slate-500">Configure your automated assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-lg border border-slate-100">
            <span className={`w-2.5 h-2.5 rounded-full ${config.is_active ? 'bg-green-500 animate-pulse' : 'bg-slate-300'}`} />
            <span className="text-sm font-medium text-slate-700">
              {config.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <Button 
            variant={config.is_active ? "destructive" : "default"}
            onClick={handleToggleActive}
            className="w-32"
          >
            <Power size={16} className="mr-2" />
            {config.is_active ? 'Deactivate' : 'Activate'}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          
          {/* Configuration Card */}
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-slate-500" />
                <CardTitle className="text-base font-semibold text-slate-800">Agent Settings</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">System Prompt</label>
                <textarea
                  className="w-full min-h-[120px] rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400"
                  placeholder="Define the AI's persona and rules..."
                  value={config.system_prompt || ''}
                  onChange={e => setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Instructions for the AI on how to behave, what tone to use, and how to handle unknown answers.
                </p>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} variant="outline">Save Configuration</Button>
              </div>
            </CardContent>
          </Card>

          {/* Knowledge Base */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Globe size={20} className="text-blue-500" />
                Knowledge Base
              </h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAddUrl(!showAddUrl)}>
                  <Plus size={16} className="mr-2" /> Add Website
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowUpload(!showUpload)}>
                  <Upload size={16} className="mr-2" /> Upload Document
                </Button>
              </div>
            </div>

            {/* Add URL Form */}
            {showAddUrl && (
              <Card className="border-blue-200 bg-blue-50/30">
                <CardContent className="p-4 flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-slate-600">Title</label>
                    <Input 
                      placeholder="e.g. Course Catalog" 
                      value={urlForm.title}
                      onChange={e => setUrlForm(prev => ({ ...prev, title: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <label className="text-xs font-medium text-slate-600">URL</label>
                    <Input 
                      placeholder="https://example.com/courses" 
                      value={urlForm.url}
                      onChange={e => setUrlForm(prev => ({ ...prev, url: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                  <Button onClick={handleAddUrl} disabled={loadingKnow}>Add</Button>
                  <Button variant="ghost" onClick={() => setShowAddUrl(false)}>Cancel</Button>
                </CardContent>
              </Card>
            )}

            {/* Upload File Form */}
            {showUpload && (
              <Card className="border-purple-200 bg-purple-50/30">
                <CardContent className="p-4 flex gap-3 items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-slate-600">Title (Optional)</label>
                    <Input 
                      placeholder="Document Name" 
                      value={fileForm.title}
                      onChange={e => setFileForm(prev => ({ ...prev, title: e.target.value }))}
                      className="bg-white"
                    />
                  </div>
                  <div className="flex-[2] space-y-1">
                    <label className="text-xs font-medium text-slate-600">File (PDF, TXT)</label>
                    <input 
                      type="file" 
                      className="block w-full text-sm text-slate-500
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-white file:text-purple-700
                        hover:file:bg-purple-50 cursor-pointer"
                      onChange={e => setFileForm(prev => ({ ...prev, file: e.target.files[0] }))}
                      accept=".pdf,.txt,.md,.doc,.docx"
                    />
                  </div>
                  <Button onClick={handleUploadFile} disabled={loadingKnow}>Upload</Button>
                  <Button variant="ghost" onClick={() => setShowUpload(false)}>Cancel</Button>
                </CardContent>
              </Card>
            )}

            {/* Knowledge List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {knowledge.map((item) => (
                <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex items-start justify-between mb-2">
                    <div className={`p-2 rounded-lg ${
                      item.source_type === 'website' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'
                    }`}>
                      {item.source_type === 'website' ? <Globe size={18} /> : <FileText size={18} />}
                    </div>
                    <button 
                      onClick={() => handleDeleteSource(item.id)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="font-semibold text-slate-800 truncate mb-1">{item.title}</h3>
                  <p className="text-xs text-slate-500 truncate mb-3">
                    {item.source_url || 'Uploaded content'}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                      <CheckCircle size={10} /> Active
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(item.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
              
              {knowledge.length === 0 && !loading && (
                <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <File size={24} className="text-slate-400" />
                  </div>
                  <h3 className="text-sm font-medium text-slate-900">No knowledge sources yet</h3>
                  <p className="text-xs text-slate-500 mt-1">Add websites or documents to train your AI.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
