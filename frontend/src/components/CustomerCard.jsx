'use strict';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { User, Copy, Check } from 'lucide-react';
import { useToast } from './ui/use-toast';

export default function CustomerCard({ conversationId }) {
  const { toast } = useToast();
  const LANGUAGE_LABELS = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    ml: 'Malayalam',
    kn: 'Kannada',
    mr: 'Marathi',
    gu: 'Gujarati'
  };
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    contactId: '',
    name: '',
    number: '',
    course: '',
    preferredLanguage: '',
    blocked: false
  });

  useEffect(() => {
    if (!conversationId) return;
    setFetching(true);
    fetch(`/api/conversations/${conversationId}/contact`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch contact');
        return res.json();
      })
      .then(data => {
        setFormData({
          contactId: data.contactId || '',
          name: data.name || '',
          number: data.number || '',
          course: data.course || '',
          preferredLanguage: data.preferredLanguage || '',
          blocked: !!data.blocked
        });
      })
      .catch(err => console.error(err))
      .finally(() => setFetching(false));
  }, [conversationId]);

  const handleCopyNumber = () => {
    if (!formData.number) return;
    navigator.clipboard.writeText(formData.number);
    setCopied(true);
    toast({
      description: "Phone number copied to clipboard",
      duration: 2000,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const headers = { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
      };
      
      const res = await fetch(`/api/conversations/${conversationId}/contact`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          name: formData.name,
          course: formData.course
        })
      });
      if (!res.ok) throw new Error('Failed to update contact');
      // Optional: Show success feedback
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!conversationId) return null;

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="py-3 px-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
           <User className="w-4 h-4 text-slate-500" />
           <CardTitle className="text-sm font-semibold text-slate-900">Customer Information</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {fetching ? (
          <div className="text-xs text-slate-400 text-center py-4">Loading...</div>
        ) : (
          <>
            <div>
              <label className="text-xs font-medium text-slate-500">Full Name</label>
              <Input 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})}
                className="h-8 mt-1"
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Number</label>
              <div className="flex gap-2 mt-1">
                <Input 
                  value={formData.number} 
                  disabled
                  className="h-8 bg-slate-50 text-slate-500 flex-1"
                />
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="h-8 w-8" 
                  onClick={handleCopyNumber}
                  title="Copy number"
                >
                  {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
                </Button>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Preferred Language</label>
              <Input 
                value={LANGUAGE_LABELS[formData.preferredLanguage] || formData.preferredLanguage || ''}
                disabled
                className="h-8 bg-slate-50 mt-1 text-slate-500"
                placeholder="Auto-detected from chat"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Status</label>
              <Input 
                value={formData.blocked ? 'Blocked' : 'Active'}
                disabled
                className="h-8 bg-slate-50 mt-1 text-slate-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Course</label>
              <select 
                className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 mt-1"
                value={formData.course}
                onChange={e => setFormData({...formData, course: e.target.value})}
              >
                <option value="">Select Course</option>
                <option value="CPA">CPA</option>
                <option value="CMA USA">CMA USA</option>
                <option value="ACCA">ACCA</option>
                <option value="EA">EA</option>
                <option value="CFA">CFA</option>
                <option value="FRM">FRM</option>
                <option value="F&A">F&A</option>
              </select>
            </div>
            <Button size="sm" className="w-full mt-2" onClick={handleSubmit} disabled={loading}>
              {loading ? 'Saving...' : 'Submit'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
