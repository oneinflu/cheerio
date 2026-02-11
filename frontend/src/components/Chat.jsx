'use strict';
import React, { useEffect, useState, useRef } from 'react';
import { sendText, sendMedia, sendTemplate, uploadMedia } from '../api';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ProposalModal } from './ProposalModal';
import { Send, Paperclip, Image as ImageIcon, File, Mic, FileText, BookOpen, BarChart, DollarSign, Loader2, MessageSquare } from 'lucide-react';

export default function Chat({ socket, conversationId, messages, onRefresh, isLoading }) {
  const [text, setText] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [mediaLink, setMediaLink] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [mediaKind, setMediaKind] = useState('image');
  const [caption, setCaption] = useState('');
  const [disposition, setDisposition] = useState('New');
  const [sendError, setSendError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState(new Set());
  const [isTypingSelf, setIsTypingSelf] = useState(false);
  const typingTimeoutRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setDisposition('New');
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

  const handleQuickAction = async (action) => {
    if (action === 'proposal') {
      setShowProposalModal(true);
      return;
    }
    
    let url = '';
    let msg = '';
    if (action === 'brochure') {
      url = 'https://example.com/brochure.pdf';
      msg = 'Here is our latest brochure.';
    } else if (action === 'placement') {
      url = 'https://example.com/placement.pdf';
      msg = 'Check out our placement records.';
    }
    
    if (url) {
      await sendMedia(conversationId, 'document', url, msg);
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
                {/* Reply Context */}
                {m.rawPayload?.context && (
                  <div className="mb-2 text-xs bg-black/5 p-1.5 rounded border-l-2 border-slate-400 opacity-80">
                     <div className="font-semibold text-[10px] text-slate-600 flex items-center gap-1">
                       <MessageSquare size={10} /> 
                       Replying to a message
                     </div>
                  </div>
                )}
                {m.contentType === 'text' ? (
                  m.rawPayload?.type === 'template' ? (
                    <div className="space-y-3 min-w-[250px]">
                      {/* Template Body */}
                      <div className="text-sm">
                        {m.rawPayload.name === 'proposal_invoice' && m.rawPayload?.components?.find(c => c.type === 'body')?.parameters ? (
                           // Render constructed text from params if available
                           <div className="space-y-1">
                             <div className="font-semibold text-base mb-2">Proposal Invoice</div>
                             <p>Course: <b>{m.rawPayload.components[0].parameters[0]?.text}</b></p>
                             <p>Package: {m.rawPayload.components[0].parameters[1]?.text}</p>
                             <div className="h-px bg-white/20 my-2" />
                             <p className="text-lg font-bold">Total: {m.rawPayload.components[0].parameters[2]?.text}</p>
                           </div>
                        ) : (
                          <div className="space-y-2">
                             {/* Only show Template name if no parameters to show, or as a small label? 
                                 User requested "Delete the template", likely referring to the big header.
                                 We will hide the header but ensure we don't show an empty bubble.
                             */}
                             
                             {/* Render Header Parameters */}
                             {m.rawPayload?.components?.find(c => c.type === 'header')?.parameters?.map((p, i) => (
                               <div key={`h-${i}`} className="flex items-center gap-2 text-xs opacity-90 bg-black/5 p-1 rounded">
                                 <span className="font-bold">Header:</span> 
                                 {p.type === 'image' ? (
                                    <span className="flex items-center gap-1"><ImageIcon size={12}/> Image</span>
                                 ) : (
                                    <span>{p.text || p.type}</span>
                                 )}
                               </div>
                             ))}
                             {/* Render Body Parameters */}
                             {m.rawPayload?.components?.find(c => c.type === 'body')?.parameters?.length > 0 && (
                               <div className="text-xs opacity-90">
                                 <span className="font-bold block mb-1">Parameters:</span>
                                 <ul className="list-disc pl-4 space-y-0.5">
                                   {m.rawPayload.components.find(c => c.type === 'body').parameters.map((p, i) => (
                                     <li key={`b-${i}`}>{p.text || p.type}</li>
                                   ))}
                                 </ul>
                               </div>
                             )}

                             {/* Fallback: if no visual components, show the name so bubble isn't empty */}
                             {(!m.rawPayload?.components?.some(c => c.parameters?.length > 0)) && (
                                <div className="text-xs text-slate-500 italic">
                                  Template: {m.rawPayload?.name}
                                </div>
                             )}
                             
                             {m.rawPayload?.status && (
                                 <div className="text-[10px] text-slate-400">Status: {m.rawPayload.status}</div>
                             )}
                          </div>
                        )}
                      </div>
                      
                      {/* Template Buttons */}
                      <div className="pt-2">
                        <a 
                          href={`https://example.com/pay?amt=${m.rawPayload?.components?.find(c => c.type === 'button')?.parameters?.[0]?.text || ''}`}
                          target="_blank"
                          rel="noreferrer" 
                          className="flex items-center justify-center gap-2 w-full bg-white text-blue-600 font-semibold py-2 px-4 rounded-lg shadow-sm hover:bg-blue-50 transition-colors"
                        >
                          Click to Pay <DollarSign size={16} />
                        </a>
                      </div>
                   </div>
                  ) : (
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {m.textBody || 
                        (m.rawPayload?.type === 'interactive' && m.rawPayload.interactive?.button_reply?.title) ||
                        (m.rawPayload?.type === 'interactive' && m.rawPayload.interactive?.list_reply?.title) ||
                        (m.rawPayload?.type === 'button' && m.rawPayload.button?.text) ||
                        null}
                    </div>
                  )
                ) : (
                  <div className="space-y-2">
                    {m.attachments.map((a) => {
                      const isUrl = a.url && (a.url.startsWith('http') || a.url.startsWith('/'));
                      const src = isUrl ? a.url : `/api/media/${a.url}`;
                      const isImage = m.contentType === 'image' || a.kind === 'image';

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
                               <div className="mt-1 flex items-center gap-1 text-[10px] opacity-70">
                                 <ImageIcon size={12} /> Image
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
                    {m.textBody && <div className="text-xs opacity-90 pt-1">{m.textBody}</div>}
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
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-200">
           <select
             className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
             value={disposition}
             onChange={(e) => setDisposition(e.target.value)}
           >
             <option value="New">New Lead</option>
             <option value="Interested">Interested</option>
             <option value="Follow Up">Follow Up</option>
             <option value="Enrolled">Enrolled</option>
             <option value="Closed">Closed</option>
           </select>
           <div className="h-4 w-px bg-slate-200 mx-1" />
           <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 whitespace-nowrap" onClick={() => handleQuickAction('proposal')}>
             <FileText size={14} className="text-blue-600" />
             Send Proposal
           </Button>
           <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 whitespace-nowrap" onClick={() => handleQuickAction('brochure')}>
             <BookOpen size={14} className="text-orange-600" />
             Send Brochure
           </Button>
           <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 whitespace-nowrap" onClick={() => handleQuickAction('placement')}>
             <BarChart size={14} className="text-emerald-600" />
             Placement Report
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
                          setMediaLink(''); // Clear link if file selected
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
                    if(e.target.value) setSelectedFile(null); // Clear file if link entered
                  }}
                  disabled={!!selectedFile}
                />
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
    </div>
  );
}
