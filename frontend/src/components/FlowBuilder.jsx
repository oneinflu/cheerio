import React, { useState, useRef, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  GripVertical, 
  Trash2, 
  ChevronRight,
  Type,
  Image as ImageIcon,
  MessageCircle,
  CheckSquare,
  Calendar
} from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';

const COMPONENT_GROUPS = [
  {
    key: 'text',
    label: 'Text',
    icon: Type,
    items: [
      { key: 'largeHeading', type: 'Text', variant: 'largeHeading', label: 'Large Heading' },
      { key: 'smallHeading', type: 'Text', variant: 'smallHeading', label: 'Small Heading' },
      { key: 'caption', type: 'Text', variant: 'caption', label: 'Caption' },
      { key: 'body', type: 'Text', variant: 'body', label: 'Body' }
    ]
  },
  {
    key: 'media',
    label: 'Media',
    icon: ImageIcon,
    items: [
      { key: 'image', type: 'Image', variant: 'image', label: 'Image' }
    ]
  },
  {
    key: 'textAnswer',
    label: 'Text Answer',
    icon: MessageCircle,
    items: [
      { key: 'shortAnswer', type: 'Input', variant: 'shortAnswer', label: 'Short Answer' },
      { key: 'paragraph', type: 'TextArea', variant: 'paragraph', label: 'Paragraph' },
      { key: 'datePicker', type: 'Date', variant: 'datePicker', label: 'Date picker' }
    ]
  },
  {
    key: 'selection',
    label: 'Selection',
    icon: CheckSquare,
    items: [
      { key: 'singleChoice', type: 'Radio', variant: 'singleChoice', label: 'Single Choice' },
      { key: 'multipleChoice', type: 'Checkbox', variant: 'multipleChoice', label: 'Multiple Choice' },
      { key: 'dropdown', type: 'Dropdown', variant: 'dropdown', label: 'Dropdown' },
      { key: 'optIn', type: 'Checkbox', variant: 'optIn', label: 'Opt-in' }
    ]
  }
];

