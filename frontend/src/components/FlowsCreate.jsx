import React, { useState } from 'react';
import { ArrowLeft, Smartphone } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';
import FlowBuilder from './FlowBuilder';
import { createWhatsappFlow } from '../api';

const CATEGORIES = [
  'SIGN_UP',
  'LEAD_GENERATION',
  'CONTACT_US',
  'CUSTOMER_SUPPORT',
  'SURVEY',
  'OTHER'
];

const TEMPLATES = [
  { id: 'default', label: 'Default', description: 'Start from scratch' },
  { id: 'purchase', label: 'Collect purchase interest', description: 'Get details about what customers want to buy' },
  { id: 'feedback', label: 'Get feedback', description: 'Ask customers for their opinion' },
  { id: 'survey', label: 'Send a survey', description: 'Conduct a simple survey' },
  { id: 'support', label: 'Customer support', description: 'Help customers resolve issues' },
];

export default function FlowsCreate({ onCancel, onSave }) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    categories: [],
    template: 'default'
  });

  const handleNext = () => {
    if (!formData.name) {
      alert('Please enter a form name');
      return;
    }
    setStep(2);
  };

  const handleSaveFlow = async (screens, status) => {
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        categories: formData.categories,
        status,
        flow_json: {
          version: '3.0',
          screens
        }
      };
      await createWhatsappFlow(payload);
      onSave();
    } catch (err) {
      console.error(err);
      alert('Failed to save flow: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 2) {
    return (
      <FlowBuilder 
        onBack={() => setStep(1)}
        flowData={formData}
        onSave={handleSaveFlow}
      />
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-8 py-4 flex justify-between items-center bg-white">
        <h2 className="text-lg font-semibold text-slate-900">Create WhatsApp Form</h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleNext}>
            Next
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left Form Area */}
        <div className="flex-1 p-8 overflow-y-auto border-r border-slate-200">
          <div className="max-w-2xl space-y-8">
            {/* Name Input */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-slate-700">Name</label>
                <span className="text-xs text-slate-400">{formData.name.length}/20</span>
              </div>
              <Input 
                placeholder="Enter Name" 
                maxLength={20}
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>

            {/* Categories */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Categories</label>
              <div className="relative">
                <select 
                  className="w-full h-10 px-3 py-2 bg-white border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
                  value={formData.categories[0] || ''}
                  onChange={(e) => setFormData({...formData, categories: [e.target.value]})}
                >
                  <option value="" disabled>Select Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.replace('_', ' ')}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  ▼
                </div>
              </div>
            </div>

            {/* Templates */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-slate-700">Templates</label>
              <div className="space-y-3">
                {TEMPLATES.map(tmpl => (
                  <label 
                    key={tmpl.id} 
                    className={`flex items-start gap-3 p-4 border rounded-lg cursor-pointer transition-all ${
                      formData.template === tmpl.id 
                        ? 'border-green-500 bg-green-50 ring-1 ring-green-500' 
                        : 'border-slate-200 hover:border-green-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="pt-0.5">
                      <input 
                        type="radio" 
                        name="template" 
                        className="w-4 h-4 text-green-600 border-slate-300 focus:ring-green-500"
                        checked={formData.template === tmpl.id}
                        onChange={() => setFormData({...formData, template: tmpl.id})}
                      />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-slate-900">{tmpl.label}</span>
                      {tmpl.description && (
                        <span className="block text-xs text-slate-500 mt-0.5">{tmpl.description}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Preview Area */}
        <div className="w-[400px] bg-slate-50 p-8 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-medium text-slate-700">Preview</h3>
            <select className="text-xs border-none bg-transparent font-medium text-slate-600 focus:ring-0 cursor-pointer">
              <option>Get help</option>
            </select>
          </div>

          <div className="flex-1 flex items-center justify-center">
             {/* Phone Mockup */}
             <div className="w-[300px] h-[600px] bg-white rounded-[2.5rem] border-8 border-slate-200 shadow-xl relative overflow-hidden flex flex-col">
               {/* Mock Header */}
               <div className="h-14 bg-white border-b border-slate-100 flex items-center px-4 pt-4">
                 <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                   <Smartphone className="w-4 h-4" />
                 </div>
                 <div className="ml-3 h-2 w-24 bg-slate-200 rounded-full"></div>
               </div>

               {/* Mock Chat Body */}
               <div className="flex-1 bg-[#efeae2] p-4 flex flex-col justify-center items-center relative">
                 {/* Chat Bubble */}
                 <div className="bg-white p-2 rounded-lg shadow-sm max-w-[80%] w-full mb-4">
                    <div className="h-2 w-16 bg-slate-200 rounded-full mb-2"></div>
                    <div className="h-10 bg-slate-100 rounded mb-2"></div>
                    <div className="h-8 bg-green-50 text-green-600 text-xs font-medium flex items-center justify-center rounded cursor-pointer">
                      Preview Flow
                    </div>
                 </div>
               </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
