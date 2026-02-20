import React, { useEffect, useState } from 'react';
import { listWhatsappFlows, createWhatsappFlow, updateWhatsappFlow } from '../api';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';

export default function FlowsPage() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listWhatsappFlows();
        if (!isMounted) return;
        setFlows(data);
        if (data.length > 0) {
          selectFlow(data[0]);
        }
      } catch (e) {
        if (isMounted) {
          setError(e.message || 'Failed to load flows');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  function selectFlow(flow) {
    setSelectedFlowId(flow.id);
    setName(flow.name || '');
    setDescription(flow.description || '');
    setCategories((flow.categories || []).join(', '));
    setJsonText(JSON.stringify(flow.flow_json || {}, null, 2));
    setJsonError(null);
  }

  function resetForm() {
    setSelectedFlowId(null);
    setName('');
    setDescription('');
    setCategories('');
    setJsonText(
      JSON.stringify(
        {
          version: '7.2',
          screens: [],
        },
        null,
        2
      )
    );
    setJsonError(null);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setJsonError(null);
    let parsed = null;
    try {
      parsed = jsonText ? JSON.parse(jsonText) : {};
    } catch (err) {
      setJsonError('Invalid JSON: ' + err.message);
      setSaving(false);
      return;
    }

    const payload = {
      name: name || 'Untitled Flow',
      description: description || null,
      categories: categories
        ? categories
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      flow_json: parsed,
    };

    try {
      let saved;
      if (selectedFlowId) {
        saved = await updateWhatsappFlow(selectedFlowId, payload);
        setFlows((prev) =>
          prev.map((f) => (f.id === saved.id ? saved : f))
        );
      } else {
        saved = await createWhatsappFlow(payload);
        setFlows((prev) => [saved, ...prev]);
      }
      selectFlow(saved);
    } catch (err) {
      setError(err.message || 'Failed to save flow');
    } finally {
      setSaving(false);
    }
  }

  let preview = null;
  try {
    const parsed = jsonText ? JSON.parse(jsonText) : {};
    preview = parsed && parsed.screens ? parsed.screens : [];
  } catch (e) {
    preview = null;
  }

  return (
    <div className="flex h-full">
      <div className="w-64 border-r border-slate-200 bg-white flex flex-col">
        <div className="p-3 flex items-center justify-between border-b border-slate-100">
          <div className="font-semibold text-slate-800 text-sm">Flows</div>
          <Button size="xs" onClick={resetForm}>
            New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-3 text-xs text-slate-500">Loading...</div>
          )}
          {error && (
            <div className="p-3 text-xs text-red-500">{error}</div>
          )}
          {!loading && flows.length === 0 && !error && (
            <div className="p-3 text-xs text-slate-500">
              No flows yet. Click New to create one.
            </div>
          )}
          {flows.map((flow) => (
            <button
              key={flow.id}
              type="button"
              onClick={() => selectFlow(flow)}
              className={`w-full text-left px-3 py-2 text-xs border-b border-slate-100 hover:bg-slate-50 ${
                selectedFlowId === flow.id ? 'bg-slate-100' : ''
              }`}
            >
              <div className="font-medium text-slate-800 truncate">
                {flow.name}
              </div>
              {flow.description && (
                <div className="text-[11px] text-slate-500 truncate">
                  {flow.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 grid grid-cols-2 gap-4 p-4">
          <form onSubmit={handleSave} className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-slate-800 text-sm">
                Flow Details
              </div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Name</div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Flow name"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">Description</div>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Short description"
                rows={2}
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-slate-600">
                Categories (comma separated)
              </div>
              <Input
                value={categories}
                onChange={(e) => setCategories(e.target.value)}
                placeholder="LEAD_GENERATION, APPOINTMENT_BOOKING"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 flex-1 flex flex-col">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-600">Flow JSON</div>
                {jsonError && (
                  <div className="text-[11px] text-red-500">
                    {jsonError}
                  </div>
                )}
              </div>
              <Textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                className="flex-1 text-xs font-mono"
              />
            </div>
          </form>
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-slate-800 text-sm">
                Preview (screens)
              </div>
            </div>
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-md bg-slate-50 p-3">
              {!preview && (
                <div className="text-xs text-slate-500">
                  Invalid JSON. Fix Flow JSON to see preview.
                </div>
              )}
              {preview && preview.length === 0 && (
                <div className="text-xs text-slate-500">
                  No screens defined. Add screens in Flow JSON to see
                  preview.
                </div>
              )}
              {preview &&
                preview.map((screen) => (
                  <div
                    key={screen.id || screen.title}
                    className="mb-3 rounded-md bg-white shadow-sm border border-slate-200 p-3"
                  >
                    <div className="text-[11px] font-semibold text-slate-500 mb-1 uppercase">
                      {screen.id || 'SCREEN'}
                    </div>
                    <div className="text-sm font-medium text-slate-900 mb-1">
                      {screen.title || 'Untitled screen'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Layout: {screen.layout && screen.layout.type
                        ? screen.layout.type
                        : 'Unknown'}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
