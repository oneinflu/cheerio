'use strict';
import React, { useEffect, useState, useRef } from 'react';
import { sendText, sendMedia, sendTemplate, uploadMedia, getTemplates, starTemplate, unstarTemplate, fetchMediaLibrary } from '../api';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ProposalModal } from './ProposalModal';
import { TemplateListModal } from './TemplateListModal';
import { Send, Paperclip, Image as ImageIcon, File, Mic, FileText, BookOpen, BarChart, DollarSign, Loader2, MessageSquare, MapPin, User, Video, Star, MoreHorizontal } from 'lucide-react';

export default function Chat({ socket, conversationId, messages, onRefresh, isLoading }) {
  const [text, setText] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [mediaLink, setMediaLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaKind, setMediaKind] = useState('image');
  const [caption, setCaption] = useState('');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTypingSelf, setIsTypingSelf] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [recentMedia, setRecentMedia] = useState([]);
  const [isLoadingRecentMedia, setIsLoadingRecentMedia] = useState(false);
  const [recentMediaError, setRecentMediaError] = useState('');
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const getSafeValue = (val) => {
    if (val == null) return '';
    if (typeof val === 'string' || typeof val === 'number') return val;
    if (typeof val === 'object') {
      if (typeof val.text === 'string') return val.text;
      if (typeof val.type === 'string') return val.type;
      return '';
    }
    return String(val);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    getTemplates().then(data => {
      if (data && data.data) {
        setTemplates(data.data);
      }
    }).catch(err => console.error('Failed to load templates in Chat:', err));
  }, []);

  useEffect(() => {
    if (!showMediaInput) return;
    setIsLoadingRecentMedia(true);
    setRecentMediaError('');
    fetchMediaLibrary(10)
      .then((res) => {
        const rows = res && res.data ? res.data : [];
        setRecentMedia(rows);
      })
      .catch((err) => {
        console.error('Failed to load recent media:', err);
        setRecentMediaError('Failed to load recent media');
      })
      .finally(() => {
        setIsLoadingRecentMedia(false);
      });
  }, [showMediaInput]);

  const renderTemplateMessage = (m) => {
    const templateName = m.rawPayload.name;
    const templateDef = templates.find(t => t.name === templateName);

    // Helper to substitute parameters into text
    const substituteParams = (text, params) => {
      if (!text) return '';
      if (!params || params.length === 0) return text;
      let res = text;
      params.forEach((p, i) => {
        const val = getSafeValue(p);
        res = res.replace(new RegExp(`\\{\\{${i + 1}\\}\\}`, 'g'), val);
      });
      return res;
    };

    if (!templateDef) {
       return (
         <div className="space-y-2">
           <div className="text-sm italic text-slate-500">Template: {templateName}</div>
            {m.rawPayload?.components?.find(c => c.type === 'body')?.parameters?.length > 0 && (
               <div className="text-xs opacity-90">
                 <ul className="list-disc pl-4 space-y-0.5">
                   {m.rawPayload.components.find(c => c.type === 'body').parameters.map((p, i) => (
                     <li key={`b-${i}`}>{getSafeValue(p)}</li>
                   ))}
                 </ul>
               </div>
            )}
         </div>
       );
    }

    const headerComp = templateDef.components.find(c => c.type === 'HEADER');
    const bodyComp = templateDef.components.find(c => c.type === 'BODY');
    const footerComp = templateDef.components.find(c => c.type === 'FOOTER');
    const buttonsComp = templateDef.components.find(c => c.type === 'BUTTONS');

    const msgBodyParams = m.rawPayload.components?.find(c => c.type === 'body')?.parameters || [];
    const msgHeaderParams = m.rawPayload.components?.find(c => c.type === 'header')?.parameters || [];

    let headerContent = null;
    if (headerComp) {
        if (headerComp.format === 'TEXT') {
           const text = substituteParams(headerComp.text, msgHeaderParams);
           headerContent = <div className="font-bold text-sm mb-1">{text}</div>;
        } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(headerComp.format)) {
           const mediaParam = msgHeaderParams[0];
           if (mediaParam && mediaParam.image) {
              const src = mediaParam.image.link || '';
              headerContent = (
                 <div className="mb-2 rounded-lg overflow-hidden bg-slate-100">
                    <img src={src} alt="Header" className="w-full h-auto object-cover" />
                 </div>
              );
           } else {
              headerContent = (
                 <div className="mb-2 flex items-center gap-2 text-xs text-slate-500 bg-slate-100 p-2 rounded">
                    <ImageIcon size={14} /> <span>{headerComp.format} Header</span>
                 </div>
              );
           }
        }
    }

    let bodyContent = null;
    if (bodyComp) {
        const text = substituteParams(bodyComp.text, msgBodyParams);
        bodyContent = <div className="text-sm whitespace-pre-wrap leading-relaxed">{text}</div>;
    }

    let footerContent = null;
    if (footerComp) {
        footerContent = <div className="text-[10px] text-slate-400 mt-2 pt-1 border-t border-slate-100">{footerComp.text}</div>;
    }

    let buttonsContent = null;
    if (buttonsComp && buttonsComp.buttons) {
        buttonsContent = (
            <div className="grid gap-2 mt-3 pt-2 border-t border-slate-100/50">
               {buttonsComp.buttons.map((btn, idx) => {
                  if (btn.type === 'QUICK_REPLY') {
                     return (
                        <div key={idx} className="bg-white text-blue-600 text-sm font-medium py-2 px-3 rounded text-center shadow-sm border border-slate-100 cursor-default">
                           {btn.text}
                        </div>
                     );
                  }
                  if (btn.type === 'URL') {
                      return (
                        <a key={idx} href={btn.url} target="_blank" rel="noreferrer" className="bg-white text-blue-600 text-sm font-medium py-2 px-3 rounded text-center shadow-sm border border-slate-100 flex items-center justify-center gap-1 hover:bg-slate-50">
                           {btn.text} <DollarSign size={12} className="opacity-50"/>
                        </a>
                      );
                  }
                  if (btn.type === 'PHONE_NUMBER') {
                      return (
                        <a key={idx} href={`tel:${btn.phone_number}`} className="bg-white text-blue-600 text-sm font-medium py-2 px-3 rounded text-center shadow-sm border border-slate-100 hover:bg-slate-50">
                           {btn.text}
                        </a>
                      );
                  }
                  return null;
               })}
            </div>
        );
    }

    return (
       <div className="">
          {headerContent}
          {bodyContent}
          {footerContent}
          {buttonsContent}
       </div>
    );
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setSendError('');
    setIsInitiating(false);
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('join:conversation', conversationId);
    
    const onStatus = (evt) => {
      if (evt.conversationId === conversationId) onRefresh();
    };
    const onTyping = ({ conversationId: cId, userId, isTyping }) => {
      console.log('[Chat] onTyping event:', { cId, userId, isTyping });
      if (cId !== conversationId) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (isTyping) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    // socket.on('message:new', onNew); // Handled by App.jsx optimistically
    socket.on('message:status', onStatus);
    socket.on('conversation:typing', onTyping);
    return () => {
      // socket.off('message:new', onNew);
      socket.off('message:status', onStatus);
      socket.off('conversation:typing', onTyping);
    };
  }, [socket, conversationId, onRefresh]);

  const handleInputChange = (e) => {
    setText(e.target.value);

    if (socket && conversationId) {
      socket.emit('conversation:typing', { conversationId, isTyping: true });
      
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('conversation:typing', { conversationId, isTyping: false });
      }, 3000);
    }
  };

  const handleSendText = async () => {
    if (!text.trim()) return;
    setIsSending(true);
    setSendError('');
    try {
      const resp = await sendText(conversationId, text.trim());
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send message');
      }
      setText('');
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendMedia = async () => {
    if (!mediaLink.trim() && !selectedFile) return;
    setIsSending(true);
    setSendError('');
    try {
      let linkToSend = mediaLink.trim();
      
      if (selectedFile) {
        // 1. Upload file to backend -> WhatsApp
        const uploadResp = await uploadMedia(conversationId, selectedFile);
        if (uploadResp && uploadResp.error) {
           throw new Error(uploadResp.message || 'Failed to upload media');
        }
        if (!uploadResp.id) {
           throw new Error('Upload successful but no media ID returned');
        }
        linkToSend = uploadResp.id;
      }

      const resp = await sendMedia(conversationId, mediaKind, linkToSend, caption || null);
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send media');
      }
      setMediaLink('');
      setSelectedFile(null);
      setCaption('');
      setShowMediaInput(false);
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to send media');
    } finally {
      setIsSending(false);
    }
  };

  const handleSendProposal = async (data) => {
    // Construct WhatsApp Template components
    const components = [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: data.courseName },
          { type: 'text', text: data.packageName },
          { type: 'text', text: `₹${data.finalPrice.toLocaleString()}` }
        ]
      },
      {
        type: 'button',
        sub_type: 'url',
        index: '0',
        parameters: [
          { type: 'text', text: `${data.finalPrice}` } // Dynamic part of URL
        ]
      }
    ];

    // For the prototype, we assume a template named 'proposal_invoice' exists
    setIsSending(true);
    setSendError('');
    try {
      const resp = await sendTemplate(conversationId, 'proposal_invoice', 'en_US', components);
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send template');
      }
      setShowProposalModal(false);
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to send template');
    } finally {
      setIsSending(false);
    }
  };

  const handleToggleStar = async (template) => {
    // Optimistic update
    const isStarred = template.is_starred;
    setTemplates(prev => prev.map(t => 
      t.name === template.name ? { ...t, is_starred: !isStarred } : t
    ));

    try {
      if (isStarred) {
        await unstarTemplate(template.name);
      } else {
        await starTemplate(template.name);
      }
    } catch (err) {
      console.error('Failed to toggle star:', err);
      // Revert on error
      setTemplates(prev => prev.map(t => 
        t.name === template.name ? { ...t, is_starred: isStarred } : t
      ));
    }
  };

  const handleSendStarredTemplate = async (template) => {
    setIsSending(true);
    setSendError('');
    try {
      // Default language en_US for now, or use template.language if available
      const lang = template.language || 'en_US';
      const resp = await sendTemplate(conversationId, template.name, lang, []);
      if (resp && resp.error) {
        throw new Error(resp.message || 'Failed to send template');
      }
      await onRefresh();
    } catch (err) {
      setSendError(err?.message || 'Failed to send template');
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickAction = async (action) => {
    if (action === 'proposal') {
      setShowProposalModal(true);
      return;
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
    }
  };

  if (!conversationId) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center">
           <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
             <MessageSquare className="h-8 w-8 text-slate-400" />
           </div>
           <h3 className="text-lg font-semibold text-slate-700 mb-1">Select Conversation</h3>
           <p className="text-sm text-slate-500">Select any conversation to view all the messages.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (messages.length === 0 && !isInitiating) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-slate-500">
        <div className="text-center">
           <div className="mx-auto h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
             <MessageSquare className="h-8 w-8 text-slate-400" />
           </div>
           <h3 className="text-lg font-semibold text-slate-700 mb-1">Start a Conversation</h3>
           <p className="text-sm text-slate-500 mb-6">There are no messages here yet.</p>
           <Button onClick={() => setIsInitiating(true)}>
             Initiate new conversation
           </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#E5DDD5]"
        style={{ backgroundImage: "url('/bg.png')" }}
      >
        {messages.map((m, index) => {
          const isOutbound = m.direction === 'outbound';
          const messageDate = new Date(m.createdAt);
          const dateStr = messageDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          
          let showDateHeader = false;
          if (index === 0) {
            showDateHeader = true;
          } else {
            const prevDate = new Date(messages[index - 1].createdAt);
            const prevDateStr = prevDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            if (dateStr !== prevDateStr) {
              showDateHeader = true;
            }
          }

          return (
            <React.Fragment key={m.id}>
              {showDateHeader && (
                <div className="flex justify-center my-4 sticky top-0 z-10">
                   <span className="bg-[#EAE6DF] text-slate-600 text-xs px-3 py-1 rounded-lg shadow-sm font-medium border border-[#D1D7DB]/50">
                     {dateStr}
                   </span>
                </div>
              )}
              <div className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
                <div className={cn(
                    "max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                    isOutbound
                      ? "bg-[#d9fdd3] text-slate-900 rounded-tr-sm"
                      : "bg-white text-slate-900 rounded-tl-sm"
                  )}>
                {/* Reply Context - Hide for Interactive/Button replies to match WhatsApp UI */}
                {m.rawPayload?.context && m.rawPayload?.type !== 'interactive' && m.rawPayload?.type !== 'button' && (
                  <div className="mb-2 text-xs bg-black/5 p-1.5 rounded border-l-2 border-slate-400 opacity-80">
                     <div className="font-semibold text-[10px] text-slate-600 flex items-center gap-1">
                       <MessageSquare size={10} /> 
                       Replying to a message
                     </div>
                  </div>
                )}
                {m.contentType === 'text' ? (
                  m.rawPayload?.type === 'template' ? (
                    renderTemplateMessage(m)
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {getSafeValue(
                        m.textBody ||
                          (m.rawPayload?.type === 'interactive' && m.rawPayload.interactive?.button_reply?.title) ||
                          (m.rawPayload?.type === 'interactive' && m.rawPayload.interactive?.list_reply?.title) ||
                          (m.rawPayload?.type === 'button' && m.rawPayload.button?.text) ||
                          ''
                      )}
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    {m.attachments.map((a) => {
                      const isUrl = a.url && (a.url.startsWith('http') || a.url.startsWith('/'));
                      const src = isUrl ? a.url : `/api/media/${a.url}`;
                      const isImage = m.contentType === 'image' || a.kind === 'image' || m.contentType === 'sticker' || a.kind === 'sticker';
                      const isVideo = m.contentType === 'video' || a.kind === 'video';

                      return (
                        <div key={a.id} className="rounded bg-black/5 p-2">
                           {isImage ? (
                             <div className="relative">
                               <img 
                                 src={src} 
                                 alt="Attachment" 
                                 className="rounded-md max-w-[250px] h-auto object-cover cursor-pointer hover:opacity-95 transition-opacity"
                                 onClick={() => window.open(src, '_blank')}
                                 onLoad={scrollToBottom}
                                 onError={(e) => {
                                   e.target.onerror = null; 
                                   e.target.style.display = 'none';
                                 }}
                               />
                               {m.contentType !== 'sticker' && a.kind !== 'sticker' && (
                                 <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                                   <ImageIcon size={12} /> Image
                                 </div>
                               )}
                             </div>
                           ) : isVideo ? (
                             <div className="relative">
                               <video 
                                 src={src} 
                                 controls 
                                 className="rounded-md max-w-[250px] h-auto"
                                 onLoadedData={scrollToBottom}
                               />
                               <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                                 <Video size={12} /> Video
                               </div>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2">
                               <File size={16} />
                               <a href={src} target="_blank" rel="noreferrer" className="underline text-xs truncate max-w-[150px]">
                                 View {a.kind || 'Attachment'}
                               </a>
                             </div>
                           )}
                        </div>
                      );
                    })}

                    {/* Location */}
                    {m.contentType === 'location' && m.rawPayload?.location && (
                       <div className="rounded bg-black/5 p-2 min-w-[200px]">
                          <div className="flex items-start gap-2">
                             <MapPin size={20} className="text-red-500 mt-0.5" />
                             <div>
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${m.rawPayload.location.latitude},${m.rawPayload.location.longitude}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:underline block"
                                >
                                  {m.rawPayload.location.name || 'Shared Location'}
                                </a>
                                <div className="text-xs text-slate-500 mt-0.5">{m.rawPayload.location.address}</div>
                             </div>
                          </div>
                       </div>
                    )}

                    {/* Contact */}
                    {m.contentType === 'contact' && m.rawPayload?.contacts && (
                       <div className="space-y-2">
                          {m.rawPayload.contacts.map((c, idx) => (
                             <div key={idx} className="rounded bg-black/5 p-2 min-w-[200px] flex items-center gap-3">
                                <div className="bg-slate-200 p-2 rounded-full">
                                   <User size={20} className="text-slate-500" />
                                </div>
                                <div>
                                   <div className="text-sm font-medium">{c.name?.formatted_name}</div>
                                   {c.phones && c.phones[0] && (
                                      <div className="text-xs text-slate-500">{c.phones[0].phone}</div>
                                   )}
                                </div>
                             </div>
                          ))}
                       </div>
                    )}
                    {m.textBody && (
                      <div className="text-xs opacity-90 pt-1">
                        {getSafeValue(m.textBody)}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-[10px] mt-1 text-right opacity-70 text-slate-500">
                   {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
            </React.Fragment>
          );
        })}
        {typingUsers.size > 0 && (
          <div className="flex w-full justify-start mb-2">
             <div className="bg-white text-slate-500 border border-slate-100 rounded-tl-sm rounded-2xl px-4 py-2 text-xs italic shadow-sm flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-500"></span>
                </span>
                Someone is typing...
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
        {sendError ? (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {sendError}
          </div>
        ) : null}
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200 flex-nowrap">
           
           {templates.filter(t => t.is_starred).map(t => (
             <Button 
               key={t.name}
               variant="outline" 
               size="sm" 
               className="h-8 text-xs gap-1.5 whitespace-nowrap shrink-0" 
               onClick={() => handleSendStarredTemplate(t)}
               disabled={isSending}
             >
               <Star size={14} className="fill-yellow-400 text-yellow-400" />
               {t.name.replace(/_/g, ' ')}
             </Button>
           ))}

           <div className="h-4 w-px bg-slate-200 mx-1 shrink-0" />
           
           <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-slate-100 shrink-0" onClick={() => setShowTemplateModal(true)} title="Manage Templates">
             <MoreHorizontal size={16} className="text-slate-500" />
           </Button>
        </div>

        {showMediaInput && (
          <div className="mb-4 p-4 rounded-lg bg-slate-50 border border-slate-100 space-y-3">
             <div className="flex gap-2">
                <Button
                   size="sm"
                   variant={mediaKind === 'image' ? 'default' : 'outline'}
                   onClick={() => setMediaKind('image')}
                >
                  <ImageIcon size={14} className="mr-2"/> Image
                </Button>
                <Button
                   size="sm"
                   variant={mediaKind === 'document' ? 'default' : 'outline'}
                   onClick={() => setMediaKind('document')}
                >
                  <File size={14} className="mr-2"/> Document
                </Button>
             </div>
             
            <div className="space-y-2">
               <div className="flex gap-2 items-center">
                  <Button 
                     size="sm" 
                     variant="outline" 
                     onClick={() => fileInputRef.current?.click()}
                  >
                    {selectedFile ? 'Change File' : 'Choose File'}
                  </Button>
                  <span className="text-xs text-slate-500 truncate max-w-[200px]">
                    {selectedFile ? selectedFile.name : 'No file selected'}
                  </span>
                  <input 
                     type="file" 
                     ref={fileInputRef} 
                     className="hidden" 
                     onChange={(e) => {
                       if(e.target.files?.[0]) {
                         setSelectedFile(e.target.files[0]);
                         setMediaLink('');
                       }
                     }}
                     accept={mediaKind === 'image' ? "image/*" : "*/*"}
                  />
               </div>
               <div className="text-xs text-slate-400 text-center">- OR -</div>
               <Input
                 placeholder="Media URL (e.g., https://example.com/image.png)"
                 value={mediaLink}
                 onChange={(e) => {
                   setMediaLink(e.target.value);
                   if(e.target.value) setSelectedFile(null);
                 }}
                 disabled={!!selectedFile}
               />
               {isLoadingRecentMedia && (
                 <div className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                   <Loader2 size={12} className="animate-spin" /> Loading recent media...
                 </div>
               )}
               {recentMediaError && (
                 <div className="mt-2 text-xs text-red-500">{recentMediaError}</div>
               )}
               {!isLoadingRecentMedia && !recentMediaError && recentMedia && recentMedia.length > 0 && (
                 <div className="mt-3">
                   <div className="text-xs font-medium text-slate-500 mb-1">Recent media</div>
                   <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                     {recentMedia.map((m) => (
                       <button
                         key={m.id}
                         type="button"
                         className="border border-slate-200 rounded px-2 py-1 text-[11px] flex items-center gap-1 bg-white hover:bg-slate-50"
                         onClick={() => {
                           setMediaLink(m.url);
                           setSelectedFile(null);
                         }}
                       >
                         <FileText size={12} className="text-slate-400" />
                         <span className="truncate max-w-[140px]">
                           {m.original_filename || m.url}
                         </span>
                       </button>
                     ))}
                   </div>
                 </div>
               )}
            </div>

             <Input
               placeholder="Caption (optional)"
               value={caption}
               onChange={(e) => setCaption(e.target.value)}
             />
             <div className="flex justify-end gap-2">
               <Button variant="ghost" size="sm" onClick={() => {
                 setShowMediaInput(false);
                 setSelectedFile(null);
                 setMediaLink('');
               }}>Cancel</Button>
               <Button size="sm" onClick={handleSendMedia} disabled={!mediaLink && !selectedFile}>Send Media</Button>
             </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <Button variant="ghost" size="icon" className="text-slate-500 hover:text-slate-900" onClick={() => setShowMediaInput(!showMediaInput)}>
            <Paperclip size={20} />
          </Button>
          <div className="flex-1 relative">
            <Input
              className="pr-10 py-3 h-auto max-h-32 min-h-[44px]"
              placeholder="Type a message..."
              value={text}
              onChange={handleInputChange}
              onKeyDown={handleKeyPress}
            />
          </div>
          <Button
             className="h-11 w-11 rounded-lg bg-[#00a884] hover:bg-[#008f6f] text-white shadow-sm"
             onClick={handleSendText}
             disabled={!text.trim() || isSending}
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
      <ProposalModal 
        isOpen={showProposalModal} 
        onClose={() => setShowProposalModal(false)} 
        onSend={handleSendProposal} 
      />
      <TemplateListModal 
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        templates={templates}
        onToggleStar={handleToggleStar}
      />
    </div>
  );
}
