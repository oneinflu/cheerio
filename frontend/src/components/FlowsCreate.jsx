import React, { useState, useEffect } from 'react';
import { Smartphone, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
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

const TEMPLATE_FLOWS = {
  default: {
    screens: [
      {
        id: 'screen_1',
        title: 'This is a sample form',
        layout: [
          { type: 'Text', text: 'This is a sample lead-gen form!', className: 'font-bold text-lg mb-4 text-slate-900' },
          { type: 'Input', label: 'Your Name', placeholder: 'Enter your name' },
          { type: 'Input', label: 'Appointment Time', placeholder: 'Select time' },
          { type: 'Text', text: 'Select any time between 9 am to 6 pm.', className: 'text-xs text-slate-500 mb-4' },
          { type: 'Label', text: 'Interested Services', className: 'font-medium mb-2 text-slate-900' },
          { type: 'Checkbox', label: 'Service 1' },
          { type: 'Checkbox', label: 'Service 2' },
          { type: 'Checkbox', label: 'Service 3' },
          { type: 'Checkbox', label: 'Send reminders for appointment?', className: 'mt-4' },
        ],
        button: 'Continue'
      }
    ]
  },
  purchase: {
    screens: [
      {
        id: 'screen_1',
        title: 'Join Now',
        layout: [
          { type: 'Text', text: 'Get early access to our Mega Sales Day deals. Register now!', className: 'font-bold text-lg mb-4 text-slate-900' },
          { type: 'Input', label: 'Name' },
          { type: 'Input', label: 'Email' },
          { type: 'Checkbox', label: 'I agree to the terms. Read more', className: 'mt-2' },
          { type: 'Checkbox', label: '(optional) Keep me up to date about offers and promotions' },
        ],
        button: 'Continue'
      }
    ]
  },
  survey: {
    screens: [
      {
        id: 'screen_1',
        title: 'Question 1 of 3',
        layout: [
          { type: 'Text', text: "You've found the perfect deal, what do you do next?", className: 'font-bold text-lg mb-4 text-slate-900' },
          { type: 'Label', text: 'Choose all that apply:', className: 'text-sm text-slate-600 mb-2' },
          { type: 'Checkbox', label: 'Buy it right away' },
          { type: 'Checkbox', label: 'Check reviews before buying' },
          { type: 'Checkbox', label: 'Share it with friends + family' },
          { type: 'Checkbox', label: 'Buy multiple, while its cheap' },
          { type: 'Checkbox', label: 'None of the above' },
        ],
        button: 'Continue'
      },
      {
        id: 'screen_2',
        title: 'Question 2 of 3',
        layout: [
            { type: 'Text', text: "How often do you shop online?", className: 'font-bold text-lg mb-4 text-slate-900' },
            { type: 'Radio', label: 'Weekly' },
            { type: 'Radio', label: 'Monthly' },
            { type: 'Radio', label: 'Rarely' },
        ],
        button: 'Continue'
      },
      {
         id: 'screen_3',
         title: 'Question 3 of 3',
         layout: [
             { type: 'Text', text: "Thank you for your time!", className: 'font-bold text-lg mb-4 text-slate-900' },
             { type: 'Text', text: "We appreciate your feedback.", className: 'text-sm text-slate-600' }
         ],
         button: 'Submit'
      }
    ]
  },
  support: {
      screens: [
          {
              id: 'screen_1',
              title: 'Get help',
              layout: [
                  { type: 'Input', placeholder: 'Name', className: 'mb-4' },
                  { type: 'Input', placeholder: 'Order number', className: 'mb-4' },
                  { type: 'Label', text: 'Choose a topic', className: 'font-medium text-slate-900 mb-3' },
                  { type: 'Radio', label: 'Orders and payments' },
                  { type: 'Radio', label: 'Maintenance' },
                  { type: 'Radio', label: 'Delivery' },
                  { type: 'Radio', label: 'Returns' },
                  { type: 'Radio', label: 'Other' },
                  { type: 'Input', placeholder: 'Description of issue (Optional)', multiline: true, rows: 4, className: 'mt-6' }
              ],
              button: 'Done'
          }
      ]
  },
  feedback: {
      screens: [
          {
              id: 'screen_1',
              title: 'Feedback 1 of 2',
              layout: [
                  { type: 'Text', text: 'Would you recommend us to a friend?', className: 'font-bold text-lg mb-4 text-slate-900' },
                  { type: 'Label', text: 'Choose one', className: 'text-sm text-slate-600 mb-2' },
                  { type: 'Radio', label: 'Yes' },
                  { type: 'Radio', label: 'No' },
                  { type: 'Label', text: 'How could we do better?', className: 'font-bold mt-6 mb-2 text-slate-900' },
                  { type: 'Input', placeholder: 'Leave a comment (Optional)', multiline: true, rows: 4 }
              ],
              button: 'Continue'
          },
           {
              id: 'screen_2',
              title: 'Feedback 2 of 2',
              layout: [
                  { type: 'Text', text: 'Thank you for your feedback!', className: 'font-bold text-lg mb-4 text-slate-900' }
              ],
              button: 'Submit'
          }
      ]
  }
};

export default function FlowsCreate({ onCancel, onSave }) {
  const [step, setStep] = useState(() => {
    const saved = localStorage.getItem('whatsapp_flows_create_step');
    return saved ? parseInt(saved, 10) : 1;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentScreenIndex, setCurrentScreenIndex] = useState(0);
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem('whatsapp_flows_create_data');
    return saved ? JSON.parse(saved) : {
      name: '',
      categories: [],
      template: 'default'
    };
  });

  useEffect(() => {
    localStorage.setItem('whatsapp_flows_create_step', step);
  }, [step]);

  useEffect(() => {
    localStorage.setItem('whatsapp_flows_create_data', JSON.stringify(formData));
  }, [formData]);

  const clearStorage = () => {
    localStorage.removeItem('whatsapp_flows_create_step');
    localStorage.removeItem('whatsapp_flows_create_data');
    localStorage.removeItem('whatsapp_flow_builder_screens');
    localStorage.removeItem('whatsapp_flow_builder_active_screen');
  };

  const handleCancel = () => {
    clearStorage();
    onCancel();
  };

  // Reset preview state when template changes
  useEffect(() => {
    setIsPreviewOpen(false);
    setCurrentScreenIndex(0);
  }, [formData.template]);

  const handleNext = () => {
    if (!formData.name) {
      alert('Please enter a form name');
      return;
    }
    // Clear builder storage to ensure fresh start
    localStorage.removeItem('whatsapp_flow_builder_screens');
    localStorage.removeItem('whatsapp_flow_builder_active_screen');
    setStep(2);
  };

  const mapToMetaComponent = (component) => {
    // Generate a clean name for the form field
    const fieldName = component.id 
      ? component.id.replace(/[^a-zA-Z0-9_]/g, '_') 
      : `field_${Math.random().toString(36).substr(2, 9)}`;

    const base = {
      visible: true,
      name: fieldName,
    };

    switch (component.type) {
      case 'Text':
        // Map variants/classes to Meta styles
        let fontSize = 'body';
        let fontWeight = 'normal';
        
        if (component.variant === 'largeHeading' || (component.className && component.className.includes('text-lg'))) {
          fontSize = 'headline';
          fontWeight = 'bold';
        } else if (component.className && component.className.includes('font-bold')) {
          fontWeight = 'bold';
        } else if (component.className && component.className.includes('text-xs')) {
          fontSize = 'caption';
        }

        return {
          type: 'Text',
          text: component.text || '',
          'font-size': fontSize,
          'font-weight': fontWeight,
          visible: true
        };

      case 'Input':
      case 'TextArea':
        return {
          type: 'TextInput',
          ...base,
          label: component.label || 'Input',
          required: component.required || false,
          'input-type': component.inputType || 'text', // text, number, email, phone, etc.
          multiline: component.type === 'TextArea' || component.multiline || false,
          'helper-text': component.placeholder || ''
        };

      case 'Checkbox':
        // Handle both single boolean checkbox and multiple choice group
        if (component.options && component.options.length > 0) {
           return {
             type: 'CheckboxGroup',
             ...base,
             label: component.label || 'Select options',
             required: component.required || false,
             'data-source': component.options.map(opt => ({
               id: opt.replace(/\s+/g, '_').toLowerCase(),
               title: opt
             }))
           };
        } else {
           // Single checkbox (e.g. Terms) - mapped to CheckboxGroup with 1 option
           return {
             type: 'CheckboxGroup',
             ...base,
             label: component.label || '', // The label often sits above
             required: component.required || false,
             'data-source': [
               {
                 id: 'checked',
                 title: component.text || component.label || 'Yes'
               }
             ]
           };
        }

      case 'Radio':
        return {
          type: 'RadioButtonsGroup',
          ...base,
          label: component.label || 'Select one',
          required: component.required || false,
          'data-source': (component.options || []).map(opt => ({
            id: opt.replace(/\s+/g, '_').toLowerCase(),
            title: opt
          }))
        };

      case 'Dropdown':
        return {
          type: 'Dropdown',
          ...base,
          label: component.label || 'Select',
          required: component.required || false,
          'data-source': (component.options || []).map(opt => ({
             id: opt.replace(/\s+/g, '_').toLowerCase(),
             title: opt
          }))
        };

      case 'Date':
        return {
          type: 'DatePicker',
          ...base,
          label: component.label || 'Select date',
          required: component.required || false
        };
        
      case 'Label':
         return {
            type: 'Text',
            text: component.text || '',
            'font-size': 'body',
            'font-weight': 'bold',
            visible: true
         };

      default:
        return null;
    }
  };

  const transformToMetaFlow = (screens) => {
    const transformedScreens = screens.map((screen, index) => {
      const isLastScreen = index === screens.length - 1;
      const nextScreen = isLastScreen ? null : screens[index + 1];
      
      // Filter and map components
      const formChildren = (screen.content || [])
        .map(mapToMetaComponent)
        .filter(Boolean);

      // Add Footer inside the Form
      formChildren.push({
        type: 'Footer',
        label: screen.button || (isLastScreen ? 'Submit' : 'Continue'),
        'on-click-action': isLastScreen
          ? {
              name: 'complete',
              payload: '${form}' // Collects all form values
            }
          : {
              name: 'navigate',
              next: {
                type: 'screen',
                name: nextScreen ? nextScreen.id : ''
              }
            }
      });

      return {
        id: screen.id,
        title: screen.title || 'Untitled Screen',
        terminal: isLastScreen,
        data: {},
        layout: {
          type: 'SingleColumnLayout',
          children: [
            {
              type: 'Form',
              name: 'form',
              children: formChildren
            }
          ]
        }
      };
    });

    return {
      version: '5.0',
      screens: transformedScreens
    };
  };

  const handleSaveFlow = async (screens, status) => {
    setIsSaving(true);
    try {
      const flowJson = transformToMetaFlow(screens);
      
      const payload = {
        name: formData.name,
        categories: formData.categories,
        status,
        flow_json: flowJson
      };
      await createWhatsappFlow(payload);
      clearStorage();
      onSave();
    } catch (err) {
      console.error(err);
      alert('Failed to save flow: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  if (step === 2) {
    const selectedTemplate = TEMPLATE_FLOWS[formData.template] || TEMPLATE_FLOWS.default;
    const initialScreens = selectedTemplate.screens.map(s => ({
        ...s,
        content: s.layout.map((c, i) => ({ ...c, id: `c_${i}_${Date.now()}` }))
    }));

    return (
      <FlowBuilder 
        onBack={() => setStep(1)}
        flowData={formData}
        initialScreens={initialScreens}
        onSave={handleSaveFlow}
      />
    );
  }

  const currentFlow = TEMPLATE_FLOWS[formData.template] || TEMPLATE_FLOWS.default;
  const currentScreen = currentFlow.screens[currentScreenIndex];
  const totalScreens = currentFlow.screens.length;

  const handlePreviewAction = () => {
    if (currentScreenIndex < totalScreens - 1) {
      setCurrentScreenIndex(currentScreenIndex + 1);
    } else {
      setIsPreviewOpen(false);
      setTimeout(() => setCurrentScreenIndex(0), 300); // Reset after closing animation
    }
  };

  const renderComponent = (cmp, idx) => {
    switch (cmp.type) {
      case 'Text':
        return <div key={idx} className={cmp.className}>{cmp.text}</div>;
      case 'Input':
        return (
          <div key={idx} className={`space-y-1 mb-3 ${cmp.className || ''}`}>
            {cmp.label && <div className="text-sm text-slate-600 font-medium">{cmp.label}</div>}
            {cmp.multiline ? (
               <textarea 
                 className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none resize-none"
                 rows={cmp.rows || 3}
                 placeholder={cmp.placeholder}
               />
            ) : (
              <input 
                type="text"
                className="w-full h-10 px-3 border border-slate-300 rounded-md bg-white text-slate-900 text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                placeholder={cmp.placeholder || ''}
              />
            )}
          </div>
        );
      case 'Checkbox':
        return (
          <label key={idx} className={`flex items-start gap-3 mb-2 cursor-pointer ${cmp.className || ''}`}>
            <input type="checkbox" className="w-5 h-5 border-slate-300 rounded text-green-600 focus:ring-green-500 mt-0.5" />
            <span className="text-sm text-slate-700">{cmp.label}</span>
          </label>
        );
      case 'Radio':
        return (
          <label key={idx} className={`flex items-center justify-between mb-4 cursor-pointer ${cmp.className || ''}`}>
            <span className="text-sm text-slate-700">{cmp.label}</span>
            <input 
              type="radio" 
              name={`screen_${currentScreenIndex}`} 
              className="w-5 h-5 border-slate-300 text-green-600 focus:ring-green-500" 
            />
          </label>
        );
      case 'Label':
        return <div key={idx} className={cmp.className}>{cmp.text}</div>;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="border-b border-slate-200 px-8 py-4 flex justify-between items-center bg-white">
        <h2 className="text-lg font-semibold text-slate-900">Create WhatsApp Form</h2>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleCancel}>
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
        <div className="w-[450px] bg-slate-50 p-8 flex flex-col items-center justify-center">
          <div className="mb-4 text-sm font-medium text-slate-500">Preview</div>
          
          {/* Phone Mockup */}
          <div className="w-[320px] h-[640px] bg-white rounded-[3rem] border-8 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
            {/* Status Bar */}
            <div className="h-6 bg-slate-800 w-full absolute top-0 z-10 flex justify-center">
                <div className="h-4 w-32 bg-black rounded-b-xl"></div>
            </div>

            {/* App Header (WhatsApp Style) */}
            <div className="mt-6 bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 shadow-md z-0">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1">
                    <div className="text-sm font-semibold">Business Name</div>
                    <div className="text-[10px] opacity-80">Official Business Account</div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 bg-[#EFEAE2] p-4 relative overflow-hidden">
                {/* Chat Background Pattern (CSS Pattern could go here, keeping simple for now) */}
                
                {/* Business Message Bubble */}
                <div className="bg-white rounded-lg p-2 shadow-sm max-w-[85%] mb-4 relative">
                    <div className="h-2 w-32 bg-slate-100 rounded mb-2"></div>
                    <div className="h-2 w-24 bg-slate-100 rounded mb-3"></div>
                    
                    {/* CTA Button */}
                    <button 
                        onClick={() => setIsPreviewOpen(true)}
                        className="w-full py-2 px-4 flex items-center justify-center gap-2 text-blue-500 font-medium text-sm border-t border-slate-100 mt-1 hover:bg-slate-50 transition-colors"
                    >
                        <Smartphone className="w-4 h-4" />
                        Preview Flow
                    </button>
                    
                    {/* Time */}
                    <div className="text-[9px] text-slate-400 text-right mt-1">10:30 AM</div>
                </div>

                {/* Flow Modal Overlay */}
                {isPreviewOpen && (
                    <div className="absolute inset-0 bg-black/30 z-20 flex items-end animate-in fade-in duration-200">
                        <div className="w-full bg-white rounded-t-2xl h-[90%] flex flex-col shadow-2xl animate-in slide-in-from-bottom duration-300">
                            {/* Modal Header */}
                            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                                <button onClick={() => setIsPreviewOpen(false)} className="text-slate-500 hover:text-slate-800">
                                    <X className="w-5 h-5" />
                                </button>
                                <div className="font-semibold text-slate-800 text-sm">{currentScreen.title}</div>
                                <div className="w-5"></div> {/* Spacer for alignment */}
                            </div>

                            {/* Progress Bar */}
                            <div className="flex gap-1 px-4 py-2">
                                {Array.from({ length: totalScreens }).map((_, idx) => (
                                    <div 
                                        key={idx}
                                        className={`h-1 flex-1 rounded-full ${
                                            idx <= currentScreenIndex ? 'bg-green-600' : 'bg-slate-200'
                                        }`}
                                    />
                                ))}
                            </div>

                            {/* Screen Content */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                {currentScreen.layout.map((cmp, idx) => renderComponent(cmp, idx))}
                            </div>

                            {/* Footer Button */}
                            <div className="p-4 border-t border-slate-100">
                                <button 
                                    onClick={handlePreviewAction}
                                    className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-medium rounded-full text-sm transition-colors shadow-sm"
                                >
                                    {currentScreen.button}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
