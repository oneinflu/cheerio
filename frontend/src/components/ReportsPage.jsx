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
  const [runs, setRuns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [webhookData, setWebhookData] = useState(null);

  useEffect(() => {
    fetchRuns();
  }, []);

  const fetchRuns = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/reports/workflow-runs?limit=100', {
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 border-green-200">Success</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-700 border-red-200">Failed</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">{status}</Badge>;
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-slate-50">
      {/* Sidebar List */}
      <div className="w-1/3 border-r border-slate-200 flex flex-col bg-white">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 size={20} className="text-indigo-600" />
            <h1 className="text-lg font-bold text-slate-900">Workflow Runs</h1>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchRuns} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-8 text-center text-slate-400">Loading runs...</div>
          ) : runs.length === 0 ? (
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
                    <span className="flex items-center gap-1"><Clock size={12} /> {new Date(run.started_at).toLocaleTimeString()}</span>
                    <span className="flex items-center gap-1"><Play size={12} /> {run.duration_ms}ms</span>
                  </div>
                  <div className="text-xs text-slate-600 font-mono bg-slate-100 px-2 py-1 rounded inline-block">
                    {run.phone_number}
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
        ) : selectedRun ? (
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
              <div className="flex gap-2">
                 <Button variant="outline" size="sm" className="gap-2">
                    <GitBranch size={16} /> Edit Workflow
                 </Button>
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
                          {log.status === 'started' && !log.error && <Badge size="xs" className="text-[9px] py-0 bg-blue-50 text-blue-600 border-blue-100">Step OK</Badge>}
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
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
             <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100">
                <BarChart3 size={48} className="text-slate-200" />
             </div>
             <div className="text-center">
                <p className="font-semibold text-slate-900">No Run Selected</p>
                <p className="text-sm max-w-xs">Select a workflow execution from the left sidebar to see detailed logs and traces.</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
}
