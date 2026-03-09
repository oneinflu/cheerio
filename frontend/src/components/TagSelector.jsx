import React, { useState, useEffect, useRef } from 'react';
import { Badge } from './ui/Badge';
import { X, Plus, Search, Tag } from 'lucide-react';
import { getLabels, createLabel } from '../api';

export default function TagSelector({ selectedLabels, onChange }) {
  const [labels, setLabels] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    loadLabels();
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadLabels = async () => {
    try {
      const res = await getLabels();
      if (res && res.labels) {
        setLabels(res.labels);
      }
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const handleCreateLabel = async () => {
    if (!inputValue.trim()) return;
    
    setLoading(true);
    try {
      const res = await createLabel(inputValue.trim());
      if (res && res.label) {
        setLabels([...labels, res.label]);
        const newSelected = [...selectedLabels, res.label.name];
        onChange(newSelected);
        setInputValue('');
        setShowDropdown(false);
      }
    } catch (error) {
      console.error('Failed to create label:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLabel = (labelName) => {
    const newSelected = selectedLabels.includes(labelName)
      ? selectedLabels.filter(l => l !== labelName)
      : [...selectedLabels, labelName];
    onChange(newSelected);
  };

  const filteredLabels = labels.filter(l => 
    l.name.toLowerCase().includes(inputValue.toLowerCase()) && 
    !selectedLabels.includes(l.name)
  );

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <label className="text-xs font-medium text-slate-500">Tags</label>
      
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedLabels.map(label => (
          <Badge key={label} variant="secondary" className="px-2 py-1 flex items-center gap-1 text-xs">
            {label}
            <button 
              onClick={() => toggleLabel(label)}
              className="hover:bg-slate-200 rounded-full p-0.5"
            >
              <X size={10} />
            </button>
          </Badge>
        ))}
      </div>

      <div className="relative">
        <div className="flex items-center border border-slate-200 rounded-md bg-white px-2 focus-within:ring-2 focus-within:ring-blue-100 focus-within:border-blue-300">
          <Tag size={14} className="text-slate-400 mr-2" />
          <input
            type="text"
            className="flex-1 py-1.5 text-sm outline-none bg-transparent placeholder:text-slate-400"
            placeholder="Add a tag..."
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowDropdown(true);
            }}
            onFocus={() => setShowDropdown(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleCreateLabel();
              }
            }}
          />
          {inputValue && (
            <button 
              onClick={() => setInputValue('')}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
            {filteredLabels.length > 0 ? (
              filteredLabels.map(label => (
                <button
                  key={label.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center gap-2"
                  onClick={() => {
                    toggleLabel(label.name);
                    setInputValue('');
                    setShowDropdown(false);
                  }}
                >
                  <Tag size={12} className="text-slate-400" />
                  {label.name}
                </button>
              ))
            ) : inputValue ? (
              <button
                className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                onClick={handleCreateLabel}
                disabled={loading}
              >
                <Plus size={12} />
                Create "{inputValue}"
              </button>
            ) : (
              <div className="px-3 py-2 text-xs text-slate-400">Type to search or create...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
