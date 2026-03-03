import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Settings, Image as ImageIcon, FileText, Video as VideoIcon, UploadCloud, Trash2, RefreshCw } from 'lucide-react';

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState('image'); // image, video, raw
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchMedia();
  }, [activeTab]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`/api/gallery?resource_type=${activeTab}`, {
         headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to fetch media:', err);
    }
    setLoading(false);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    // Attempt parsing correct resourceType locally for query logic
    let typeToPass = 'auto';
    if(file.type.startsWith('image/')) typeToPass = 'image';
    if(file.type.startsWith('video/')) typeToPass = 'video';
    formData.append('resource_type', typeToPass);

    try {
      await axios.post('/api/gallery/upload', formData, {
        headers: { 
          'Content-Type': 'multipart/form-data',
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`
        }
      });
      fetchMedia();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Upload failed');
    }
    setUploading(false);
  };

  const handleDelete = async (public_id) => {
    if (!window.confirm("Delete this asset permanently?")) return;
    try {
      await axios.delete('/api/gallery', {
         data: { public_id, resource_type: activeTab },
         headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
      });
      setFiles(files.filter(f => f.public_id !== public_id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const copyToClipboard = (url) => {
     let secure = url;
     if(secure.startsWith("http://")) secure = secure.replace("http://", "https://");
     navigator.clipboard.writeText(secure);
     alert("URL Copied!");
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-slate-50 min-w-0">
      {/* Header */}
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 z-10 shrink-0 shadow-sm">
        <div>
           <h1 className="text-xl font-bold text-slate-900">Media Gallery</h1>
           <p className="text-xs text-slate-500">Manage assets via Cloudinary</p>
        </div>
        <div className="flex gap-3">
           <button 
             onClick={fetchMedia} 
             disabled={loading}
             className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
           >
             <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
           </button>
           
           <label className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md shadow-sm cursor-pointer transition-colors">
             <UploadCloud size={16} />
             {uploading ? 'Uploading...' : 'Upload Asset'}
             <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
           </label>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden p-6">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200 mb-6">
          <button 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'image' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('image')}
          >
            <ImageIcon size={16} /> Images
          </button>
          <button 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'video' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('video')}
          >
            <VideoIcon size={16} /> Videos
          </button>
          <button 
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'raw' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('raw')}
          >
            <FileText size={16} /> Documents
          </button>
        </div>

        {/* Cloudinary File Grid */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
             <div className="flex items-center justify-center h-40 text-slate-400">Loading resources...</div>
          ) : files.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-white border border-dashed border-slate-300 rounded-xl">
               <ImageIcon size={32} className="mb-2 opacity-50" />
               <p>No {activeTab}s found in Cloudinary folder.</p>
             </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 pb-12">
              {files.map(file => (
                <div key={file.public_id} className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-md transition-all">
                  
                  {/* Thumbnail */}
                  <div 
                     className="relative aspect-square bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer"
                     onClick={() => copyToClipboard(file.secure_url)}
                     title="Click to copy URL"
                  >
                     {activeTab === 'image' && (
                       <img src={file.secure_url} alt={file.filename} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                     )}
                     {activeTab === 'video' && (
                       <video src={file.secure_url} className="w-full h-full object-cover opacity-80" />
                     )}
                     {activeTab === 'raw' && (
                       <FileText size={40} className="text-slate-400" />
                     )}

                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <span className="text-white text-xs font-semibold px-2 py-1 bg-black/60 rounded">Copy Link</span>
                     </div>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="p-3">
                     <p className="text-xs font-medium text-slate-800 truncate mb-1" title={file.filename || file.public_id}>
                       {file.filename || (file.public_id.split('/').pop())}
                     </p>
                     <div className="flex items-center justify-between text-[10px] text-slate-500">
                       <span>{(file.bytes / 1024).toFixed(1)} KB</span>
                       <span>{file.format || 'bin'}</span>
                     </div>
                     <button 
                       onClick={() => handleDelete(file.public_id)}
                       className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded transition-colors"
                     >
                        <Trash2 size={12} /> Delete
                     </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
