import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Modal } from './ui/Modal';
import { Image as ImageIcon, Video as VideoIcon, FileText, Loader2, RefreshCw, PlayCircle } from 'lucide-react';
import { Button } from './ui/Button';

export function GallerySelectModal({ isOpen, onClose, onSelect, resourceType = 'auto' }) {
  const [activeTab, setActiveTab] = useState('image');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (resourceType === 'image') setActiveTab('image');
      else if (resourceType === 'video') setActiveTab('video');
      else if (resourceType === 'document' || resourceType === 'raw') setActiveTab('raw');
      fetchMedia(activeTab);
    }
  }, [isOpen, resourceType]);

  useEffect(() => {
    if (isOpen) fetchMedia(activeTab);
  }, [activeTab]);

  const fetchMedia = async (type) => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/gallery?resource_type=${type}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to fetch media:', err);
    }
    setLoading(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select from Gallery" zIndex="z-[100]">
      <div className="flex flex-col h-[65vh] min-h-[500px]">
        <div className="flex justify-between items-center mb-4">
          <div className="flex gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <Button
              variant={activeTab === 'image' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('image')}
              className={activeTab === 'image' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}
            >
              <ImageIcon size={14} className="mr-1.5" /> Images
            </Button>
            <Button
              variant={activeTab === 'video' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('video')}
              className={activeTab === 'video' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}
            >
              <VideoIcon size={14} className="mr-1.5" /> Videos
            </Button>
            <Button
              variant={activeTab === 'raw' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('raw')}
              className={activeTab === 'raw' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}
            >
              <FileText size={14} className="mr-1.5" /> Docs
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => fetchMedia(activeTab)} disabled={loading}>
            <RefreshCw size={14} className={`text-slate-500 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl bg-slate-50 p-3 pr-1">
          {loading ? (
            <div className="flex h-full items-center justify-center text-slate-400">
              <Loader2 className="animate-spin w-6 h-6" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col h-full items-center justify-center text-slate-400 bg-white border border-dashed border-slate-300 rounded-lg">
              <ImageIcon size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No {activeTab} items found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-8 pr-2">
              {files.map(f => (
                <div key={f.public_id}
                  className="cursor-pointer group relative bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                  onClick={() => { onSelect(f.secure_url); onClose(); }} >

                  <div className="aspect-square bg-slate-50 flex items-center justify-center relative overflow-hidden">

                    {activeTab === 'image' && (
                      <img src={f.secure_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    )}

                    {activeTab === 'video' && (
                      <>
                        <video src={f.secure_url} className="w-full h-full object-cover filter brightness-[0.85] group-hover:brightness-50 transition-all duration-300 group-hover:scale-105" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <PlayCircle size={32} className="text-white drop-shadow-md opacity-90 group-hover:scale-110 transition-transform" />
                        </div>
                      </>
                    )}

                    {activeTab === 'raw' && (
                      <div className="flex flex-col items-center justify-center w-full h-full bg-blue-50/30 group-hover:bg-blue-50 transition-colors relative">
                           {(f.format === 'pdf' || (f.secure_url || '').toLowerCase().endsWith('.pdf')) ? (
                               <iframe src={`${f.secure_url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full pointer-events-none object-cover" />
                           ) : (
                               <>
                                 <FileText size={28} className="text-blue-500 mb-1 group-hover:scale-110 transition-transform" />
                                 <span className="text-[9px] font-bold text-blue-600 uppercase bg-white rounded shadow-sm px-1 py-0.5">
                                   {(f.format || f.public_id.split('.').pop() || 'DOC').substring(0, 4)}
                                 </span>
                               </>
                           )}
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <span className="text-white text-[11px] font-semibold px-3 py-1.5 bg-blue-600 rounded">Select File</span>
                    </div>
                  </div>

                  <div className="p-2 border-t border-slate-100 flex flex-col justify-between">
                    <span className="text-[10px] font-semibold text-slate-700 truncate leading-tight hover:text-blue-600" title={f.filename || f.public_id}>
                      {f.filename || f.public_id.split('/').pop()}
                    </span>
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-[8px] font-medium text-slate-400">{(f.bytes / 1024).toFixed(0)}KB</span>
                      <span className="text-[8px] font-bold text-slate-300 uppercase">{f.format || 'BIN'}</span>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
