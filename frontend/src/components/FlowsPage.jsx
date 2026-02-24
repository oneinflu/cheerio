import React, { useState, useEffect } from 'react';
import { Search, RefreshCw, Filter, Plus, Edit2, Upload, FileText } from 'lucide-react';
import { listWhatsappFlows, syncWhatsappFlows } from '../api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';

export default function FlowsPage() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadFlows();
  }, []);

  const loadFlows = async () => {
    setLoading(true);
    try {
      const data = await listWhatsappFlows();
      setFlows(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncWhatsappFlows();
      await loadFlows();
    } catch (err) {
      console.error(err);
      alert('Failed to sync flows');
    } finally {
      setSyncing(false);
    }
  };

  const filteredFlows = flows.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 h-screen overflow-y-auto bg-slate-50/50">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-green-100 rounded-lg">
          <FileText className="w-6 h-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">WhatsApp Forms</h1>
          <p className="text-slate-500">Transform leadgen via interactive WhatsApp Forms</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex justify-between items-center bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder="Search by name" 
            className="pl-9 h-10"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sync Data
          </Button>
          <Button variant="outline">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            Create New Form
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card className="overflow-hidden border-slate-200 shadow-sm">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-semibold text-slate-700">WhatsApp Forms Details</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white text-slate-500 font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Form Name</th>
                <th className="px-6 py-4">Form ID</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Responses</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                     <div className="flex items-center justify-center gap-2">
                       <RefreshCw className="w-4 h-4 animate-spin" />
                       Loading forms...
                     </div>
                   </td>
                 </tr>
              ) : filteredFlows.length === 0 ? (
                 <tr>
                   <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                     <p>No forms found.</p>
                     <p className="text-xs mt-1">Click "Sync Data" to fetch from Meta or create a new one.</p>
                   </td>
                 </tr>
              ) : (
                filteredFlows.map((flow) => (
                  <tr key={flow.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900">{flow.name}</td>
                    <td className="px-6 py-4 text-slate-500 font-mono text-xs">{flow.flow_id}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                        flow.status === 'PUBLISHED' ? 'bg-green-50 text-green-700 border-green-200' : 
                        flow.status === 'DEPRECATED' ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        {flow.status || 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">0</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-2 hover:bg-slate-100 rounded-md text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-md text-slate-400 hover:text-green-600 transition-colors" title="Sync/Upload">
                          <Upload className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
