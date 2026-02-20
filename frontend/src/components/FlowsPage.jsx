import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { listWhatsappFlows, createWhatsappFlow, updateWhatsappFlow } from '../api';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';

const CATEGORY_OPTIONS = [
  'Sign up',
  'Log in',
  'Appointment booking',
  'Lead generation',
  'Shopping',
  'Contact us',
  'Customer support',
  'Survey',
  'Other',
];

const TEMPLATES = {
  default: {
    key: 'default',
    title: 'Default',
    description: 'Blank flow with a welcome screen.',
    buildJson: () => ({
      version: '7.2',
      screens: [
        {
          id: 'WELCOME',
          title: 'Welcome',
          terminal: true,
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'TextHeading',
                text: 'Hello World',
              },
              {
                type: 'TextBody',
                text: "Let’s start building things!",
              },
              {
                type: 'Footer',
                label: 'Complete',
                'on-click-action': {
                  name: 'complete',
                  payload: {},
                },
              },
            ],
          },
        },
      ],
    }),
  },
  purchase_interest: {
    key: 'purchase_interest',
    title: 'Collect purchase interest',
    description: 'Ask what the user is interested in buying.',
    buildJson: () => ({
      version: '7.2',
      screens: [
        {
          id: 'PURCHASE_INTENT',
          title: 'Purchase Interest',
          terminal: true,
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'TextHeading',
                text: 'What are you interested in?',
              },
              {
                type: 'RadioButtonsGroup',
                name: 'interest',
                label: 'Select a category',
                'data-source': [
                  { id: 'courses', title: 'Courses' },
                  { id: 'products', title: 'Products' },
                  { id: 'services', title: 'Services' },
                ],
                required: true,
              },
              {
                type: 'Footer',
                label: 'Submit',
                'on-click-action': {
                  name: 'complete',
                  payload: {},
                },
              },
            ],
          },
        },
      ],
    }),
  },
  feedback: {
    key: 'feedback',
    title: 'Get feedback',
    description: 'Simple text feedback form.',
    buildJson: () => ({
      version: '7.2',
      screens: [
        {
          id: 'FEEDBACK',
          title: 'Feedback',
          terminal: true,
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'TextHeading',
                text: 'How did we do?',
              },
              {
                type: 'TextBody',
                text: 'Share your feedback to help us improve.',
              },
              {
                type: 'TextInput',
                name: 'feedback',
                label: 'Your feedback',
                required: true,
              },
              {
                type: 'Footer',
                label: 'Submit',
                'on-click-action': {
                  name: 'complete',
                  payload: {},
                },
              },
            ],
          },
        },
      ],
    }),
  },
  survey: {
    key: 'survey',
    title: 'Send a survey',
    description: 'Multi-choice satisfaction survey.',
    buildJson: () => ({
      version: '7.2',
      screens: [
        {
          id: 'SURVEY',
          title: 'Customer Survey',
          terminal: true,
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'TextHeading',
                text: 'How satisfied are you?',
              },
              {
                type: 'RadioButtonsGroup',
                name: 'satisfaction',
                label: 'Select one option',
                'data-source': [
                  { id: 'very_satisfied', title: 'Very satisfied' },
                  { id: 'satisfied', title: 'Satisfied' },
                  { id: 'neutral', title: 'Neutral' },
                  { id: 'dissatisfied', title: 'Dissatisfied' },
                ],
                required: true,
              },
              {
                type: 'Footer',
                label: 'Submit',
                'on-click-action': {
                  name: 'complete',
                  payload: {},
                },
              },
            ],
          },
        },
      ],
    }),
  },
  support: {
    key: 'support',
    title: 'Customer support',
    description: 'Capture support issue and priority.',
    buildJson: () => ({
      version: '7.2',
      screens: [
        {
          id: 'SUPPORT',
          title: 'Support',
          terminal: true,
          layout: {
            type: 'SingleColumnLayout',
            children: [
              {
                type: 'TextHeading',
                text: 'Tell us your issue',
              },
              {
                type: 'TextInput',
                name: 'subject',
                label: 'Subject',
                required: true,
              },
              {
                type: 'TextInput',
                name: 'details',
                label: 'Details',
                required: true,
              },
              {
                type: 'RadioButtonsGroup',
                name: 'priority',
                label: 'Priority',
                'data-source': [
                  { id: 'low', title: 'Low' },
                  { id: 'medium', title: 'Medium' },
                  { id: 'high', title: 'High' },
                ],
                required: true,
              },
              {
                type: 'Footer',
                label: 'Submit',
                'on-click-action': {
                  name: 'complete',
                  payload: {},
                },
              },
            ],
          },
        },
      ],
    }),
  },
};

