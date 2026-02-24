import React, { useState } from 'react';
import { ArrowLeft, Save, Plus, GripVertical, Type, Image as ImageIcon, MessageSquare, CheckSquare, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';

export default function FlowBuilder({ onBack, flowData, onSave }) {
  const [screens, setScreens] = useState([
    { id: 'screen_1', title: 'Screen 1', children: [] }
  ]);
  const [activeScreenId, setActiveScreenId] = useState('screen_1');
  const [draggedItem, setDraggedItem] = useState(null);

  const activeScreen = screens.find(s => s.id === activeScreenId) || screens[0];

  const addScreen = () => {
    const newId = `screen_${screens.length + 1}`;
    setScreens([...screens, { id: newId, title: `Screen ${screens.length + 1}`, children: [] }]);
    setActiveScreenId(newId);
  };

  const updateScreenTitle = (title) => {
    setScreens(screens.map(s => s.id === activeScreenId ? { ...s, title } : s));
  };

  const addComponent = (type) => {
    const newComponent = {
      id: `cmp_${Date.now()}`,
      type,
      label: type === 'Text' ? 'Body text' : type === 'Heading' ? 'Heading' : 'Label',
      required: false
    };
    setScreens(screens.map(s => 
      s.id === activeScreenId 
        ? { ...s, children: [...s.children, newComponent] }
        : s
    ));
  };

  const removeComponent = (cmpId) => {
    setScreens(screens.map(s => 
      s.id === activeScreenId 
        ? { ...s, children: s.children.filter(c => c.id !== cmpId) }
        : s
    ));
  };

  const handleSave = (status) => {
    if (onSave) {
      onSave(screens, status);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Builder Header */}
      <div className="flex justify-between items-center bg-white border-b border-slate-200 px-6 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={onBack} className="text-slate-500">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div className="h-6 w-px bg-slate-200"></div>
          <h2 className="font-semibold text-slate-800">{flowData.name || 'Untitled Flow'}</h2>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave('DRAFT')}>
            <Save className="w-4 h-4 mr-2" />
            Save as Draft
          </Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleSave('PUBLISHED')}>
            Publish
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-y-auto">
          {/* Screens List */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-slate-700">Screens</h3>
              <Button size="sm" variant="ghost" onClick={addScreen}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {screens.map(screen => (
                <button
                  key={screen.id}
                  onClick={() => setActiveScreenId(screen.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    activeScreenId === screen.id 
                      ? 'bg-green-50 text-green-700 font-medium' 
                      : 'hover:bg-slate-50 text-slate-600'
                  }`}
                >
                  {screen.title}
                </button>
              ))}
            </div>
          </div>

          {/* Edit Content */}
          <div className="p-4 flex-1">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-medium text-slate-700">Edit content</h3>
              <div className="relative group">
                <Button size="sm" variant="outline" className="text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add content
                </Button>
                {/* Dropdown Menu (Simplified) */}
                <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg hidden group-hover:block z-10">
                  <button onClick={() => addComponent('Heading')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center">
                    <Type className="w-4 h-4 mr-2 text-slate-400" /> Heading
                  </button>
                  <button onClick={() => addComponent('Text')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center">
                    <Type className="w-4 h-4 mr-2 text-slate-400" /> Body
                  </button>
                  <button onClick={() => addComponent('Input')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center">
                    <MessageSquare className="w-4 h-4 mr-2 text-slate-400" /> Input
                  </button>
                  <button onClick={() => addComponent('Select')} className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center">
                    <CheckSquare className="w-4 h-4 mr-2 text-slate-400" /> Select
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500">Screen title</label>
                <Input 
                  value={activeScreen.title} 
                  onChange={(e) => updateScreenTitle(e.target.value)}
                  className="bg-slate-50"
                />
              </div>

              {/* Component Properties */}
              {activeScreen.children.map((cmp, idx) => (
                <div key={cmp.id} className="p-3 border border-slate-200 rounded-lg bg-slate-50 group">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />
                      <span className="text-xs font-medium uppercase text-slate-500">{cmp.type}</span>
                    </div>
                    <button onClick={() => removeComponent(cmp.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <Input 
                    value={cmp.label}
                    onChange={(e) => {
                      const newChildren = [...activeScreen.children];
                      newChildren[idx] = { ...cmp, label: e.target.value };
                      setScreens(screens.map(s => s.id === activeScreenId ? { ...s, children: newChildren } : s));
                    }}
                    className="bg-white h-8 text-sm"
                  />
                </div>
              ))}

              <div className="pt-2 border-t border-slate-100">
                 <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg bg-white">
                    <span className="text-sm font-medium text-slate-700">Footer</span>
                    <span className="text-xs text-slate-400">Button</span>
                 </div>
              </div>
            </div>
          </div>
        </div>

        {/* Center Canvas / Preview Area */}
        <div className="flex-1 bg-slate-100 flex items-center justify-center p-8 overflow-y-auto">
          {/* Mobile Preview Device */}
          <div className="w-[375px] h-[720px] bg-white rounded-[3rem] border-8 border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
            {/* Status Bar */}
            <div className="h-6 bg-slate-800 w-full absolute top-0 z-10"></div>
            <div className="h-8 w-40 bg-slate-800 absolute top-0 left-1/2 -translate-x-1/2 rounded-b-2xl z-10"></div>

            {/* App Header */}
            <div className="mt-8 px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-white z-0">
               <span className="text-slate-400 text-lg">✕</span>
               <span className="font-medium text-slate-900">{activeScreen.title}</span>
               <div className="w-6"></div> {/* Spacer */}
            </div>
            
            {/* Progress Bar (Mock) */}
            <div className="px-4 py-2">
               <div className="flex gap-1">
                 {screens.map(s => (
                   <div key={s.id} className={`h-1 flex-1 rounded-full ${s.id === activeScreenId ? 'bg-green-500' : 'bg-slate-200'}`}></div>
                 ))}
               </div>
            </div>

            {/* Screen Content */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {activeScreen.children.map(cmp => (
                <div key={cmp.id}>
                  {cmp.type === 'Heading' && (
                    <h2 className="text-xl font-bold text-slate-900">{cmp.label}</h2>
                  )}
                  {cmp.type === 'Text' && (
                    <p className="text-sm text-slate-600">{cmp.label}</p>
                  )}
                  {cmp.type === 'Input' && (
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">{cmp.label}</label>
                      <input type="text" className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-green-500" placeholder="Type here..." disabled />
                    </div>
                  )}
                  {cmp.type === 'Select' && (
                    <div>
                       <label className="block text-xs font-medium text-slate-700 mb-1">{cmp.label}</label>
                       <div className="space-y-2">
                         <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-md">
                           <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                           <span className="text-sm text-slate-600">Option 1</span>
                         </div>
                         <div className="flex items-center gap-2 p-2 border border-slate-200 rounded-md">
                           <div className="w-4 h-4 rounded-full border border-slate-300"></div>
                           <span className="text-sm text-slate-600">Option 2</span>
                         </div>
                       </div>
                    </div>
                  )}
                </div>
              ))}
              
              {activeScreen.children.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-lg">
                  No content yet
                </div>
              )}
            </div>

            {/* Footer Button */}
            <div className="p-4 border-t border-slate-100">
               <button className="w-full bg-green-600 text-white font-medium py-3 rounded-full shadow-lg shadow-green-200">
                 Continue
               </button>
            </div>

            {/* Home Indicator */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-300 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
