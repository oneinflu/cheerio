'use strict';
import React, { useState } from 'react';
import { sendTemplate } from '../api';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Zap, Send } from 'lucide-react';

export default function TemplatePanel({ conversationId }) {
  const [name, setName] = useState('');
  const [languageCode, setLanguageCode] = useState('en_US');
  const [variables, setVariables] = useState('');

  const handleSend = async () => {
    const comps = variables
      ? [
          {
            type: 'body',
            parameters: variables.split(',').map((v) => ({ type: 'text', text: v.trim() })),
          },
        ]
      : [];
    await sendTemplate(conversationId, name.trim(), languageCode, comps);
    setName('');
    setVariables('');
  };

  if (!conversationId) return null;

  return (
    <Card className="h-full flex flex-col shadow-sm border-slate-200 mt-4">
      <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
           <Zap className="w-4 h-4 text-slate-500" />
           <CardTitle className="text-sm font-semibold text-slate-900">Quick Templates</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
             <label className="text-xs font-medium text-slate-500">Template Name</label>
             <Input
               placeholder="e.g. hello_world"
               value={name}
               onChange={(e) => setName(e.target.value)}
             />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-medium text-slate-500">Language</label>
             <select
               className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2"
               value={languageCode}
               onChange={(e) => setLanguageCode(e.target.value)}
             >
               <option value="en_US">English (US)</option>
               <option value="en_GB">English (UK)</option>
               <option value="es_ES">Spanish (ES)</option>
             </select>
          </div>
          <div className="space-y-1">
             <label className="text-xs font-medium text-slate-500">Variables (comma-separated)</label>
             <Input
               placeholder="John, today"
               value={variables}
               onChange={(e) => setVariables(e.target.value)}
             />
          </div>
        </div>
        
        <Button 
          className="w-full bg-slate-900 hover:bg-slate-800" 
          onClick={handleSend}
          disabled={!name.trim()}
        >
          <Send className="w-4 h-4 mr-2" /> Send Template
        </Button>

        <div className="pt-2 border-t border-slate-100">
           <p className="text-[10px] text-slate-400 mb-2 font-medium">RECENTLY USED</p>
           <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200" onClick={() => setName('hello_world')}>hello_world</Badge>
              <Badge variant="secondary" className="cursor-pointer hover:bg-slate-200" onClick={() => setName('shipping_update')}>shipping_update</Badge>
           </div>
        </div>
      </CardContent>
    </Card>
  );
}