export default function FlowsPage() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [selectedFlowId, setSelectedFlowId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState([]);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState(null);
  const [endpointMode, setEndpointMode] = useState('without');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('default');
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);

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
    setCategories(flow.categories || []);
    setSelectedTemplateKey(null);
    setJsonText(JSON.stringify(flow.flow_json || {}, null, 2));
    setJsonError(null);
    setActiveScreenIndex(0);
  }

  function resetForm() {
    setSelectedFlowId(null);
    setName('');
    setDescription('');
    setCategories([]);
    setEndpointMode('without');
    setSelectedTemplateKey('default');
    const tpl = TEMPLATES.default;
    const baseJson = tpl.buildJson();
    setJsonText(JSON.stringify(baseJson, null, 2));
    setJsonError(null);
    setActiveScreenIndex(0);
  }

  function applyTemplate(key) {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    setSelectedTemplateKey(key);
    const json = tpl.buildJson();
    setJsonText(JSON.stringify(json, null, 2));
    setJsonError(null);
    setActiveScreenIndex(0);
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
      categories: categories && Array.isArray(categories) ? categories : [],
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

  const previewScreens = Array.isArray(preview) ? preview : [];
  const safeScreenIndex =
    previewScreens.length > 0
      ? Math.min(activeScreenIndex, previewScreens.length - 1)
      : 0;
  const activeScreen =
    previewScreens.length > 0 ? previewScreens[safeScreenIndex] : null;

  let headingText = null;
  let bodyText = null;
  let footerLabel = 'Complete';
  if (
    activeScreen &&
    activeScreen.layout &&
    Array.isArray(activeScreen.layout.children)
  ) {
    for (const child of activeScreen.layout.children) {
      if (!headingText && child.type === 'TextHeading' && child.text) {
        headingText = child.text;
      }
      if (!bodyText && child.type === 'TextBody' && child.text) {
        bodyText = child.text;
      }
      if (child.type === 'Footer' && child.label) {
        footerLabel = child.label;
      }
    }
  }

  const filteredCategories = CATEGORY_OPTIONS.filter((opt) =>
    opt.toLowerCase().includes(categorySearch.toLowerCase())
  );

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
          <form onSubmit={handleSave} className="flex flex-col gap-4">
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
                Categories
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setCategoriesOpen((open) => !open)}
                  className="w-full flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-left text-slate-700 hover:border-slate-300"
                >
                  <span className="truncate">
                    {categories && categories.length > 0
                      ? categories.join(', ')
                      : 'Select categories'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-slate-500 ml-2 flex-shrink-0" />
                </button>
                {categoriesOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setCategoriesOpen(false)}
                    />
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-md">
                      <div className="p-2 border-b border-slate-100">
                        <Input
                          className="h-8 text-xs"
                          placeholder="Search categories"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {filteredCategories.map((opt) => {
                          const checked =
                            categories && categories.includes(opt);
                          return (
                            <label
                              key={opt}
                              className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              <input
                                type="checkbox"
                                className="h-3 w-3"
                                checked={checked}
                                onChange={() => {
                                  setCategories((prev) => {
                                    const list = Array.isArray(prev)
                                      ? [...prev]
                                      : [];
                                    if (list.includes(opt)) {
                                      return list.filter((c) => c !== opt);
                                    }
                                    list.push(opt);
                                    return list;
                                  });
                                }}
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                        {filteredCategories.length === 0 && (
                          <div className="px-3 py-2 text-[11px] text-slate-400">
                            No categories found
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-slate-600">Template</div>
              <div className="border border-slate-200 rounded-md bg-white">
                <div className="flex text-xs border-b border-slate-200">
                  <button
                    type="button"
                    className={`flex-1 px-3 py-2 text-center ${
                      endpointMode === 'without'
                        ? 'bg-slate-50 font-semibold text-slate-900 border-b-2 border-slate-900'
                        : 'text-slate-500'
                    }`}
                    onClick={() => setEndpointMode('without')}
                  >
                    Without Endpoint
                  </button>
                  <button
                    type="button"
                    className={`flex-1 px-3 py-2 text-center ${
                      endpointMode === 'with'
                        ? 'bg-slate-50 font-semibold text-slate-900 border-b-2 border-slate-900'
                        : 'text-slate-500'
                    }`}
                    onClick={() => setEndpointMode('with')}
                  >
                    With Endpoint
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {Object.values(TEMPLATES).map((tpl) => (
                    <button
                      key={tpl.key}
                      type="button"
                      onClick={() => applyTemplate(tpl.key)}
                      className={`w-full flex items-start gap-2 rounded-md px-3 py-2 text-left border ${
                        selectedTemplateKey === tpl.key
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span className="mt-0.5">
                        <span
                          className={`inline-block h-3 w-3 rounded-full border ${
                            selectedTemplateKey === tpl.key
                              ? 'border-blue-600 bg-blue-600'
                              : 'border-slate-400 bg-white'
                          }`}
                        />
                      </span>
                      <span className="flex-1">
                        <div className="text-xs font-medium text-slate-900">
                          {tpl.title}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {tpl.description}
                        </div>
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1 flex-1 flex flex-col">
              <button
                type="button"
                className="text-[11px] text-slate-500 underline-offset-2 hover:underline self-start"
                onClick={() => setShowJsonEditor((v) => !v)}
              >
                {showJsonEditor ? 'Hide JSON (advanced)' : 'Edit JSON (advanced)'}
              </button>
              {showJsonEditor && (
                <div className="space-y-1">
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
                    className="h-40 text-xs font-mono"
                  />
                </div>
              )}
            </div>
          </form>
          <div className="flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <div className="font-semibold text-slate-800 text-sm">
                Flow Preview
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <div className="w-[320px] bg-white rounded-[2rem] border-8 border-slate-800 shadow-2xl overflow-hidden relative h-[620px] flex flex-col">
                <div className="h-6 bg-slate-800 w-full flex items-center justify-center">
                  <div className="w-20 h-4 bg-black rounded-b-xl" />
                </div>
                <div className="h-12 bg-[#075E54] flex items-center px-4 gap-3 shadow-md z-10">
                  <div className="w-8 h-8 rounded-full bg-white/20" />
                  <div className="flex-1">
                    <div className="h-2 w-20 bg-white/30 rounded mb-1" />
                    <div className="h-1.5 w-12 bg-white/20 rounded" />
                  </div>
                </div>
                <div className="flex-1 bg-[#E5DDD5] p-4 overflow-y-auto">
                  {!activeScreen && (
                    <div className="h-full flex items-center justify-center text-xs text-slate-600 text-center px-6">
                      Define at least one screen in the flow to see a preview.
                    </div>
                  )}
                  {activeScreen && (
                    <div className="bg-white rounded-lg shadow-sm px-3 py-2 max-w-[260px] ml-auto">
                      <div className="text-[10px] text-slate-500 mb-1">
                        {activeScreen.title || 'Screen'}
                      </div>
                      {headingText && (
                        <div className="text-sm font-semibold text-slate-900 mb-1">
                          {headingText}
                        </div>
                      )}
                      {bodyText && (
                        <div className="text-xs text-slate-700 whitespace-pre-wrap mb-3">
                          {bodyText}
                        </div>
                      )}
                      <button className="mt-1 w-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-medium py-1.5 rounded-full">
                        {footerLabel}
                      </button>
                    </div>
                  )}
                </div>
                <div className="h-10 bg-white border-t border-slate-200 flex items-center justify-center gap-4 text-xs text-slate-500">
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 disabled:opacity-40"
                    onClick={() =>
                      setActiveScreenIndex((idx) =>
                        idx > 0 ? idx - 1 : idx
                      )
                    }
                    disabled={safeScreenIndex <= 0}
                  >
                    {'<'}
                  </button>
                  <span>
                    {previewScreens.length > 0
                      ? `Screen ${safeScreenIndex + 1} of ${
                          previewScreens.length
                        }`
                      : 'No screens'}
                  </span>
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-slate-200 bg-slate-50 disabled:opacity-40"
                    onClick={() =>
                      setActiveScreenIndex((idx) =>
                        previewScreens.length === 0 ||
                        idx >= previewScreens.length - 1
                          ? idx
                          : idx + 1
                      )
                    }
                    disabled={
                      previewScreens.length === 0 ||
                      safeScreenIndex >= previewScreens.length - 1
                    }
                  >
                    {'>'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
