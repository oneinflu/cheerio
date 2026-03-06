import React from 'react';
import { Mail } from 'lucide-react';
import { Button } from './ui/Button';

export default function EmailTemplatesPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
        <div>
          <h1 className="font-semibold text-xl text-slate-800">Email Templates</h1>
          <p className="text-sm text-slate-500">Coming soon</p>
        </div>
        <Button variant="outline" className="flex items-center gap-2" disabled>
          <Mail size={16} />
          Create Template
        </Button>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white border border-slate-200 rounded-lg p-6 text-sm text-slate-600">
            This page will manage ZeptoMail email templates.
          </div>
        </div>
      </div>
    </div>
  );
}
