'use strict';
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/Card';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { User } from 'lucide-react';

export default function CustomerCard({ conversationId }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    number: '',
    course: '',
    preferredLanguage: ''
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
          name: data.name || '',
          number: data.number || '',
          course: data.course || '',
          preferredLanguage: data.preferredLanguage || ''
        });
      })
      .catch(err => console.error(err))
      .finally(() => setFetching(false));
  }, [conversationId]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/${conversationId}/contact`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
              <Input 
                value={formData.number} 
                disabled
                className="h-8 bg-slate-50 mt-1 text-slate-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500">Preferred Language</label>
              <Input 
                value={formData.preferredLanguage || ''}
                disabled
                className="h-8 bg-slate-50 mt-1 text-slate-500"
                placeholder="Auto-detected from chat"
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
               
                <option value="CPA US">CPA US</option>
             
                <option value="CMA US">CMA US</option>
                <option value="ACCA">ACCA</option>
                <option value="EA">EA</option>
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
