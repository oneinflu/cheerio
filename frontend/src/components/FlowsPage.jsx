import React, { useEffect, useState } from 'react';
import { ChevronDown, GripVertical, Copy as CopyIcon, Plus } from 'lucide-react';
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
  const [endpointUri, setEndpointUri] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('default');
  const [showJsonEditor, setShowJsonEditor] = useState(false);
  const [activeScreenIndex, setActiveScreenIndex] = useState(0);
  const [draggingIndex, setDraggingIndex] = useState(null);
  const [validationErrors, setValidationErrors] = useState(null);
  const [publishOnSave, setPublishOnSave] = useState(true);
  const [activeTab, setActiveTab] = useState('builder');

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
    const rawJson = flow.flow_json || {};
    setJsonText(JSON.stringify(rawJson, null, 2));
    let mode = 'without';
    let uri = '';
    if (rawJson && typeof rawJson === 'object') {
      const meta = rawJson.meta || {};
      if (meta.endpoint_mode === 'with') {
        mode = 'with';
      }
      if (typeof meta.endpoint_uri === 'string') {
        uri = meta.endpoint_uri;
      }
      if (rawJson.data_api_version === '3.0') {
        mode = 'with';
      }
    }
    setEndpointMode(mode);
    setEndpointUri(uri);
    setJsonError(null);
    setValidationErrors(null);
    setActiveScreenIndex(0);
    setPublishOnSave(true);
  }

  function resetForm() {
    setSelectedFlowId(null);
    setName('');
    setDescription('');
    setCategories([]);
    setEndpointMode('without');
    setEndpointUri('');
    setSelectedTemplateKey('default');
    const tpl = TEMPLATES.default;
    const baseJson = tpl.buildJson();
    setJsonText(JSON.stringify(baseJson, null, 2));
    setJsonError(null);
    setValidationErrors(null);
    setActiveScreenIndex(0);
    setPublishOnSave(true);
  }

  function applyTemplate(key) {
    const tpl = TEMPLATES[key];
    if (!tpl) return;
    setSelectedTemplateKey(key);
    const json = tpl.buildJson();
    setJsonText(JSON.stringify(json, null, 2));
    setJsonError(null);
    setValidationErrors(null);
    setActiveScreenIndex(0);
  }

  async function handleSave(e) {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    setSaving(true);
    setError(null);
    setJsonError(null);
    setValidationErrors(null);
    let parsed = null;
    try {
      parsed = jsonText ? JSON.parse(jsonText) : {};
    } catch (err) {
      setJsonError('Invalid JSON: ' + err.message);
      setSaving(false);
      return;
    }

    const enriched = { ...parsed };
    if (endpointMode === 'with') {
      enriched.data_api_version = enriched.data_api_version || '3.0';
      const meta = enriched.meta && typeof enriched.meta === 'object' ? { ...enriched.meta } : {};
      meta.endpoint_mode = 'with';
      if (endpointUri) {
        meta.endpoint_uri = endpointUri;
      }
      enriched.meta = meta;
    } else {
      if (enriched.data_api_version) {
        delete enriched.data_api_version;
      }
      if (enriched.meta && typeof enriched.meta === 'object') {
        const meta = { ...enriched.meta };
        delete meta.endpoint_uri;
        meta.endpoint_mode = 'without';
        if (Object.keys(meta).length === 0) {
          delete enriched.meta;
        } else {
          enriched.meta = meta;
        }
      }
    }

    const payload = {
      name: name || 'Untitled Flow',
      description: description || null,
      categories: categories && Array.isArray(categories) ? categories : [],
      flow_json: enriched,
      publish: publishOnSave,
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
      if (err.details && Array.isArray(err.details.validation_errors)) {
        setValidationErrors(err.details.validation_errors);
      }
    } finally {
      setSaving(false);
    }
  }

  function applyJsonUpdate(mutator) {
    let parsed;
    try {
      parsed = jsonText ? JSON.parse(jsonText) : {};
    } catch {
      return;
    }
    const next = mutator(parsed) || parsed;
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError(null);
  }

  function handleCopyJson() {
    if (!navigator || !navigator.clipboard) {
      setJsonError('Clipboard is not available in this browser');
      return;
    }
    navigator.clipboard
      .writeText(jsonText || '')
      .then(() => {
        setJsonError(null);
      })
      .catch(() => {
        setJsonError('Failed to copy JSON to clipboard');
      });
  }

  function addScreen() {
    let currentScreens = [];
    try {
      const parsed = jsonText ? JSON.parse(jsonText) : {};
      currentScreens = Array.isArray(parsed.screens) ? parsed.screens : [];
    } catch {
      currentScreens = [];
    }
    const nextIndex = currentScreens.length;
    applyJsonUpdate((parsed) => {
      const screens = Array.isArray(parsed.screens) ? [...parsed.screens] : [];
      const index = screens.length;
      const screen = {
        id: `SCREEN_${index + 1}`,
        title: `Screen ${index + 1}`,
        terminal: true,
        layout: {
          type: 'SingleColumnLayout',
          children: [],
        },
      };
      screens.push(screen);
      return { ...parsed, screens };
    });
    setActiveScreenIndex(nextIndex);
  }

  function removeScreen(index) {
    let parsed;
    try {
      parsed = jsonText ? JSON.parse(jsonText) : {};
    } catch {
      return;
    }
    const screens = Array.isArray(parsed.screens) ? [...parsed.screens] : [];
    if (index < 0 || index >= screens.length) {
      return;
    }
    screens.splice(index, 1);
    const next = { ...parsed, screens };
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError(null);
    if (screens.length === 0) {
      setActiveScreenIndex(0);
    } else if (activeScreenIndex >= screens.length) {
      setActiveScreenIndex(screens.length - 1);
    }
  }

  function updateActiveScreenTitle(value) {
    applyJsonUpdate((parsed) => {
      const screens = Array.isArray(parsed.screens) ? [...parsed.screens] : [];
      if (screens.length === 0) {
        return parsed;
      }
      const index =
        activeScreenIndex >= 0 && activeScreenIndex < screens.length
          ? activeScreenIndex
          : 0;
      const screen = { ...screens[index], title: value };
      screens[index] = screen;
      return { ...parsed, screens };
    });
  }

  function buildComponent(definition) {
    if (definition === 'text_heading') {
      return {
        type: 'TextHeading',
        text: 'Heading',
      };
    }
    if (definition === 'text_body') {
      return {
        type: 'TextBody',
        text: 'Body text',
      };
    }
    if (definition === 'text_input_short') {
      return {
        type: 'TextInput',
        name: `input_${Date.now()}`,
        label: 'Your answer',
        required: false,
      };
    }
    if (definition === 'selection_single') {
      return {
        type: 'RadioButtonsGroup',
        name: `choice_${Date.now()}`,
        label: 'Select an option',
        'data-source': [
          { id: 'option_1', title: 'Option 1' },
          { id: 'option_2', title: 'Option 2' },
        ],
        required: false,
      };
    }
    if (definition === 'footer') {
      return {
        type: 'Footer',
        label: 'Continue',
        'on-click-action': {
          name: 'complete',
          payload: {},
        },
      };
    }
    return null;
  }

  function addComponentToActiveScreen(definition) {
    const component = buildComponent(definition);
    if (!component) {
      return;
    }
    applyJsonUpdate((parsed) => {
      const screens = Array.isArray(parsed.screens) ? [...parsed.screens] : [];
      let index = activeScreenIndex;
      if (!Number.isInteger(index) || index < 0 || index >= screens.length) {
        if (screens.length === 0) {
          const screen = {
            id: 'SCREEN_1',
            title: 'Screen 1',
            terminal: true,
            layout: {
              type: 'SingleColumnLayout',
              children: [],
            },
          };
          screens.push(screen);
          index = 0;
        } else {
          index = 0;
        }
      }
      const screen = { ...screens[index] };
      const layout =
        screen.layout && typeof screen.layout === 'object'
          ? { ...screen.layout }
          : { type: 'SingleColumnLayout', children: [] };
      const children = Array.isArray(layout.children)
        ? [...layout.children]
        : [];
      const footerIndex = children.findIndex(
        (child) => child && child.type === 'Footer'
      );
      if (footerIndex >= 0) {
        children.splice(footerIndex, 0, component);
      } else {
        children.push(component);
      }
      layout.children = children;
      screen.layout = layout;
      screens[index] = screen;
      return { ...parsed, screens };
    });
  }

  function updateComponentAt(index, updater) {
    applyJsonUpdate((parsed) => {
      const screens = Array.isArray(parsed.screens) ? [...parsed.screens] : [];
      if (screens.length === 0) {
        return parsed;
      }
      const screenIndex =
        activeScreenIndex >= 0 && activeScreenIndex < screens.length
          ? activeScreenIndex
          : 0;
      const screen = { ...screens[screenIndex] };
      const layout =
        screen.layout && typeof screen.layout === 'object'
          ? { ...screen.layout }
          : { type: 'SingleColumnLayout', children: [] };
      const children = Array.isArray(layout.children)
        ? [...layout.children]
        : [];
      if (index < 0 || index >= children.length) {
        return parsed;
      }
      const child = { ...children[index] };
      const nextChild = updater(child) || child;
      children[index] = nextChild;
      layout.children = children;
      screen.layout = layout;
      screens[screenIndex] = screen;
      return { ...parsed, screens };
    });
  }

  function removeComponent(index) {
    applyJsonUpdate((parsed) => {
      const screens = Array.isArray(parsed.screens) ? [...parsed.screens] : [];
      if (screens.length === 0) {
        return parsed;
      }
      const screenIndex =
        activeScreenIndex >= 0 && activeScreenIndex < screens.length
          ? activeScreenIndex
          : 0;
      const screen = { ...screens[screenIndex] };
      const layout =
        screen.layout && typeof screen.layout === 'object'
          ? { ...screen.layout }
          : { type: 'SingleColumnLayout', children: [] };
      const children = Array.isArray(layout.children)
        ? [...layout.children]
        : [];
      if (index < 0 || index >= children.length) {
        return parsed;
      }
      children.splice(index, 1);
      layout.children = children;
      screen.layout = layout;
      screens[screenIndex] = screen;
      return { ...parsed, screens };
    });
  }

  function moveComponent(fromIndex, toIndex) {
    if (fromIndex === toIndex) {
      return;
    }
    applyJsonUpdate((parsed) => {
      const screens = Array.isArray(parsed.screens) ? [...parsed.screens] : [];
      if (screens.length === 0) {
        return parsed;
      }
      const screenIndex =
        activeScreenIndex >= 0 && activeScreenIndex < screens.length
          ? activeScreenIndex
          : 0;
      const screen = { ...screens[screenIndex] };
      const layout =
        screen.layout && typeof screen.layout === 'object'
          ? { ...screen.layout }
          : { type: 'SingleColumnLayout', children: [] };
      const children = Array.isArray(layout.children)
        ? [...layout.children]
        : [];
      if (
        fromIndex < 0 ||
        fromIndex >= children.length ||
        toIndex < 0 ||
        toIndex >= children.length
      ) {
        return parsed;
      }
      const updated = [...children];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      layout.children = updated;
      screen.layout = layout;
      screens[screenIndex] = screen;
      return { ...parsed, screens };
    });
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

  const selectedFlow =
    selectedFlowId != null
      ? flows.find((f) => f.id === selectedFlowId) || null
      : null;
  const hasRemoteFlowId =
    selectedFlow && selectedFlow.flow_id && String(selectedFlow.flow_id).length > 0;

  let activeChildren = [];
  if (
    activeScreen &&
    activeScreen.layout &&
    Array.isArray(activeScreen.layout.children)
  ) {
    activeChildren = activeScreen.layout.children;
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
      <div className="flex-1 flex flex-col bg-[#F6FBF7]">
        <form onSubmit={handleSave} className="flex flex-1 flex-col h-full overflow-hidden">
          <div className="flex items-center justify-between px-6 py-2 border-b border-emerald-100 bg-white shrink-0">
            <div className="flex items-center gap-4">
              <div className="text-sm font-semibold text-emerald-900">
                Create WhatsApp Form
              </div>
              <div className="flex bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('builder')}
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                    activeTab === 'builder'
                      ? 'bg-white shadow-sm text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Builder
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  className={`px-3 py-1 text-[11px] font-medium rounded-md transition-all ${
                    activeTab === 'settings'
                      ? 'bg-white shadow-sm text-slate-900'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Settings
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="rounded-md border border-emerald-700 bg-white px-4 py-1.5 text-xs font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-70"
                onClick={() => {
                  setPublishOnSave(false);
                  handleSave();
                }}
                disabled={saving}
              >
                Save as Draft
              </button>
              <button
                type="submit"
                className="rounded-md bg-emerald-700 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-70"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Next'}
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            {activeTab === 'settings' && (
              <div className="absolute inset-0 overflow-y-auto p-6">
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="flex flex-col gap-1">
                    <div className="font-semibold text-slate-800 text-sm">
                      Flow Details
                    </div>
                    {selectedFlow && (
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>Local id: {selectedFlow.id}</span>
                        {hasRemoteFlowId ? (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 border border-emerald-200">
                              <span>Linked to WhatsApp</span>
                              <button
                                type="button"
                                className="underline underline-offset-2 hover:text-emerald-900"
                                onClick={() => {
                                  if (navigator && navigator.clipboard) {
                                    navigator.clipboard.writeText(
                                      String(selectedFlow.flow_id)
                                    );
                                  }
                                }}
                              >
                                Copy flow_id
                              </button>
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-slate-600 border border-slate-200">
                              Not yet created on WhatsApp
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {validationErrors && Array.isArray(validationErrors) && validationErrors.length > 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 space-y-1">
                      <div className="font-semibold text-amber-800">
                        Meta validation errors
                      </div>
                      <ul className="list-disc list-inside space-y-0.5">
                        {validationErrors.map((ve, idx) => {
                          const pointer =
                            ve &&
                            Array.isArray(ve.pointers) &&
                            ve.pointers.length > 0 &&
                            ve.pointers[0].path
                              ? ve.pointers[0].path
                              : null;
                          return (
                            <li key={idx}>
                              {ve && ve.message ? ve.message : 'Validation error'}
                              {pointer && (
                                <span className="text-amber-700">{` (${pointer})`}</span>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  <div className="space-y-4">
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
                      <div className="p-2 space-y-2">
                        {endpointMode === 'with' && (
                          <div className="space-y-1">
                            <div className="text-[11px] text-slate-600">
                              Endpoint URL
                            </div>
                            <Input
                              value={endpointUri}
                              onChange={(e) => setEndpointUri(e.target.value)}
                              placeholder="https://example.com/whatsapp-flow-endpoint"
                              className="h-8 text-xs"
                            />
                          </div>
                        )}
                        <div className="space-y-1">
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
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
                              onClick={handleCopyJson}
                            >
                              <CopyIcon className="w-3 h-3" />
                              <span>Copy JSON</span>
                            </button>
                            {jsonError && (
                              <div className="text-[11px] text-red-500">
                                {jsonError}
                              </div>
                            )}
                          </div>
                        </div>
                        <Textarea
                          value={jsonText}
                          onChange={(e) => setJsonText(e.target.value)}
                          className="h-40 text-xs font-mono"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'builder' && (
              <div className="absolute inset-0 grid grid-cols-[220px_1fr_360px] divide-x divide-slate-200 bg-white">
                <div className="flex flex-col bg-slate-50/50">
                  <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-white">
                    <div className="text-xs font-semibold text-slate-800">Screens</div>
                    <Button
                      type="button"
                      size="xs"
                      className="h-6 px-2 text-[10px]"
                      onClick={addScreen}
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {previewScreens.map((screen, index) => (
                      <div
                        key={screen.id || index}
                        className={`group flex items-center justify-between rounded-md border px-2 py-2 cursor-pointer ${
                          safeScreenIndex === index
                            ? 'border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 bg-white hover:border-emerald-300'
                        }`}
                        onClick={() => setActiveScreenIndex(index)}
                      >
                        <span className={`text-xs font-medium truncate flex-1 ${safeScreenIndex === index ? 'text-emerald-900' : 'text-slate-700'}`}>
                          {screen.title || `Screen ${index + 1}`}
                        </span>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeScreen(index);
                          }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {previewScreens.length === 0 && (
                      <div className="text-[11px] text-slate-400 p-2 text-center">
                        No screens yet.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col bg-[#F0F2F5] relative">
                  <div className="p-3 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                    <div className="text-xs font-semibold text-slate-800">
                      {activeScreen ? (activeScreen.title || 'Screen') : 'No Screen Selected'}
                    </div>
                    {activeScreen && (
                      <div className="flex gap-2">
                         <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] hover:bg-slate-50 text-slate-600"
                          onClick={() => addComponentToActiveScreen('text_heading')}
                        >
                          + Heading
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] hover:bg-slate-50 text-slate-600"
                          onClick={() => addComponentToActiveScreen('text_body')}
                        >
                          + Body
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] hover:bg-slate-50 text-slate-600"
                          onClick={() => addComponentToActiveScreen('text_input_short')}
                        >
                          + Input
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] hover:bg-slate-50 text-slate-600"
                          onClick={() => addComponentToActiveScreen('selection_single')}
                        >
                          + Select
                        </button>
                        <button
                          type="button"
                          className="px-2 py-1 rounded-md border border-slate-200 bg-white text-[10px] hover:bg-slate-50 text-slate-600"
                          onClick={() => addComponentToActiveScreen('footer')}
                        >
                          + Footer
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {activeScreen ? (
                      <div className="max-w-md mx-auto space-y-4">
                         <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-4">
                           <div className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Screen Content</div>
                           
                           <div className="space-y-1">
                              <label className="text-[10px] font-medium text-slate-500 uppercase">Screen Title</label>
                              <Input
                                value={activeScreen.title || ''}
                                onChange={(e) => updateActiveScreenTitle(e.target.value)}
                                className="h-8 text-xs font-medium"
                                placeholder="Screen title"
                              />
                           </div>

                           <div className="border-t border-slate-100 my-4" />

                           {activeChildren.length === 0 && (
                             <div className="text-center py-8 text-xs text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                               No components. Add one from the toolbar above.
                             </div>
                           )}

                           {activeChildren.map((child, index) => {
                             const isFooter = child && child.type === 'Footer';
                             const isDragging = draggingIndex === index;
                             return (
                               <div
                                 key={index}
                                 className={`group relative flex items-start gap-3 rounded-md p-3 border transition-all ${
                                   isDragging
                                     ? 'border-blue-500 bg-blue-50 shadow-md z-10'
                                     : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                                 }`}
                                 draggable
                                 onDragStart={() => setDraggingIndex(index)}
                                 onDragOver={(e) => {
                                   e.preventDefault();
                                   if (draggingIndex === null || draggingIndex === index) return;
                                   moveComponent(draggingIndex, index);
                                   setDraggingIndex(index);
                                 }}
                                 onDragEnd={() => setDraggingIndex(null)}
                               >
                                 <GripVertical className="w-4 h-4 text-slate-400 mt-1.5 cursor-move flex-shrink-0" />
                                 <div className="flex-1 space-y-2">
                                   <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                                        {child.type === 'TextHeading' ? 'Heading' : 
                                         child.type === 'TextBody' ? 'Body' : 
                                         child.type === 'TextInput' ? 'Input' : 
                                         child.type === 'RadioButtonsGroup' ? 'Selection' : 
                                         child.type === 'Footer' ? 'Footer' : 'Component'}
                                      </span>
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => removeComponent(index)}
                                      >
                                        ×
                                      </button>
                                   </div>
                                   
                                   {(child.type === 'TextHeading' || child.type === 'TextBody') && (
                                      <Textarea
                                        value={child.text || ''}
                                        onChange={(e) =>
                                          updateComponentAt(index, (c) => ({ ...c, text: e.target.value }))
                                        }
                                        className="text-xs min-h-[60px]"
                                        placeholder="Enter text content..."
                                      />
                                   )}
                                   {(child.type === 'TextInput' || child.type === 'RadioButtonsGroup') && (
                                     <div className="space-y-2">
                                      <Input
                                        value={child.label || ''}
                                        onChange={(e) =>
                                          updateComponentAt(index, (c) => ({ ...c, label: e.target.value }))
                                        }
                                        className="h-8 text-xs"
                                        placeholder="Label / Question"
                                      />
                                      {child.type === 'TextInput' && (
                                        <div className="space-y-1 pt-2 border-t border-slate-100">
                                          <div className="text-[10px] font-medium text-slate-500 uppercase">Input Type</div>
                                          <select
                                            value={child['input-type'] || 'text'}
                                            onChange={(e) =>
                                              updateComponentAt(index, (c) => ({ ...c, 'input-type': e.target.value }))
                                            }
                                            className="w-full h-8 text-xs border border-slate-200 rounded px-2 bg-white"
                                          >
                                            <option value="text">Text</option>
                                            <option value="email">Email</option>
                                            <option value="phone">Phone</option>
                                            <option value="number">Number</option>
                                            <option value="date">Date</option>
                                            <option value="time">Time</option>
                                          </select>
                                        </div>
                                      )}
                                      {child.type === 'RadioButtonsGroup' && (
                                        <div className="space-y-2 pt-2 border-t border-slate-100">
                                          <div className="text-[10px] font-medium text-slate-500 uppercase">Options</div>
                                          {(child['data-source'] || []).map((opt, optIdx) => (
                                            <div key={optIdx} className="flex items-center gap-2">
                                              <Input
                                                value={opt.title}
                                                onChange={(e) => {
                                                  const newTitle = e.target.value;
                                                  updateComponentAt(index, (c) => {
                                                    const newSource = [...(c['data-source'] || [])];
                                                    newSource[optIdx] = { ...newSource[optIdx], title: newTitle, id: newTitle.toLowerCase().replace(/\s+/g, '_') };
                                                    return { ...c, 'data-source': newSource };
                                                  });
                                                }}
                                                className="h-7 text-xs flex-1"
                                                placeholder="Option label"
                                              />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  updateComponentAt(index, (c) => {
                                                    const newSource = [...(c['data-source'] || [])];
                                                    newSource.splice(optIdx, 1);
                                                    return { ...c, 'data-source': newSource };
                                                  });
                                                }}
                                                className="text-slate-400 hover:text-red-500 p-1"
                                              >
                                                ×
                                              </button>
                                            </div>
                                          ))}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              updateComponentAt(index, (c) => {
                                                const newSource = [...(c['data-source'] || [])];
                                                newSource.push({ id: `option_${newSource.length + 1}`, title: `Option ${newSource.length + 1}` });
                                                return { ...c, 'data-source': newSource };
                                              });
                                            }}
                                            className="text-[10px] text-blue-600 hover:text-blue-700 font-medium px-1"
                                          >
                                            + Add Option
                                          </button>
                                        </div>
                                      )}
                                     </div>
                                   )}
                                   {isFooter && (
                                      <div className="text-xs text-slate-500 italic">
                                        Standard footer button
                                      </div>
                                   )}
                                 </div>
                               </div>
                             );
                           })}
                         </div>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-400 text-xs">
                        Select a screen to edit
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col bg-slate-100 items-center justify-center p-6 border-l border-slate-200">
                  <div className="w-[300px] bg-white rounded-[2.5rem] border-[8px] border-slate-900 shadow-xl overflow-hidden relative h-[600px] flex flex-col ring-1 ring-black/5">
                    <div className="h-7 bg-slate-900 w-full flex items-center justify-center relative z-20">
                      <div className="w-24 h-4 bg-black rounded-b-xl" />
                    </div>
                    <div className="h-14 bg-[#075E54] flex items-center px-4 gap-3 shadow-md z-10 shrink-0">
                      <div className="w-9 h-9 rounded-full bg-white/20" />
                      <div className="flex-1">
                        <div className="h-2.5 w-24 bg-white/30 rounded mb-1.5" />
                        <div className="h-2 w-16 bg-white/20 rounded" />
                      </div>
                    </div>
                    <div className="flex-1 bg-[#E5DDD5] p-4 overflow-y-auto relative">
                      {/* WhatsApp Background Pattern could go here */}
                      <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                      
                      {!activeScreen && (
                        <div className="h-full flex items-center justify-center text-xs text-slate-500 text-center px-6 relative z-10">
                          <div className="bg-white/80 p-3 rounded-lg shadow-sm backdrop-blur-sm">
                             No screen selected
                          </div>
                        </div>
                      )}
                      {activeScreen && (
                        <div className="bg-white rounded-lg shadow-sm px-4 py-3 max-w-[260px] ml-auto relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                          <div className="text-[10px] text-slate-500 mb-2 font-medium">
                            {activeScreen.title || 'Screen'}
                          </div>
                          {activeScreen.layout && activeScreen.layout.children && activeScreen.layout.children.map((child, idx) => {
                            switch (child.type) {
                              case 'TextHeading':
                                return (
                                  <div key={idx} className="text-sm font-bold text-slate-900 mb-2 leading-tight">
                                    {child.text}
                                  </div>
                                );
                              case 'TextBody':
                                return (
                                  <div key={idx} className="text-xs text-slate-700 whitespace-pre-wrap mb-4 leading-relaxed">
                                    {child.text}
                                  </div>
                                );
                              case 'TextInput':
                                return (
                                  <div key={idx} className="mb-4">
                                    <label className="block text-[10px] text-slate-500 mb-1">{child.label}</label>
                                    <div className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs text-slate-400 bg-white">
                                      Answer...
                                    </div>
                                  </div>
                                );
                              case 'RadioButtonsGroup':
                                return (
                                  <div key={idx} className="mb-4">
                                    <label className="block text-[10px] text-slate-500 mb-1.5">{child.label}</label>
                                    <div className="space-y-1.5">
                                      {(child['data-source'] || []).map((opt) => (
                                        <div key={opt.id} className="flex items-center gap-2">
                                          <div className="w-3 h-3 rounded-full border border-slate-400" />
                                          <span className="text-xs text-slate-700">{opt.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              case 'Footer':
                                return (
                                  <button key={idx} className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white text-xs font-semibold py-2 rounded-full shadow-sm transition-colors mt-2">
                                    {child.label}
                                  </button>
                                );
                              default:
                                return null;
                            }
                          })}
                        </div>
                      )}
                    </div>
                    <div className="h-12 bg-white border-t border-slate-100 flex items-center justify-center gap-6 text-xs text-slate-400 shrink-0">
                      <button
                        type="button"
                        className="p-2 hover:bg-slate-50 rounded-full transition-colors disabled:opacity-30"
                        onClick={() => setActiveScreenIndex((idx) => idx > 0 ? idx - 1 : idx)}
                        disabled={safeScreenIndex <= 0}
                      >
                        {'<'}
                      </button>
                      <span className="font-medium">
                        {previewScreens.length > 0
                          ? `${safeScreenIndex + 1} / ${previewScreens.length}`
                          : '0 / 0'}
                      </span>
                      <button
                        type="button"
                        className="p-2 hover:bg-slate-50 rounded-full transition-colors disabled:opacity-30"
                        onClick={() => setActiveScreenIndex((idx) => previewScreens.length === 0 || idx >= previewScreens.length - 1 ? idx : idx + 1)}
                        disabled={previewScreens.length === 0 || safeScreenIndex >= previewScreens.length - 1}
                      >
                        {'>'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
