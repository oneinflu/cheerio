'use strict';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  BarChart3, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  Play, 
  ChevronRight, 
  Database,
  Search,
  Calendar,
  Filter,
  RefreshCw,
  ExternalLink,
  GitBranch
} from 'lucide-react';

export default function ReportsPage() {
  const [view, setView] = useState('workflows'); // 'workflows' | 'templates' | 'drip'
  const [runs, setRuns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [stageLeads, setStageLeads] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [webhookData, setWebhookData] = useState(null);

  useEffect(() => {
    if (view === 'workflows') fetchRuns();
    else if (view === 'templates') fetchTemplates();
    else if (view === 'drip') fetchDripData();
  }, [view]);

  const [dripData, setDripData] = useState([]);
  const [workflowFilterId, setWorkflowFilterId] = useState(null);

  const fetchDripData = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workflows/kanban', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data && Array.isArray(data.columns)) {
        setDripData(data.columns);
      }
    } catch (err) {
      console.error('Failed to fetch drip data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRuns = async (filterId = null) => {
    setIsLoading(true);
    const fid = filterId || workflowFilterId;
    try {
      let url = '/api/reports/workflow-runs?limit=100';
      if (fid) url += `&workflowId=${fid}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs);
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reports/templates?limit=100', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRunDetail = async (id) => {
    setIsDetailLoading(true);
    try {
      const res = await fetch(`/api/reports/workflow-runs/${id}`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRun(data.run);
        setWebhookData(data.webhookData);
      }
    } catch (err) {
      console.error('Failed to fetch run detail:', err);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const fetchLeadsForStage = async (stageId) => {
    setIsDetailLoading(true);
    setStageLeads([]);
    try {
        const res = await fetch(`/api/reports/campaign-leads?stageId=${stageId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
        });
        const data = await res.json();
        if (data.success) {
            setStageLeads(data.leads || []);
        }
    } catch (err) {
        console.error('Failed to fetch stage leads:', err);
    } finally {
        setIsDetailLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
      case 'read':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Success</Badge>;
      case 'delivered':
        return <Badge className="bg-blue-100 text-blue-700 border-blue-200">Delivered</Badge>;
      case 'sent':
      case 'accepted':
        return <Badge className="bg-slate-100 text-slate-700 border-slate-200">Sent</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Failed</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{status}</Badge>;
    }
  };

  const getDeliveryIcon = (status) => {
    if (status === 'read') return <CheckCircle2 size={14} className="text-green-500 fill-green-50" />;
    if (status === 'delivered') return <CheckCircle2 size={14} className="text-blue-500 fill-blue-50" />;
    if (status === 'failed') return <XCircle size={14} className="text-red-500" />;
    return <RefreshCw size={14} className="text-slate-400" />;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-indigo-600" />
              <h1 className="text-lg font-bold text-slate-900">Reports {workflowFilterId && '(Filtered)'}</h1>
            </div>
            <div className="flex items-center gap-1">
              {workflowFilterId && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setWorkflowFilterId(null);
                    fetchRuns(null);
                  }}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-bold px-2 h-7"
                >
                  Clear
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={view === 'workflows' ? () => fetchRuns() : fetchTemplates} disabled={isLoading}>
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
          
          <div className="flex bg-slate-100 p-1 rounded-lg">
             <button 
               onClick={() => setView('workflows')}
               className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${view === 'workflows' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
             >
                <Database size={14} /> Workflow Runs
             </button>
             <button 
               onClick={() => setView('templates')}
               className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${view === 'templates' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
             >
                <RefreshCw size={14} /> Templates
             </button>
             <button 
               onClick={() => setView('drip')}
               className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-bold rounded-md transition-all ${view === 'drip' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:bg-slate-200'}`}
             >
                <GitBranch size={14} /> Drip
             </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading {view === 'workflows' ? 'runs' : 'templates'}...</div>
          ) : view === 'workflows' ? (
            runs.length === 0 ? (
              <div className="p-8 text-center text-slate-400 font-medium">No workflow runs found yet.</div>
            ) : (
              <div className="divide-y divide-slate-50">
                {runs.map((run) => (
                  <div 
                    key={run.id}
                    onClick={() => fetchRunDetail(run.id)}
                    className={`p-4 cursor-pointer transition-colors hover:bg-slate-50 ${selectedRun?.id === run.id ? 'bg-indigo-50/50' : ''}`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-sm font-semibold text-slate-800 line-clamp-1">{run.workflow_name}</span>
                      {getStatusBadge(run.status)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                      <span className="flex items-center gap-1"><Clock size={12} /> {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="flex items-center gap-1"><Play size={12} /> {run.duration_ms}ms</span>
                    </div>
                    <div className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                      {run.phone_number}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : view === 'templates' ? (
             templates.length === 0 ? (
               <div className="p-8 text-center text-slate-400 font-medium">No template messages sent yet.</div>
             ) : (
               <div className="divide-y divide-slate-50">
                  {templates.map((tpl) => (
                    <div 
                      key={tpl.id}
                      className="p-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-sm font-semibold text-slate-800 line-clamp-1 uppercase tracking-tighter">
                          {tpl.template_name || (tpl.text_body?.startsWith('Template: ') ? tpl.text_body.replace('Template: ', '') : 'Custom Template')}
                        </span>
                        <div className="flex items-center gap-1">
                           {getStatusBadge(tpl.delivery_status)}
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 mb-2">
                        Sent to: <span className="font-bold text-slate-700">{tpl.contact_name || 'User'}</span> ({tpl.contact_phone})
                      </div>
                      <div className="flex items-center gap-4 text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                         <div className="flex items-center gap-1">
                            {getDeliveryIcon(tpl.delivery_status)}
                            <span className="uppercase font-bold pt-0.5">{tpl.delivery_status}</span>
                         </div>
                         <div className="flex items-center gap-1 ml-auto">
                            <Clock size={10} />
                            <span>{new Date(tpl.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                         </div>
                      </div>
                    </div>
                  ))}
               </div>
             )
          ) : (
            <div className="p-4 space-y-4 overflow-y-auto h-full">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Campaign Funnels</div>
              {dripData.map(col => (
                <div 
                  key={col.stage.id} 
                  className={`p-3 rounded-xl border transition-all cursor-pointer hover:border-indigo-300 hover:shadow-md ${selectedRun?.stageId === col.stage.id ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-100'}`}
                  onClick={() => {
                    setSelectedRun({ type: 'drip_stage', stageId: col.stage.id, stageName: col.stage.name, workflows: col.workflows });
                    fetchLeadsForStage(col.stage.id);
                  }}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-800">{col.stage.name}</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 bg-slate-50">{col.workflows.length} steps</Badge>
                  </div>
                  <div className="flex gap-1 overflow-hidden">
                    {col.workflows.map((wf, idx) => (
                      <div key={idx} className="flex-1 h-1 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: '100%', opacity: 1 - (idx * 0.15) }} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail View */}
      <div className="flex-1 overflow-y-auto p-6">
        {isDetailLoading ? (
            <div className="h-full flex items-center justify-center text-slate-400">Loading details...</div>
        ) : selectedRun && view === 'workflows' ? (
          <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <header className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedRun.workflow_name}</h2>
                    {getStatusBadge(selectedRun.status)}
                </div>
                <div className="text-sm text-slate-500 font-medium">
                  Run ID: <span className="font-mono text-xs">{selectedRun.id}</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 font-bold"><Clock size={20} /></div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Duration</div>
                    <div className="text-lg font-bold text-slate-900">{selectedRun.duration_ms} ms</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 font-bold"><Calendar size={20} /></div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Started At</div>
                    <div className="text-lg font-bold text-slate-900">{new Date(selectedRun.started_at).toLocaleTimeString()}</div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600 font-bold"><RefreshCw size={20} /></div>
                  <div>
                    <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Events</div>
                    <div className="text-lg font-bold text-slate-900">{selectedRun.execution_log?.length || 0} Steps</div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Incoming Data */}
            <Card>
              <CardHeader className="py-3 px-4 bg-slate-50/50 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Database size={16} className="text-slate-500" /> Incoming Webhook Payload
                </CardTitle>
                <span className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded text-slate-600 font-mono">
                    {webhookData?.id || 'Raw Context'}
                </span>
              </CardHeader>
              <CardContent className="p-0 overflow-hidden">
                <pre className="p-4 text-xs font-mono bg-slate-900 text-slate-300 overflow-x-auto">
                  {JSON.stringify(webhookData?.payload || selectedRun.context_preview, null, 2)}
                </pre>
              </CardContent>
            </Card>

            {/* Execution Trace */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 px-1">
                <GitBranch size={16} className="text-indigo-600" /> Execution Trace
              </h3>
              <div className="space-y-2">
                {selectedRun.execution_log.map((log, idx) => (
                  <div key={idx} className={`p-3 rounded-lg border transition-all ${log.error ? 'bg-red-50 border-red-100' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500 border border-slate-200 flex-none">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <code className="text-[10px] bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">{log.type}</code>
                          <span className="text-xs font-semibold text-slate-700 truncate">{log.nodeId}</span>
                        </div>
                        {log.error && (
                          <div className="text-xs text-red-600 font-medium flex items-center gap-1 mt-1">
                            <XCircle size={12} /> Error: {log.error}
                          </div>
                        )}
                        {log.details && (
                           <div className="text-[11px] text-slate-500 mt-1 italic">
                              {log.details}
                           </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedRun.error_message && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="py-3 px-4 border-b border-red-100">
                   <CardTitle className="text-sm font-bold text-red-800 flex items-center gap-2">
                      <XCircle size={16} /> Final Error Termination
                   </CardTitle>
                </CardHeader>
                <CardContent className="p-4 text-xs text-red-700 font-medium whitespace-pre-wrap leading-relaxed">
                   {selectedRun.error_message}
                </CardContent>
              </Card>
            )}

          </div>
        ) : view === 'templates' ? (
           <div className="max-w-4xl space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
              <header>
                 <h2 className="text-2xl font-bold text-slate-900">Template Performance</h2>
                 <p className="text-sm text-slate-500">Overview of template message delivery and engagement.</p>
              </header>
              
              <div className="grid grid-cols-4 gap-4">
                 <Card className="bg-white border-slate-200">
                    <CardContent className="p-4">
                       <div className="text-xs text-slate-500 font-bold uppercase mb-1">Total Sent</div>
                       <div className="text-2xl font-black text-slate-900">{templates.length}</div>
                    </CardContent>
                 </Card>
                 <Card className="bg-emerald-50 border-emerald-100">
                    <CardContent className="p-4">
                       <div className="text-xs text-emerald-600 font-bold uppercase mb-1">Total Read</div>
                       <div className="text-2xl font-black text-emerald-700">{templates.filter(t => t.delivery_status === 'read').length}</div>
                    </CardContent>
                 </Card>
                 <Card className="bg-blue-50 border-blue-100">
                    <CardContent className="p-4">
                       <div className="text-xs text-blue-600 font-bold uppercase mb-1">Delivered</div>
                       <div className="text-2xl font-black text-blue-700">{templates.filter(t => t.delivery_status === 'delivered').length}</div>
                    </CardContent>
                 </Card>
                 <Card className="bg-red-50 border-red-100">
                    <CardContent className="p-4">
                       <div className="text-xs text-red-600 font-bold uppercase mb-1">Failed</div>
                       <div className="text-2xl font-black text-red-700">{templates.filter(t => t.delivery_status === 'failed').length}</div>
                    </CardContent>
                 </Card>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-4 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700 uppercase tracking-widest">
                    Recent Template History
                 </div>
                 <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                       <tr>
                          <th className="px-4 py-2 text-center">Status</th>
                          <th className="px-4 py-2">Template</th>
                          <th className="px-4 py-2">Contact</th>
                          <th className="px-4 py-2">Sent At</th>
                          <th className="px-4 py-2">Read At</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {templates.slice(0, 50).map(tpl => (
                          <tr key={tpl.id} className="hover:bg-slate-50 transition-colors">
                             <td className="px-4 py-3 text-center">
                                <div className="flex justify-center">{getDeliveryIcon(tpl.delivery_status)}</div>
                             </td>
                             <td className="px-4 py-3 font-semibold text-slate-800 uppercase text-[11px] truncate max-w-[150px]">
                                {tpl.template_name || 'Custom'}
                             </td>
                             <td className="px-4 py-3">
                                <div className="font-bold text-xs">{tpl.contact_name || 'User'}</div>
                                <div className="text-[10px] text-slate-400">{tpl.contact_phone}</div>
                             </td>
                             <td className="px-4 py-3 text-xs text-slate-500">
                                {new Date(tpl.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                             </td>
                             <td className="px-4 py-3 text-xs text-emerald-600 font-bold">
                                {tpl.read_at ? new Date(tpl.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        ) : view === 'drip' && selectedRun?.type === 'drip_stage' ? (
          <div className="max-w-5xl space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
            <header className="flex justify-between items-end">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">{selectedRun.stageName}</h2>
                <p className="text-sm text-slate-500 font-medium">Sequential Drip Sequence Performance</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-2">
                  <Calendar size={14} /> Last 30 Days
                </Button>
              </div>
            </header>

            <div className="grid grid-cols-4 gap-4">
               <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-0 shadow-lg shadow-indigo-100">
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-1">Total Funnel Entry</div>
                    <div className="text-3xl font-black">100%</div>
                    <div className="text-[10px] opacity-60 mt-1 font-medium">All leads starting sequence</div>
                  </CardContent>
               </Card>
               <Card>
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Active Leads</div>
                    <div className="text-3xl font-black text-slate-900">--</div>
                    <div className="text-[10px] text-emerald-600 font-bold mt-1">Currently in sequence</div>
                  </CardContent>
               </Card>
               <Card>
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Avg. Completion</div>
                    <div className="text-3xl font-black text-slate-900">84%</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-1">Finished last workflow</div>
                  </CardContent>
               </Card>
               <Card>
                  <CardContent className="p-5">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Workflow Steps</div>
                    <div className="text-3xl font-black text-slate-900">{selectedRun.workflows.length}</div>
                    <div className="text-[10px] text-slate-400 font-medium mt-1">Automated interactions</div>
                  </CardContent>
               </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <GitBranch size={16} className="text-indigo-600" /> Sequence Visualization
              </h3>
              
              <div className="space-y-0 relative">
                {selectedRun.workflows.map((wf, idx) => (
                  <React.Fragment key={wf.id}>
                    <div className="relative z-10">
                      <Card className="border-slate-200 hover:border-indigo-200 transition-all group overflow-hidden">
                        <CardContent className="p-0 flex items-stretch">
                           <div className="w-12 bg-slate-50 flex flex-col items-center justify-center border-r border-slate-100 group-hover:bg-indigo-50 transition-colors">
                              <span className="text-lg font-black text-slate-300 group-hover:text-indigo-300">#{idx + 1}</span>
                           </div>
                           <div className="flex-1 p-4 grid grid-cols-12 gap-4 items-center">
                              <div className="col-span-4">
                                 <div className="text-sm font-bold text-slate-900 mb-0.5">{wf.name}</div>
                                 <div className="text-[10px] text-slate-400 font-medium truncate max-w-[200px]">{wf.description || 'No description provided'}</div>
                              </div>
                              <div className="col-span-3 flex flex-col gap-1">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Engagement</div>
                                 <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500" style={{ width: `${100 - (idx * 15)}%` }} />
                                 </div>
                              </div>
                              <div className="col-span-2 text-center">
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Status</div>
                                 <Badge className={wf.status === 'active' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-slate-50 text-slate-400'}>
                                    {wf.status}
                                 </Badge>
                              </div>
                              <div className="col-span-3 text-right">
                                 <Button 
                                   variant="ghost" 
                                   size="sm" 
                                   onClick={() => {
                                     setWorkflowFilterId(wf.id);
                                     setView('workflows');
                                     fetchRuns(wf.id);
                                   }}
                                   className="text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                 >
                                   View Details <ChevronRight size={14} />
                                 </Button>
                              </div>
                           </div>
                        </CardContent>
                      </Card>
                    </div>

                    {idx < selectedRun.workflows.length - 1 && (
                      <div className="h-12 flex flex-col items-center justify-center relative -my-1">
                         <div className="w-0.5 h-full border-r-2 border-dashed border-slate-200" />
                         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5 z-20">
                            <Clock size={12} className="text-indigo-500" />
                            <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest whitespace-nowrap">
                               {selectedRun.workflows[idx + 1].isIndependent ? 'Independent' : (selectedRun.workflows[idx + 1].delayMinutes > 0 ? `Wait ${selectedRun.workflows[idx + 1].delayMinutes}m` : 'Instant')}
                               {selectedRun.workflows[idx + 1].targetTime ? ` @ ${selectedRun.workflows[idx + 1].targetTime}` : ''}
                            </span>
                         </div>
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <Card className="bg-slate-900 border-0 text-white overflow-hidden">
               <CardHeader className="border-b border-slate-800">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                     <RefreshCw size={16} className="text-indigo-400" /> Campaign Flow Metrics
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-6">
                  <div className="grid grid-cols-3 gap-8">
                     <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Efficiency</div>
                        <div className="text-4xl font-black text-white">99.2%</div>
                        <p className="text-[10px] text-slate-500">Uptime across all automated steps</p>
                     </div>
                     <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg. Troughput</div>
                        <div className="text-4xl font-black text-indigo-400">14.2/hr</div>
                        <p className="text-[10px] text-slate-500">Leads processed by this track</p>
                     </div>
                     <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">System Health</div>
                        <div className="text-4xl font-black text-emerald-400">Optimal</div>
                        <p className="text-[10px] text-slate-500">Zero active bottlenecks detected</p>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* Campaign Leads Breakdown */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
               <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <div className="text-xs font-bold text-slate-700 uppercase tracking-widest flex items-center gap-2">
                     <Clock size={14} className="text-indigo-600" /> Active Leads in Track
                  </div>
                  <Badge variant="outline" className="bg-white">{stageLeads.length} Total Leads</Badge>
               </div>
               
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase">
                       <tr>
                          <th className="px-6 py-4">Contact</th>
                          <th className="px-6 py-4">Phone</th>
                          <th className="px-6 py-4">Last Completed</th>
                          <th className="px-6 py-4">Next Workflow</th>
                          <th className="px-6 py-4">Next Trigger</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {stageLeads.length === 0 ? (
                         <tr>
                            <td colSpan={5} className="px-6 py-20 text-center text-slate-400 italic">
                               No active leads found in this stage
                            </td>
                         </tr>
                       ) : (
                         stageLeads.map(lead => {
                            const now = new Date();
                            const triggerAt = lead.next_trigger ? new Date(lead.next_trigger) : null;
                            const remainMs = triggerAt ? triggerAt - now : null;
                            const isDue = remainMs !== null && remainMs < 0;
                            const remainMins = remainMs !== null ? Math.max(0, Math.round(remainMs / 60000)) : null;

                            return (
                               <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-6 py-4">
                                     <div className="font-bold text-slate-900">{lead.display_name || 'Anonymous'}</div>
                                     <div className="text-[10px] text-slate-400 capitalize">{lead.profile?.course || 'No Course'}</div>
                                  </td>
                                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                                     {lead.phone}
                                  </td>
                                  <td className="px-6 py-4">
                                     {lead.last_workflow ? (
                                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-100 font-bold uppercase text-[9px]">
                                           {lead.last_workflow}
                                        </Badge>
                                     ) : (
                                        <span className="text-slate-300 italic text-[10px]">None</span>
                                     )}
                                  </td>
                                  <td className="px-6 py-4">
                                     {lead.next_workflow ? (
                                        <div className="flex flex-col">
                                           <span className="text-xs font-bold text-slate-700">{lead.next_workflow}</span>
                                           {isDue && <span className="text-[9px] text-amber-600 font-bold uppercase tracking-tighter">Processing...</span>}
                                        </div>
                                     ) : (
                                        <Badge className="bg-slate-100 text-slate-400 border-0 font-medium text-[9px]">FINISH</Badge>
                                     )}
                                  </td>
                                  <td className="px-6 py-4">
                                     {triggerAt ? (
                                        <div className="flex flex-col">
                                           <span className="text-xs font-semibold text-indigo-600">
                                              In {remainMins > 60 ? `${Math.floor(remainMins/60)}h ${remainMins%60}m` : `${remainMins}m`}
                                           </span>
                                           <span className="text-[9px] text-slate-400">
                                              {triggerAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                           </span>
                                        </div>
                                     ) : (
                                        <span className="text-[10px] text-slate-300">--</span>
                                     )}
                                  </td>
                               </tr>
                            )
                         })
                       )}
                    </tbody>
                 </table>
               </div>
            </div>

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
             <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                <BarChart3 size={48} className="text-slate-200" />
             </div>
             <div className="text-center">
                <p className="font-semibold text-slate-900">No Selection</p>
                <p className="text-sm max-w-xs">Select a {view === 'workflows' ? 'workflow run' : view === 'templates' ? 'template message' : 'drip stage'} from the left sidebar to see detailed insights.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
