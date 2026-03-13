import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Image as ImageIcon, FileText, Video as VideoIcon, UploadCloud, Trash2, RefreshCw, PlayCircle, X, Search } from 'lucide-react';

export default function GalleryPage() {
  const [activeTab, setActiveTab] = useState('image'); // image, video, raw
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);

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
  
  const filteredFiles = files.filter(f => {
      const name = (f.filename || f.public_id.split('/').pop()).toLowerCase();
      return name.includes(searchQuery.toLowerCase());
  });

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
             <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} accept={activeTab === 'image' ? 'image/*' : activeTab === 'video' ? 'video/mp4,video/*,video/x-m4v' : '.pdf,application/pdf'} />
           </label>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden px-6 pt-6">
        
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-200 mb-6 pb-2">
            {/* Tabs */}
            <div className="flex gap-2">
              <button 
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'image' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                onClick={() => setActiveTab('image')}
              >
                <ImageIcon size={16} /> Images
              </button>
              <button 
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'video' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                onClick={() => setActiveTab('video')}
              >
                <VideoIcon size={16} /> Videos
              </button>
              <button 
                className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'raw' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
                onClick={() => setActiveTab('raw')}
              >
                <FileText size={16} /> Documents
              </button>
            </div>

            {/* Search */}
            <div className="relative">
               <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
               <input 
                 type="text" 
                 placeholder="Search file name..." 
                 className="pl-8 pr-4 py-1.5 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white shadow-sm w-64"
                 value={searchQuery}
                 onChange={e => setSearchQuery(e.target.value)}
               />
            </div>
        </div>

        {/* Cloudinary File Grid */}
        <div className="flex-1 overflow-y-auto pr-2 pb-12">
          {loading ? (
             <div className="flex items-center justify-center h-40 text-slate-400">Loading resources...</div>
          ) : filteredFiles.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-48 text-slate-400 bg-white border border-dashed border-slate-300 rounded-xl">
               <ImageIcon size={32} className="mb-2 opacity-30" />
               <p className="text-sm">No {activeTab}s found.</p>
             </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-4">
              {filteredFiles.map(file => (
                <div key={file.public_id} className="group flex flex-col bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all">
                  
                  {/* Thumbnail / Preview Area */}
                  <div 
                     className="relative aspect-square bg-slate-50 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                     {activeTab === 'image' && (
                       <img 
                         src={file.secure_url} 
                         onClick={() => copyToClipboard(file.secure_url)}
                         alt={file.filename} 
                         className="w-full h-full object-cover transform duration-300 group-hover:scale-110" 
                       />
                     )}
                     
                     {activeTab === 'video' && (
                       <>
                         <video 
                           src={file.secure_url} 
                           className="w-full h-full object-cover filter brightness-[0.85] group-hover:brightness-50 transition-all duration-300 group-hover:scale-110" 
                           onClick={() => setActiveVideoUrl(file.secure_url)}
                         />
                         <div 
                           className="absolute inset-0 flex items-center justify-center"
                           onClick={() => setActiveVideoUrl(file.secure_url)}
                         >
                            <PlayCircle size={32} className="text-white drop-shadow-md opacity-90 group-hover:scale-110 transition-transform" />
                         </div>
                       </>
                     )}
                     
                     {activeTab === 'raw' && (
                        <div 
                          className="flex flex-col items-center justify-center w-full h-full bg-blue-50/30 hover:bg-blue-50 transition-colors relative"
                          onClick={() => window.open(file.secure_url, '_blank')}
                          title="Click to view/download Document"
                        >
                           {(file.format === 'pdf' || (file.secure_url || '').toLowerCase().endsWith('.pdf')) ? (
                               <iframe src={`${file.secure_url}#toolbar=0&navpanes=0&scrollbar=0`} className="w-full h-full pointer-events-none object-cover" />
                           ) : (
                               <>
                                 <FileText size={28} className="text-blue-500 mb-1.5 group-hover:scale-110 transition-transform" />
                                 <span className="text-[9px] font-bold text-blue-600 px-2 text-center uppercase tracking-wider bg-white rounded shadow-sm py-0.5">
                                   {(file.format || file.public_id.split('.').pop() || 'DOC').toUpperCase().substring(0, 4)}
                                 </span>
                               </>
                           )}
                        </div>
                     )}

                     {activeTab === 'image' && (
                       <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); copyToClipboard(file.secure_url); }}>
                           <p className="text-white text-[10px] font-semibold text-center select-none">Click to Copy URL</p>
                       </div>
                     )}
                     {activeTab === 'raw' && (
                       <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={(e) => { e.stopPropagation(); copyToClipboard(file.secure_url); }} title="Copy Link" className="bg-white p-1 rounded-md shadow-sm hover:bg-blue-50 text-slate-600 border border-slate-200">
                           <ImageIcon size={12} />
                         </button>
                       </div>
                     )}
                  </div>

                  {/* Metadata & Actions */}
                  <div className="p-2 flex flex-col justify-between flex-1 bg-white z-10 border-t border-slate-100">
                     <div>
                       <p className="text-[10px] font-semibold text-slate-700 truncate mb-0.5 leading-tight hover:text-blue-600 cursor-default" title={file.filename || file.public_id}>
                         {file.filename || (file.public_id.split('/').pop())}
                       </p>
                       <div className="flex items-center justify-between text-[8px] text-slate-400 font-medium">
                         <span>{(file.bytes / 1024).toFixed(0)} KB</span>
                         <span className="uppercase">{file.format || 'BIN'}</span>
                       </div>
                     </div>
                     <button 
                       onClick={() => handleDelete(file.public_id)}
                       className="mt-1.5 w-full flex items-center justify-center gap-1 py-1 text-[9px] font-semibold text-red-500 hover:text-red-700 hover:bg-red-50 rounded bg-slate-50 transition-colors"
                     >
                        <Trash2 size={10} /> Delete
                     </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Video Modal Player */}
      {activeVideoUrl && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-200">
            <button 
               onClick={() => setActiveVideoUrl(null)}
               className="absolute top-6 right-6 text-white/70 hover:text-white transition-colors bg-white/10 p-2.5 rounded-full hover:bg-white/20"
            >
               <X size={24} />
            </button>
            <div className="relative w-full max-w-5xl mx-4">
               <div className="bg-black rounded-lg overflow-hidden shadow-2xl ring-1 ring-white/10 aspect-video flex items-center justify-center">
                  <video 
                    src={activeVideoUrl} 
                    className="w-full h-full object-contain"
                    controls 
                    autoPlay
                  />
               </div>
            </div>
         </div>
      )}

    </div>
  );
}
