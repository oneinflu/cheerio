import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, ArrowRight } from 'lucide-react';
import QRCode from 'react-qr-code';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

export default function GuestChat() {
  const [leadSourceUrl, setLeadSourceUrl] = useState('');
  const [message, setMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // You should configure this number or fetch it from an API
  const BUSINESS_PHONE_NUMBER = '919182151640'; // Placeholder - replace with your actual business number

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get('lead_source_url');
    if (url) {
      setLeadSourceUrl(decodeURIComponent(url));
    }
  }, []);

  const getWhatsAppUrl = () => {
    let text = `Hi, I'm interested in your services.`;
    if (leadSourceUrl) {
      text += `\n\nSource: ${leadSourceUrl}`;
    }
    if (message) {
      text += `\n\nMessage: ${message}`;
    }
    return `https://wa.me/${BUSINESS_PHONE_NUMBER}?text=${encodeURIComponent(text)}`;
  };

  const handleStartChat = () => {
    window.open(getWhatsAppUrl(), '_blank');
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      <div className="bg-[#008069] p-4 text-white shadow-md flex items-center gap-3">
        <div className="bg-white/20 p-2 rounded-full">
          <MessageSquare size={24} />
        </div>
        <div>
          <h1 className="font-bold text-lg">Chat with Us</h1>
          <p className="text-xs opacity-90">Scan to chat on WhatsApp</p>
        </div>
      </div>

      <div className="flex-1 p-6 flex flex-col items-center justify-center space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-slate-800">Scan to Chat</h2>
          <p className="text-slate-500 text-sm max-w-[280px]">
            Open WhatsApp on your phone and scan the QR code to start a conversation.
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
           <QRCode value={getWhatsAppUrl()} size={180} />
        </div>

        <div className="w-full max-w-xs space-y-4">
           {leadSourceUrl && (
             <div className="text-xs text-slate-400 bg-slate-100 p-2 rounded border border-slate-200 truncate text-center">
               Source: {leadSourceUrl}
             </div>
           )}
           
           <div className="space-y-2">
             <label className="text-xs font-medium text-slate-700">Your Message (Optional)</label>
             <Input 
               placeholder="How can we help you?" 
               value={message}
               onChange={(e) => setMessage(e.target.value)}
               className="bg-white"
             />
           </div>

           <div className="text-center">
             <p className="text-xs text-slate-400 mb-2">On mobile? Tap below</p>
             <Button 
               className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white font-semibold h-12 rounded-full shadow-lg transition-all hover:scale-105"
               onClick={handleStartChat}
             >
               <Send size={18} className="mr-2" />
               Start WhatsApp Chat
             </Button>
           </div>
        </div>
      </div>
      
      <div className="p-4 text-center text-[10px] text-slate-400">
        Powered by Meta Command Center
      </div>
    </div>
  );
}
