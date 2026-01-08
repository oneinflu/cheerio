'use strict';
import React, { useEffect, useState, useRef } from 'react';
import { sendText, sendMedia, sendTemplate } from '../api';
import { cn } from '../lib/utils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { ProposalModal } from './ProposalModal';
import { Send, Paperclip, Image as ImageIcon, File, Mic, FileText, BookOpen, BarChart, DollarSign } from 'lucide-react';

export default function Chat({ socket, conversationId, messages, onRefresh }) {
  const [text, setText] = useState('');
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [mediaLink, setMediaLink] = useState('');
  const [mediaKind, setMediaKind] = useState('image');
  const [caption, setCaption] = useState('');
  const [disposition, setDisposition] = useState('New');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setDisposition('New');
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return;
    socket.emit('join:conversation', conversationId);
    const onNew = (evt) => {
      if (evt.conversationId === conversationId) onRefresh();
    };
    const onStatus = (evt) => {
      if (evt.conversationId === conversationId) onRefresh();
    };
    socket.on('message:new', onNew);
    socket.on('message:status', onStatus);
    return () => {
      socket.off('message:new', onNew);
      socket.off('message:status', onStatus);
    };
  }, [socket, conversationId, onRefresh]);

  const handleSendText = async () => {
    if (!text.trim()) return;
    await sendText(conversationId, text.trim());
    setText('');
  };

  const handleSendMedia = async () => {
    if (!mediaLink.trim()) return;
    await sendMedia(conversationId, mediaKind, mediaLink.trim(), caption || null);
    setMediaLink('');
    setCaption('');
    setShowMediaInput(false);
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
    await sendTemplate(conversationId, 'proposal_invoice', 'en_US', components);
    setShowProposalModal(false);
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
           <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
             <Send className="h-6 w-6 text-slate-400" />
           </div>
           <p>Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const isOutbound = m.direction === 'outbound';
          return (
            <div key={m.id} className={cn("flex w-full", isOutbound ? "justify-end" : "justify-start")}>
              <div className={cn(
                  "max-w-[70%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                  isOutbound
                    ? "bg-blue-600 text-white rounded-tr-sm"
                    : "bg-white text-slate-900 border border-slate-100 rounded-tl-sm"
                )}>
                {m.contentType === 'text' ? (
                  m.rawPayload?.type === 'template' ? (
                    <div className="space-y-3 min-w-[250px]">
                      {/* Template Body */}
                      <div className="text-sm">
                        {m.rawPayload?.components?.find(c => c.type === 'body')?.parameters ? (
                           // Render constructed text from params if available
                           <div className="space-y-1">
                             <div className="font-semibold text-base mb-2">Proposal Invoice</div>
                             <p>Course: <b>{m.rawPayload.components[0].parameters[0].text}</b></p>
                             <p>Package: {m.rawPayload.components[0].parameters[1].text}</p>
                             <div className="h-px bg-white/20 my-2" />
                             <p className="text-lg font-bold">Total: {m.rawPayload.components[0].parameters[2].text}</p>
                           </div>
                        ) : (
                          <div className="italic opacity-80">{m.textBody || 'Template Message'}</div>
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
                    <div className="whitespace-pre-wrap leading-relaxed">{m.textBody}</div>
                  )
                ) : (
                  <div className="space-y-2">
                    {m.attachments.map((a) => (
                      <div key={a.id} className="rounded bg-black/10 p-2 flex items-center gap-2">
                         {m.contentType === 'image' ? <ImageIcon size={16} /> : <File size={16} />}
                         <a href={a.url} target="_blank" rel="noreferrer" className="underline text-xs truncate max-w-[150px]">
                           View Attachment
                         </a>
                      </div>
                    ))}
                    {m.textBody && <div className="text-xs opacity-90 pt-1">{m.textBody}</div>}
                  </div>
                )}
                <div className={cn("text-[10px] mt-1 text-right opacity-70", isOutbound ? "text-blue-100" : "text-slate-400")}>
                   {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-white border-t border-slate-200">
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
             <Input
               placeholder="Media URL (e.g., https://example.com/image.png)"
               value={mediaLink}
               onChange={(e) => setMediaLink(e.target.value)}
             />
             <Input
               placeholder="Caption (optional)"
               value={caption}
               onChange={(e) => setCaption(e.target.value)}
             />
             <div className="flex justify-end gap-2">
               <Button variant="ghost" size="sm" onClick={() => setShowMediaInput(false)}>Cancel</Button>
               <Button size="sm" onClick={handleSendMedia}>Send Media</Button>
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
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyPress}
            />
          </div>
          <Button
             className="h-11 w-11 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
             onClick={handleSendText}
             disabled={!text.trim()}
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
