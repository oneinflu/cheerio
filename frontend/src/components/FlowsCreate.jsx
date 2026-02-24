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

const TEMPLATE_PREVIEWS = {
  default: {
    title: 'This is a sample form',
    type: 'default',
  },
  purchase: {
    title: 'Join Now',
    type: 'purchase',
  },
  feedback: {
    title: 'This is a sample form',
    type: 'feedback',
  },
  survey: {
    title: 'Question 1 of 3',
    type: 'survey',
  },
  support: {
    title: 'Get help',
    type: 'support',
  },
};

export default function FlowsCreate({ onCancel, onSave }) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
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

  const previewMeta = TEMPLATE_PREVIEWS[formData.template] || TEMPLATE_PREVIEWS.default;

  const renderPreviewContent = () => {
    const type = previewMeta.type;
    if (type === 'purchase') {
      return (
        <div className="p-3 text-[11px] text-slate-900 space-y-3">
          <div className="text-[12px] font-semibold leading-snug">
            Get early access to our Mega Sales Day deals. Register now!
          </div>
          <div className="space-y-2 mt-2">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-600">Name</div>
              <div className="h-7 rounded border border-slate-200 bg-slate-50" />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-slate-600">Email</div>
              <div className="h-7 rounded border border-slate-200 bg-slate-50" />
            </div>
          </div>
          <div className="space-y-1 mt-1">
            <label className="flex items-start gap-2 text-[10px] text-slate-700">
              <input type="checkbox" className="mt-0.5 w-3 h-3 border-slate-300" />
              <span>
                I agree to the terms. <span className="text-green-700">Read now</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-[10px] text-slate-700">
              <input type="checkbox" className="mt-0.5 w-3 h-3 border-slate-300" />
              <span>[Optional] Keep me up to date about offers and promotions</span>
            </label>
          </div>
          <button className="w-full mt-3 h-7 rounded-full bg-green-600 text-white text-[11px] font-medium">
            Continue
          </button>
        </div>
      );
    }
    if (type === 'survey') {
      return (
        <div className="p-3 text-[11px] text-slate-900 space-y-3">
          <div className="text-[10px] text-slate-500">Question 1 of 3</div>
          <div className="text-[12px] font-semibold leading-snug">
            You’ve found the perfect deal, what do you do next?
          </div>
          <div className="text-[10px] text-slate-600 mt-1">Choose all that apply:</div>
          <div className="mt-2 space-y-1">
            {[
              'Buy it right away',
              'Check reviews before buying',
              'Share it with friends + family',
              'Buy multiple, while it’s cheap',
              'None of the above',
            ].map(option => (
              <label key={option} className="flex items-center gap-2 text-[10px] text-slate-800">
                <input type="checkbox" className="w-3 h-3 border-slate-300" />
                <span>{option}</span>
              </label>
            ))}
          </div>
          <button className="w-full mt-3 h-7 rounded-full bg-green-600 text-white text-[11px] font-medium">
            Continue
          </button>
        </div>
      );
    }
    if (type === 'support') {
      return (
        <div className="p-3 text-[11px] text-slate-900 space-y-3">
          <div className="text-[12px] font-semibold leading-snug mb-1">Get help</div>
          <div className="space-y-2">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-600">Name</div>
              <div className="h-7 rounded border border-slate-200 bg-slate-50" />
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-slate-600">Order number</div>
              <div className="h-7 rounded border border-slate-200 bg-slate-50" />
            </div>
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-slate-600 mb-1">Choose a topic</div>
            {['Orders and payments', 'Maintenance', 'Delivery', 'Returns', 'Other'].map(topic => (
              <label key={topic} className="flex items-center justify-between text-[10px] text-slate-800">
                <span>{topic}</span>
                <span className="w-2 h-2 rounded-full border border-slate-300" />
              </label>
            ))}
          </div>
          <div className="mt-2 space-y-1">
            <div className="text-[10px] text-slate-600">Description of issue (Optional)</div>
            <div className="h-14 rounded border border-slate-200 bg-slate-50" />
          </div>
          <button className="w-full mt-3 h-7 rounded-full bg-green-600 text-white text-[11px] font-medium">
            Done
          </button>
        </div>
      );
    }
    return (
      <div className="p-3 text-[11px] text-slate-900 space-y-3">
        <div className="text-[12px] font-semibold leading-snug">
          This is a sample lead-gen form!
        </div>
        <div className="space-y-2 mt-2">
          <div className="space-y-1">
            <div className="text-[10px] text-slate-600">Your Name</div>
            <div className="h-7 rounded border border-slate-200 bg-slate-50" />
          </div>
          <div className="space-y-1">
            <div className="text-[10px] text-slate-600">Appointment Time</div>
            <div className="h-7 rounded border border-slate-200 bg-slate-50" />
          </div>
        </div>
        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-slate-600">Interested Services</div>
          {['Service 1', 'Service 2', 'Service 3'].map(service => (
            <label key={service} className="flex items-center gap-2 text-[10px] text-slate-800">
              <input type="checkbox" className="w-3 h-3 border-slate-300" />
              <span>{service}</span>
            </label>
          ))}
        </div>
        <label className="mt-1 flex items-center gap-2 text-[10px] text-slate-800">
          <input type="checkbox" className="w-3 h-3 border-slate-300" />
          <span>Send reminders for appointment?</span>
        </label>
        <button className="w-full mt-3 h-7 rounded-full bg-green-600 text-white text-[11px] font-medium">
          Continue
        </button>
      </div>
    );
  };

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
            <select
              className="text-xs border-none bg-transparent font-medium text-slate-600 focus:ring-0 cursor-pointer"
              defaultValue={previewMeta.title}
            >
              <option>{previewMeta.title}</option>
            </select>
          </div>

          <div className="flex-1 flex items-center justify-center">
            <div className="w-[300px] h-[600px] bg-white rounded-[2.5rem] border-8 border-slate-200 shadow-xl relative overflow-hidden flex flex-col">
              <div className="h-14 bg-white border-b border-slate-100 flex items-center px-4 pt-4">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div className="ml-3 h-2 w-24 bg-slate-200 rounded-full" />
              </div>
              <div className="flex-1 bg-[#efeae2] p-4 flex flex-col justify-center items-center relative">
                <div className="bg-white rounded-lg shadow-sm max-w-[80%] w-full mb-4">
                  {isPreviewOpen ? (
                    renderPreviewContent()
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsPreviewOpen(true)}
                      className="w-full px-3 py-2 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-md"
                    >
                      Open preview
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