export default function FlowBuilder({ onBack, flowData, onSave, initialScreens }) {
  const [screens, setScreens] = useState(() => {
    const saved = localStorage.getItem('whatsapp_flow_builder_screens');
    return saved ? JSON.parse(saved) : (initialScreens || [
      { 
        id: 'screen_1', 
        title: 'Get help', 
        content: [
          { id: 'c1', type: 'Text', text: 'Please provide details below.', className: 'mb-4' },
          { id: 'c2', type: 'Input', label: 'Phone Number', placeholder: 'Enter phone number', required: true, maxLength: 20 },
        ] 
      }
    ]);
  });
  
  const [activeScreenId, setActiveScreenId] = useState(() => {
    return localStorage.getItem('whatsapp_flow_builder_active_screen') || (screens[0]?.id || 'screen_1');
  });

  useEffect(() => {
    localStorage.setItem('whatsapp_flow_builder_screens', JSON.stringify(screens));
  }, [screens]);

  useEffect(() => {
    localStorage.setItem('whatsapp_flow_builder_active_screen', activeScreenId);
  }, [activeScreenId]);

  const handleBack = () => {
    localStorage.removeItem('whatsapp_flow_builder_screens');
    localStorage.removeItem('whatsapp_flow_builder_active_screen');
    onBack();
  };

  const handleSave = (screens, status) => {
    localStorage.removeItem('whatsapp_flow_builder_screens');
    localStorage.removeItem('whatsapp_flow_builder_active_screen');
    onSave(screens, status);
  };

  const [draggingItem, setDraggingItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);

  const activeScreen = screens.find(s => s.id === activeScreenId) || screens[0];

  // Drag and Drop Handlers for Screens
  const handleScreenDragStart = (e, index) => {
    setDraggingItem({ type: 'screen', index });
  };

  const handleScreenDragEnter = (e, index) => {
    if (draggingItem?.type === 'screen') {
      setDragOverItem(index);
    }
  };

  const handleScreenDragEnd = () => {
    if (draggingItem?.type === 'screen' && dragOverItem !== null) {
      const newScreens = [...screens];
      const draggedScreen = newScreens[draggingItem.index];
      newScreens.splice(draggingItem.index, 1);
      newScreens.splice(dragOverItem, 0, draggedScreen);
      setScreens(newScreens);
    }
    setDraggingItem(null);
    setDragOverItem(null);
  };

  // Drag and Drop Handlers for Components
  const handleComponentDragStart = (e, index) => {
    e.stopPropagation();
    setDraggingItem({ type: 'component', index });
  };

  const handleComponentDragEnter = (e, index) => {
    e.stopPropagation();
    if (draggingItem?.type === 'component') {
      setDragOverItem(index);
    }
  };

  const handleComponentDragEnd = (e) => {
    e.stopPropagation();
    if (draggingItem?.type === 'component' && dragOverItem !== null) {
      const newScreens = screens.map(s => {
        if (s.id === activeScreenId) {
          const newContent = [...s.content];
          const draggedComp = newContent[draggingItem.index];
          newContent.splice(draggingItem.index, 1);
          newContent.splice(dragOverItem, 0, draggedComp);
          return { ...s, content: newContent };
        }
        return s;
      });
      setScreens(newScreens);
    }
    setDraggingItem(null);
    setDragOverItem(null);
  };

  const addScreen = () => {
    const newId = `screen_${screens.length + 1}`;
    setScreens([...screens, { id: newId, title: `Screen ${screens.length + 1}`, content: [] }]);
    setActiveScreenId(newId);
  };

  const updateScreenTitle = (title) => {
    setScreens(screens.map(s => s.id === activeScreenId ? { ...s, title } : s));
  };

  const addComponent = (config) => {
    const id = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { type, variant, label } = config;
    const base = {
      id,
      type,
      variant,
      required: false
    };

    let newComponent;

    if (type === 'Text') {
      let className = 'text-sm text-slate-700';
      if (variant === 'largeHeading') className = 'text-lg font-semibold text-slate-900';
      else if (variant === 'smallHeading') className = 'text-sm font-semibold text-slate-900';
      else if (variant === 'caption') className = 'text-xs text-slate-500';
      newComponent = {
        ...base,
        text: label,
        className
      };
    } else if (type === 'Label') {
      newComponent = {
        ...base,
        text: label,
        className: 'text-sm font-medium text-slate-900'
      };
    } else if (type === 'Input') {
      newComponent = {
        ...base,
        label: label || 'Short answer',
        placeholder: '',
      };
    } else if (type === 'TextArea') {
      newComponent = {
        ...base,
        label: label || 'Paragraph',
        placeholder: '',
        rows: 3
      };
    } else if (type === 'Radio' || type === 'Checkbox' || type === 'Dropdown') {
      const defaultLabel =
        variant === 'singleChoice' ? 'Single Choice' :
        variant === 'multipleChoice' ? 'Multiple Choice' :
        variant === 'dropdown' ? 'Dropdown' :
        variant === 'optIn' ? 'Opt-in' :
        label;
      const defaultOptions =
        variant === 'optIn'
          ? ['I agree to receive updates']
          : ['Option 1', 'Option 2'];

      newComponent = {
        ...base,
        label: defaultLabel,
        options: defaultOptions
      };
    } else if (type === 'Date') {
      newComponent = {
        ...base,
        label: 'Date picker'
      };
    } else if (type === 'Image') {
      newComponent = {
        ...base,
        label: 'Image'
      };
    } else {
      newComponent = {
        ...base,
        label: label || type
      };
    }

    setScreens(screens.map(s => 
      s.id === activeScreenId 
        ? { ...s, content: [...s.content, newComponent] }
        : s
    ));
  };

  const updateComponent = (cmpId, updates) => {
    setScreens(screens.map(s => 
      s.id === activeScreenId 
        ? { ...s, content: s.content.map(c => c.id === cmpId ? { ...c, ...updates } : c) }
        : s
    ));
  };

  const removeComponent = (cmpId) => {
    setScreens(screens.map(s => 
      s.id === activeScreenId 
        ? { ...s, content: s.content.filter(c => c.id !== cmpId) }
        : s
    ));
  };

  const renderComponentEditor = (cmp, index) => {
    const variant = cmp.variant;
    const displayType =
      variant === 'largeHeading' ? 'Large Heading' :
      variant === 'smallHeading' ? 'Small Heading' :
      variant === 'caption' ? 'Caption' :
      variant === 'body' ? 'Body' :
      variant === 'shortAnswer' ? 'Short Answer' :
      variant === 'paragraph' ? 'Paragraph' :
      variant === 'datePicker' ? 'Date picker' :
      variant === 'singleChoice' ? 'Single Choice' :
      variant === 'multipleChoice' ? 'Multiple Choice' :
      variant === 'dropdown' ? 'Dropdown' :
      variant === 'optIn' ? 'Opt-in' :
      cmp.type === 'Image' ? 'Image' :
      cmp.type === 'Input' ? 'Short Answer' :
      cmp.type === 'TextArea' ? 'Paragraph' :
      cmp.type === 'Radio' ? 'Single Choice' :
      cmp.type === 'Checkbox' ? 'Multiple Choice' :
      cmp.type === 'Text' ? 'Text' :
      cmp.type;

    return (
      <div 
        key={cmp.id}
        draggable
        onDragStart={(e) => handleComponentDragStart(e, index)}
        onDragEnter={(e) => handleComponentDragEnter(e, index)}
        onDragEnd={handleComponentDragEnd}
        onDragOver={(e) => e.preventDefault()}
        className={`bg-white border rounded-lg p-4 mb-3 transition-all ${
          draggingItem?.type === 'component' && draggingItem.index === index ? 'opacity-50' : ''
        } ${dragOverItem === index && draggingItem?.type === 'component' ? 'border-green-500 border-2' : 'border-slate-200'}`}
      >
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2">
            <div className="cursor-move text-slate-400 hover:text-slate-600">
              <GripVertical className="w-5 h-5" />
            </div>
            <span className="font-semibold text-slate-700 text-sm flex items-center gap-2">
               {displayType}
               <span className="text-xs font-normal text-slate-400">• {(cmp.label || cmp.text || '').toString().slice(0, 30)}</span>
            </span>
          </div>
          <button 
            onClick={() => removeComponent(cmp.id)}
            className="text-slate-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 pl-7">
          {/* Common Fields */}
          {(cmp.type !== 'Text' && cmp.type !== 'Label') && (
             <div className="space-y-1">
                <div className="flex justify-between">
                   <label className="text-xs font-medium text-slate-700">Label</label>
                   <span className="text-xs text-slate-400">{(cmp.label || '').length}/50</span>
                </div>
                <input 
                  type="text" 
                  className="w-full h-9 px-3 border border-slate-300 rounded text-sm focus:outline-none focus:border-green-500"
                  value={cmp.label || ''}
                  onChange={(e) => updateComponent(cmp.id, { label: e.target.value })}
                />
             </div>
          )}

          {(cmp.type === 'Text' || cmp.type === 'Label') && (
             <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700">Content</label>
                <textarea 
                  className="w-full p-2 border border-slate-300 rounded text-sm focus:outline-none focus:border-green-500 resize-none"
                  rows={3}
                  value={cmp.text || ''}
                  onChange={(e) => updateComponent(cmp.id, { text: e.target.value })}
                />
             </div>
          )}

          {/* Placeholder & Helper Text */}
          {(cmp.type === 'Input' || cmp.type === 'TextArea') && (
            <div className="space-y-1">
               <label className="text-xs font-medium text-slate-700">Placeholder (Optional)</label>
               <input 
                  type="text" 
                  className="w-full h-9 px-3 border border-slate-300 rounded text-sm focus:outline-none focus:border-green-500"
                  value={cmp.placeholder || ''}
                  onChange={(e) => updateComponent(cmp.id, { placeholder: e.target.value })}
               />
            </div>
          )}
          
          {/* Options for Choice Components */}
          {(cmp.type === 'Radio' || cmp.type === 'Checkbox' || cmp.type === 'Dropdown') && (
            <div className="space-y-2">
               <label className="text-xs font-medium text-slate-700">Options</label>
               {(cmp.options || ['Option 1', 'Option 2']).map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                     <div className={`w-4 h-4 border border-slate-300 ${cmp.type === 'Radio' ? 'rounded-full' : 'rounded'}`}></div>
                     <input 
                        type="text" 
                        className="flex-1 h-8 px-2 border border-slate-300 rounded text-xs focus:outline-none focus:border-green-500"
                        value={opt}
                        onChange={(e) => {
                           const newOptions = [...(cmp.options || ['Option 1', 'Option 2'])];
                           newOptions[idx] = e.target.value;
                           updateComponent(cmp.id, { options: newOptions });
                        }}
                     />
                     <button 
                        onClick={() => {
                           const newOptions = (cmp.options || ['Option 1', 'Option 2']).filter((_, i) => i !== idx);
                           updateComponent(cmp.id, { options: newOptions });
                        }}
                        className="text-slate-400 hover:text-red-500"
                     >
                        <Trash2 className="w-3 h-3" />
                     </button>
                  </div>
               ))}
               <Button 
                  size="sm" 
                  variant="outline" 
                  className="w-full text-xs h-8"
                  onClick={() => updateComponent(cmp.id, { options: [...(cmp.options || ['Option 1', 'Option 2']), `Option ${(cmp.options || []).length + 1}`] })}
               >
                  <Plus className="w-3 h-3 mr-1" /> Add Option
               </Button>
            </div>
          )}

          {/* Required Toggle */}
          {cmp.type !== 'Text' && cmp.type !== 'Label' && cmp.type !== 'Image' && (
             <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-xs font-medium text-slate-700">Required</span>
                <button 
                   onClick={() => updateComponent(cmp.id, { required: !cmp.required })}
                   className={`w-9 h-5 rounded-full relative transition-colors ${cmp.required ? 'bg-green-600' : 'bg-slate-300'}`}
                >
                   <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all ${cmp.required ? 'left-5' : 'left-0.5'}`} />
                </button>
             </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Header */}
      <div className="flex justify-between items-center bg-white border-b border-slate-200 px-6 py-3 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={handleBack} className="text-slate-500 hover:text-slate-800">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-slate-200"></div>
          <h2 className="font-semibold text-slate-800">{flowData.name || 'Untitled Flow'}</h2>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave(screens, 'DRAFT')} className="text-slate-700 border-slate-300 hover:bg-slate-50">
            Save as Draft
          </Button>
          <Button className="bg-[#0f3529] hover:bg-[#0a261d] text-white" onClick={() => handleSave(screens, 'PUBLISHED')}>
            Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Editor */}
        <div className="w-[500px] bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Screens Section */}
          <div className="flex-none p-4 border-b border-slate-100 bg-slate-50/50">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Screens</h3>
              <button onClick={addScreen} className="text-green-600 hover:text-green-700 text-sm font-medium flex items-center gap-1">
                <Plus className="w-4 h-4" /> Add new
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {screens.map((screen, idx) => (
                <div 
                  key={screen.id}
                  draggable
                  onDragStart={(e) => handleScreenDragStart(e, idx)}
                  onDragEnter={(e) => handleScreenDragEnter(e, idx)}
                  onDragEnd={handleScreenDragEnd}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => setActiveScreenId(screen.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                     activeScreenId === screen.id 
                       ? 'bg-white border-green-500 shadow-sm ring-1 ring-green-500' 
                       : 'bg-white border-slate-200 hover:border-slate-300'
                  } ${draggingItem?.type === 'screen' && draggingItem.index === idx ? 'opacity-50' : ''}`}
                >
                  <div className="cursor-grab text-slate-400">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 flex-1 truncate">{screen.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                     {screen.id.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Edit Content Section */}
          <div className="flex-1 flex flex-col overflow-hidden">
             <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Edit Content</h3>
                
                <div className="relative group">
                   <Button size="sm" variant="outline" className="text-xs h-8 gap-2">
                      <Plus className="w-3 h-3" /> Add content
                   </Button>
                   <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-slate-200 rounded-lg shadow-xl py-1 hidden group-hover:block z-50">
                     {COMPONENT_GROUPS.map(group => (
                       <div key={group.key} className="relative group/item">
                         <button
                           className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center justify-between gap-2"
                         >
                           <span className="flex items-center gap-2">
                             <group.icon className="w-4 h-4 text-slate-500" />
                             <span>{group.label}</span>
                           </span>
                           <ChevronRight className="w-3 h-3 text-slate-400" />
                         </button>
                         <div className="absolute left-full top-0 ml-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl py-1 hidden group-hover/item:block z-50">
                           {group.items.map(item => (
                             <button
                               key={item.key}
                               onClick={() => addComponent(item)}
                               className="w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                             >
                               <span>{item.label}</span>
                             </button>
                           ))}
                         </div>
                       </div>
                     ))}
                   </div>
                </div>
             </div>
             
             <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
                {/* Screen Title Input */}
                <div className="mb-6">
                   <label className="block text-xs font-medium text-slate-500 mb-1">Screen title</label>
                   <div className="flex items-center gap-2">
                      <input 
                         type="text"
                         className="flex-1 text-lg font-semibold text-slate-800 bg-transparent border-b border-slate-300 focus:border-green-500 focus:outline-none px-1 py-1"
                         value={activeScreen.title}
                         onChange={(e) => updateScreenTitle(e.target.value)}
                      />
                   </div>
                </div>

                {/* Components List */}
                <div className="space-y-4 pb-20">
                   {activeScreen.content.length === 0 ? (
                      <div className="text-center py-10 border-2 border-dashed border-slate-200 rounded-lg">
                         <p className="text-slate-400 text-sm">No content yet</p>
                         <p className="text-slate-400 text-xs mt-1">Click "Add content" to start building</p>
                      </div>
                   ) : (
                      activeScreen.content.map((cmp, idx) => renderComponentEditor(cmp, idx))
                   )}
                </div>
             </div>
          </div>
        </div>

        {/* Right Sidebar - Preview */}
        <div className="flex-1 bg-slate-50 p-8 flex flex-col items-center justify-center overflow-hidden">
          <div className="w-full max-w-[400px] mb-4 flex justify-end">
             <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-slate-200">
                <span className="text-xs text-slate-500">Previewing:</span>
                <select 
                   className="text-xs font-medium text-slate-800 bg-transparent border-none focus:ring-0 cursor-pointer outline-none"
                   value={activeScreenId}
                   onChange={(e) => setActiveScreenId(e.target.value)}
                >
                   {screens.map(s => (
                      <option key={s.id} value={s.id}>{s.title}</option>
                   ))}
                </select>
             </div>
          </div>

          <div className="w-[340px] h-[680px] bg-white rounded-[3rem] border-[8px] border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
            {/* Status Bar */}
            <div className="h-6 bg-slate-800 w-full absolute top-0 z-10 flex justify-center">
                <div className="h-4 w-32 bg-black rounded-b-xl"></div>
            </div>

            {/* Modal Header */}
            <div className="mt-8 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <button className="text-slate-500">
                    <X className="w-5 h-5" />
                </button>
                <div className="font-semibold text-slate-800 text-sm">{activeScreen.title}</div>
                <div className="w-5"></div>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-1 px-4 py-2">
                {screens.map((s, idx) => (
                    <div 
                        key={s.id}
                        className={`h-1 flex-1 rounded-full ${
                            s.id === activeScreenId || screens.findIndex(sc => sc.id === activeScreenId) > idx 
                               ? 'bg-green-600' 
                               : 'bg-slate-200'
                        }`}
                    />
                ))}
            </div>

            {/* Screen Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeScreen.content.map((cmp, idx) => {
                   switch (cmp.type) {
                      case 'Text':
                      case 'Label':
                         return <div key={idx} className={cmp.className}>{cmp.text}</div>;
                      case 'Input':
                      case 'TextArea':
                         return (
                           <div key={idx} className="space-y-1">
                              {cmp.label && <div className="text-sm text-slate-600 font-medium">{cmp.label}</div>}
                              {cmp.type === 'TextArea' ? (
                                 <textarea 
                                    className="w-full p-2 border border-slate-300 rounded-md text-sm bg-white resize-none"
                                    placeholder={cmp.placeholder}
                                    rows={3}
                                    readOnly
                                 />
                              ) : (
                                 <input 
                                    type="text"
                                    className="w-full h-10 px-3 border border-slate-300 rounded-md bg-white text-slate-900 text-sm"
                                    placeholder={cmp.placeholder}
                                    readOnly
                                 />
                              )}
                           </div>
                         );
                      case 'Date':
                         return (
                           <div key={idx} className="space-y-1">
                             {cmp.label && <div className="text-sm text-slate-600 font-medium">{cmp.label}</div>}
                             <input
                               type="date"
                               className="w-full h-10 px-3 border border-slate-300 rounded-md bg-white text-slate-900 text-sm"
                               readOnly
                             />
                           </div>
                         );
                      case 'Checkbox':
                         return (
                           <div key={idx}>
                              {cmp.label && <div className="text-sm text-slate-600 font-medium mb-2">{cmp.label}</div>}
                              {(cmp.options || ['Option 1', 'Option 2']).map((opt, i) => (
                                 <label key={i} className="flex items-start gap-3 mb-2">
                                    <div className="w-5 h-5 border border-slate-300 rounded mt-0.5"></div>
                                    <span className="text-sm text-slate-700">{opt}</span>
                                 </label>
                              ))}
                           </div>
                         );
                      case 'Dropdown':
                         return (
                           <div key={idx} className="space-y-1">
                             {cmp.label && <div className="text-sm text-slate-600 font-medium mb-2">{cmp.label}</div>}
                             <select
                               className="w-full h-10 px-3 border border-slate-300 rounded-md bg-white text-slate-900 text-sm"
                               disabled
                             >
                               {(cmp.options || ['Option 1', 'Option 2']).map((opt, i) => (
                                 <option key={i}>{opt}</option>
                               ))}
                             </select>
                           </div>
                         );
                      case 'Radio':
                         return (
                           <div key={idx}>
                              {cmp.label && <div className="text-sm text-slate-600 font-medium mb-2">{cmp.label}</div>}
                              {(cmp.options || ['Option 1', 'Option 2']).map((opt, i) => (
                                 <label key={i} className="flex items-center justify-between mb-3 border-b border-slate-50 pb-2 last:border-0">
                                    <span className="text-sm text-slate-700">{opt}</span>
                                    <div className="w-5 h-5 border border-slate-300 rounded-full"></div>
                                 </label>
                              ))}
                           </div>
                         );
                      case 'Image':
                         return (
                           <div
                             key={idx}
                             className="w-full h-32 border border-dashed border-slate-300 rounded-lg flex items-center justify-center text-[11px] text-slate-400 bg-slate-50"
                           >
                             Image
                           </div>
                         );
                      default:
                         return null;
                   }
                })}
            </div>

            {/* Footer Button */}
            <div className="p-4 border-t border-slate-100">
                <button className="w-full py-2.5 bg-green-600 text-white font-medium rounded-full text-sm shadow-sm">
                    {screens.indexOf(activeScreen) === screens.length - 1 ? 'Submit' : 'Continue'}
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function X({ className }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
