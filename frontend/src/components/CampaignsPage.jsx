import React, { useState, useEffect, useCallback } from 'react';
import {
    Plus, Search, Send, Square, Trash2, Eye, ChevronRight, ChevronLeft,
    MessageSquare, Mail, Smartphone, Check, X, Clock, Zap, BarChart2,
    AlertCircle, RefreshCw,
} from 'lucide-react';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import {
    getCampaigns, createCampaign, stopCampaign, deleteCampaign,
    getLabels, getTemplates,
} from '../api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
    draft: { label: 'Draft', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
    scheduled: { label: 'Scheduled', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    running: { label: 'Running', cls: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    completed: { label: 'Completed', cls: 'bg-green-50 text-green-700 border-green-200' },
    stopped: { label: 'Stopped', cls: 'bg-red-50 text-red-600 border-red-200' },
};

function StatusBadge({ status }) {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
            {cfg.label}
        </span>
    );
}

// Extract variables {{1}}, {{2}} from template body text
function extractVarsFromTemplate(template) {
    if (!template) return [];
    const body = template.components?.find(c => c.type === 'BODY');
    if (!body?.text) return [];
    const matches = [...body.text.matchAll(/\{\{(\d+)\}\}/g)];
    return [...new Set(matches.map(m => m[1]))].sort((a, b) => Number(a) - Number(b));
}

function getBodyText(template) {
    if (!template) return '';
    const body = template.components?.find(c => c.type === 'BODY');
    return body?.text || '';
}

function getHeaderComponent(template) {
    if (!template) return null;
    return template.components?.find(c => c.type === 'HEADER');
}

function getFooterText(template) {
    if (!template) return '';
    const f = template.components?.find(c => c.type === 'FOOTER');
    return f?.text || '';
}

function getButtons(template) {
    if (!template) return [];
    const b = template.components?.find(c => c.type === 'BUTTONS');
    return b?.buttons || [];
}

// Available contact fields to map variables to
const CONTACT_FIELDS = [
    { value: 'display_name', label: 'Contact Name' },
    { value: 'external_id', label: 'Phone / External ID' },
];

// ─── WhatsApp Preview ─────────────────────────────────────────────────────────
function WhatsAppPreview({ template, mapping }) {
    if (!template) return null;

    const header = getHeaderComponent(template);
    const bodyText = getBodyText(template);
    const footer = getFooterText(template);
    const buttons = getButtons(template);

    // Replace {{n}} with mapped field labels
    const previewText = bodyText.replace(/\{\{(\d+)\}\}/g, (_, n) => {
        const field = mapping[n];
        const label = CONTACT_FIELDS.find(f => f.value === field)?.label;
        return label ? `[${label}]` : `{{${n}}}`;
    });

    return (
        <div className="bg-[#e5ddd5] rounded-xl p-4 w-full">
            <p className="text-xs text-center text-slate-500 mb-3">WhatsApp Preview</p>
            <div className="max-w-xs mx-auto">
                {/* Chat bubble */}
                <div className="bg-white rounded-xl rounded-tl-none shadow-sm p-3 space-y-2 relative">
                    {/* Header */}
                    {header && header.format === 'TEXT' && (
                        <p className="font-bold text-slate-900 text-sm">{header.text}</p>
                    )}
                    {header && header.format === 'IMAGE' && (
                        <div className="rounded-lg bg-slate-200 h-28 flex items-center justify-center">
                            <span className="text-xs text-slate-400">Image Header</span>
                        </div>
                    )}
                    {/* Body */}
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{previewText || '(no body text)'}</p>
                    {/* Footer */}
                    {footer && <p className="text-xs text-slate-400">{footer}</p>}
                    {/* Timestamp */}
                    <p className="text-right text-[10px] text-slate-400">12:00 PM ✓✓</p>
                </div>
                {/* Buttons */}
                {buttons.map((btn, i) => (
                    <div key={i} className="mt-1 bg-white rounded-lg shadow-sm px-3 py-2 text-center text-sm font-medium text-blue-600">
                        {btn.text}
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── Step Indicator ───────────────────────────────────────────────────────────
function Steps({ current, steps }) {
    return (
        <div className="flex items-center gap-0 mb-6">
            {steps.map((label, i) => {
                const done = i < current;
                const active = i === current;
                return (
                    <React.Fragment key={i}>
                        <div className="flex flex-col items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-colors ${done ? 'bg-blue-600 border-blue-600 text-white' :
                                    active ? 'bg-white border-blue-600 text-blue-600' :
                                        'bg-white border-slate-300 text-slate-400'
                                }`}>
                                {done ? <Check size={14} /> : i + 1}
                            </div>
                            <span className={`mt-1 text-[10px] font-medium whitespace-nowrap ${active ? 'text-blue-600' : done ? 'text-slate-600' : 'text-slate-400'}`}>
                                {label}
                            </span>
                        </div>
                        {i < steps.length - 1 && (
                            <div className={`flex-1 h-0.5 mb-4 mx-1 transition-colors ${done ? 'bg-blue-600' : 'bg-slate-200'}`} />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── New Campaign Multi-Step Modal ────────────────────────────────────────────
const STEP_LABELS = ['Campaign Info', 'Template', 'Variables', 'Schedule'];

function NewCampaignModal({ isOpen, onClose, onSuccess }) {
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Step 0
    const [name, setName] = useState('');
    const [channel, setChannel] = useState('whatsapp');
    const [labelId, setLabelId] = useState('');
    const [labels, setLabels] = useState([]);

    // Step 1
    const [templates, setTemplates] = useState([]);
    const [tmplSearch, setTmplSearch] = useState('');
    const [selectedTmpl, setSelectedTmpl] = useState(null);
    const [loadingTmpls, setLoadingTmpls] = useState(false);

    // Step 2
    const [mapping, setMapping] = useState({}); // { "1": "display_name", ... }

    // Step 3
    const [scheduleMode, setScheduleMode] = useState('now'); // 'now' | 'later'
    const [scheduledAt, setScheduledAt] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setStep(0); setError('');
        setName(''); setChannel('whatsapp'); setLabelId(''); setSelectedTmpl(null);
        setMapping({}); setScheduleMode('now'); setScheduledAt('');

        getLabels().then(r => { if (r.success) setLabels(r.labels); }).catch(console.error);
    }, [isOpen]);

    useEffect(() => {
        if (step !== 1 || channel !== 'whatsapp') return;
        setLoadingTmpls(true);
        getTemplates()
            .then(r => setTemplates(r.data || []))
            .catch(console.error)
            .finally(() => setLoadingTmpls(false));
    }, [step, channel]);

    // Reset mapping when template changes
    useEffect(() => {
        if (!selectedTmpl) return;
        const vars = extractVarsFromTemplate(selectedTmpl);
        const initial = {};
        vars.forEach(v => { initial[v] = CONTACT_FIELDS[0].value; });
        setMapping(initial);
    }, [selectedTmpl]);

    const vars = extractVarsFromTemplate(selectedTmpl);
    const filteredTmpls = templates.filter(t =>
        t.status === 'APPROVED' &&
        t.name.toLowerCase().includes(tmplSearch.toLowerCase())
    );

    // Validation per step
    const canNext = () => {
        if (step === 0) return name.trim() && labelId;
        if (step === 1) return channel !== 'whatsapp' || selectedTmpl;
        if (step === 2) return true;
        return true;
    };

    const handleNext = () => { setError(''); setStep(s => s + 1); };
    const handleBack = () => { setError(''); setStep(s => s - 1); };

    const handleSubmit = async () => {
        setSaving(true); setError('');
        try {
            const res = await createCampaign({
                name,
                channel_type: channel,
                label_id: labelId,
                template_name: selectedTmpl?.name || null,
                template_language: selectedTmpl?.language || 'en_US',
                variable_mapping: mapping,
                scheduled_at: scheduleMode === 'later' ? scheduledAt : null,
                send_immediately: scheduleMode === 'now',
            });
            if (res.success) { onSuccess(res.campaign); onClose(); }
            else setError(res.error || 'Failed to create campaign.');
        } catch {
            setError('Network error. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="New Campaign" className="max-w-3xl">
            <Steps current={step} steps={STEP_LABELS} />

            {/* ── Step 0: Campaign Info ── */}
            {step === 0 && (
                <div className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Campaign Name <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            placeholder="e.g. Diwali Offer 2024"
                            value={name}
                            onChange={e => setName(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Channel <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { id: 'whatsapp', icon: MessageSquare, label: 'WhatsApp', active: true },
                                { id: 'email', icon: Mail, label: 'Email (Soon)', active: false },
                                { id: 'sms', icon: Smartphone, label: 'SMS (Soon)', active: false },
                            ].map(ch => (
                                <button
                                    key={ch.id}
                                    type="button"
                                    disabled={!ch.active}
                                    onClick={() => setChannel(ch.id)}
                                    className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all ${channel === ch.id && ch.active
                                            ? 'border-blue-600 bg-blue-50'
                                            : ch.active
                                                ? 'border-slate-200 hover:border-slate-300 bg-white'
                                                : 'border-slate-100 bg-slate-50 opacity-50 cursor-not-allowed'
                                        }`}
                                >
                                    <ch.icon size={22} className={channel === ch.id ? 'text-blue-600' : 'text-slate-400'} />
                                    <span className={`text-xs font-medium ${channel === ch.id ? 'text-blue-600' : 'text-slate-500'}`}>{ch.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Contact Group <span className="text-red-500">*</span></label>
                        <select
                            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                            value={labelId}
                            onChange={e => setLabelId(e.target.value)}
                        >
                            <option value="">— Select a group —</option>
                            {labels.map(l => (
                                <option key={l.id} value={l.id}>{l.name} ({l.assigned_count} contacts)</option>
                            ))}
                        </select>
                    </div>
                </div>
            )}

            {/* ── Step 1: Template Selection ── */}
            {step === 1 && (
                <div className="space-y-4">
                    {channel !== 'whatsapp' ? (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700">
                            Email and SMS channels are coming soon. Please select WhatsApp to continue.
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                                <Search size={14} className="text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search approved templates..."
                                    className="w-full text-sm bg-transparent outline-none"
                                    value={tmplSearch}
                                    onChange={e => setTmplSearch(e.target.value)}
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                                {loadingTmpls ? (
                                    <p className="text-center text-slate-500 text-sm py-8">Loading templates...</p>
                                ) : filteredTmpls.length === 0 ? (
                                    <p className="text-center text-slate-500 text-sm py-8">No approved templates found.</p>
                                ) : filteredTmpls.map(t => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setSelectedTmpl(t)}
                                        className={`w-full text-left rounded-xl border-2 p-4 transition-all ${selectedTmpl?.id === t.id
                                                ? 'border-blue-600 bg-blue-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'
                                            }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0 flex-1">
                                                <p className="font-semibold text-sm text-slate-900">{t.name}</p>
                                                <p className="text-xs text-slate-500 mt-0.5 capitalize">{t.category} · {t.language}</p>
                                                <p className="text-xs text-slate-600 mt-2 line-clamp-2">{getBodyText(t)}</p>
                                            </div>
                                            {selectedTmpl?.id === t.id && (
                                                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                                                    <Check size={11} className="text-white" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ── Step 2: Variable Mapping + Preview ── */}
            {step === 2 && (
                <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-slate-700">Map Variables to Contact Fields</p>
                        {vars.length === 0 ? (
                            <p className="text-sm text-slate-500 bg-slate-50 rounded-lg p-4">
                                This template has no variables — nothing to map!
                            </p>
                        ) : vars.map(varNum => (
                            <div key={varNum}>
                                <label className="block text-xs font-medium text-slate-600 mb-1.5">
                                    {'{{'}{varNum}{'}}'}
                                </label>
                                <select
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                                    value={mapping[varNum] || ''}
                                    onChange={e => setMapping(m => ({ ...m, [varNum]: e.target.value }))}
                                >
                                    {CONTACT_FIELDS.map(f => (
                                        <option key={f.value} value={f.value}>{f.label}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    <WhatsAppPreview template={selectedTmpl} mapping={mapping} />
                </div>
            )}

            {/* ── Step 3: Schedule ── */}
            {step === 3 && (
                <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                        <button
                            type="button"
                            onClick={() => setScheduleMode('now')}
                            className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all ${scheduleMode === 'now' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <Zap size={28} className={scheduleMode === 'now' ? 'text-blue-600' : 'text-slate-400'} />
                            <div>
                                <p className={`font-semibold text-sm ${scheduleMode === 'now' ? 'text-blue-700' : 'text-slate-700'}`}>Send Now</p>
                                <p className="text-xs text-slate-500 mt-0.5">Campaign will start immediately after creation</p>
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setScheduleMode('later')}
                            className={`flex flex-col items-center gap-3 rounded-xl border-2 p-5 transition-all ${scheduleMode === 'later' ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:border-slate-300'
                                }`}
                        >
                            <Clock size={28} className={scheduleMode === 'later' ? 'text-blue-600' : 'text-slate-400'} />
                            <div>
                                <p className={`font-semibold text-sm ${scheduleMode === 'later' ? 'text-blue-700' : 'text-slate-700'}`}>Schedule</p>
                                <p className="text-xs text-slate-500 mt-0.5">Pick a future date and time</p>
                            </div>
                        </button>
                    </div>

                    {scheduleMode === 'later' && (
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Schedule Date & Time</label>
                            <input
                                type="datetime-local"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                value={scheduledAt}
                                min={new Date().toISOString().slice(0, 16)}
                                onChange={e => setScheduledAt(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Summary */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-sm">
                        <p className="font-medium text-slate-700">Campaign Summary</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span className="text-slate-400">Name</span>        <span className="font-medium text-slate-800">{name}</span>
                            <span className="text-slate-400">Channel</span>     <span className="font-medium capitalize">{channel}</span>
                            <span className="text-slate-400">Group</span>       <span className="font-medium">{labels.find(l => l.id === labelId)?.name || '—'}</span>
                            <span className="text-slate-400">Template</span>    <span className="font-medium">{selectedTmpl?.name || 'None'}</span>
                            <span className="text-slate-400">Schedule</span>    <span className="font-medium">{scheduleMode === 'now' ? 'Immediate' : scheduledAt || 'Not set'}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700 flex items-center gap-2">
                    <AlertCircle size={14} />
                    {error}
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-6 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={step === 0 ? onClose : handleBack}>
                    {step === 0 ? 'Cancel' : <><ChevronLeft size={15} /> Back</>}
                </Button>
                <Button
                    className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5"
                    disabled={!canNext() || saving}
                    onClick={step === STEP_LABELS.length - 1 ? handleSubmit : handleNext}
                >
                    {step === STEP_LABELS.length - 1
                        ? (saving ? 'Launching...' : <><Send size={14} /> Launch Campaign</>)
                        : <>Next <ChevronRight size={15} /></>
                    }
                </Button>
            </div>
        </Modal>
    );
}

// ─── Main Campaigns Page ───────────────────────────────────────────────────────
export default function CampaignsPage() {
    const [campaigns, setCampaigns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showModal, setShowModal] = useState(false);

    const fetchCampaigns = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getCampaigns();
            if (res.success) setCampaigns(res.campaigns);
        } catch (e) { console.error(e); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

    const handleStop = async (id) => {
        if (!window.confirm('Stop this campaign?')) return;
        await stopCampaign(id);
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: 'stopped' } : c));
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Delete this campaign permanently?')) return;
        await deleteCampaign(id);
        setCampaigns(prev => prev.filter(c => c.id !== id));
    };

    const handleSuccess = (campaign) => {
        setCampaigns(prev => [campaign, ...prev]);
    };

    const filtered = campaigns.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.label_name || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50">

            {/* Header */}
            <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="font-semibold text-xl text-slate-800">Campaigns</h1>
                    <p className="text-sm text-slate-500">{campaigns.length} campaigns total</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="flex items-center gap-2" onClick={fetchCampaigns}>
                        <RefreshCw size={15} />
                    </Button>
                    <Button
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                        onClick={() => setShowModal(true)}
                    >
                        <Plus size={16} />
                        New Campaign
                    </Button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-auto">
                <div className="max-w-full mx-auto space-y-4">

                    {/* Search */}
                    <div className="flex items-center max-w-sm bg-white border border-slate-300 rounded-md px-3 py-2 gap-2">
                        <Search size={15} className="text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search campaigns..."
                            className="w-full text-sm outline-none bg-transparent placeholder-slate-400"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Table */}
                    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium whitespace-nowrap text-xs uppercase tracking-wide">
                                    <tr>
                                        <th className="px-5 py-4">Campaign Name</th>
                                        <th className="px-5 py-4">Label</th>
                                        <th className="px-5 py-4">Channel</th>
                                        <th className="px-5 py-4">Status</th>
                                        <th className="px-5 py-4 text-center">Contacts</th>
                                        <th className="px-5 py-4 text-center">Sent</th>
                                        <th className="px-5 py-4 text-center">Delivered</th>
                                        <th className="px-5 py-4">Scheduled</th>
                                        <th className="px-5 py-4">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-16 text-center text-slate-500">Loading campaigns...</td>
                                        </tr>
                                    ) : filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" className="px-6 py-16 text-center">
                                                <div className="flex flex-col items-center gap-3 text-slate-500">
                                                    <BarChart2 size={40} className="text-slate-200" />
                                                    <p className="font-medium">No campaigns yet</p>
                                                    <p className="text-sm text-slate-400">Click "New Campaign" to get started</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : filtered.map(c => (
                                        <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                                            <td className="px-5 py-4">
                                                <div>
                                                    <p className="font-semibold text-slate-900">{c.name}</p>
                                                    <p className="text-xs text-slate-400 mt-0.5">
                                                        {new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                    </p>
                                                </div>
                                            </td>
                                            <td className="px-5 py-4 text-slate-600">{c.label_name || '—'}</td>
                                            <td className="px-5 py-4">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-100 capitalize">
                                                    <MessageSquare size={11} />
                                                    {c.channel_type}
                                                </span>
                                            </td>
                                            <td className="px-5 py-4"><StatusBadge status={c.status} /></td>
                                            <td className="px-5 py-4 text-center font-medium text-slate-700">{c.total_contacts}</td>
                                            <td className="px-5 py-4 text-center font-medium text-slate-700">{c.sent_count}</td>
                                            <td className="px-5 py-4 text-center font-medium text-slate-700">{c.delivered_count}</td>
                                            <td className="px-5 py-4 text-slate-500 text-xs">
                                                {c.scheduled_at
                                                    ? new Date(c.scheduled_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })
                                                    : c.status === 'running' ? 'In progress'
                                                        : c.started_at ? 'Immediate'
                                                            : '—'}
                                            </td>
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-1">
                                                    {c.status === 'running' && (
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => handleStop(c.id)}
                                                            title="Stop Campaign"
                                                        >
                                                            <Square size={14} />
                                                        </Button>
                                                    )}
                                                    <Button
                                                        variant="ghost" size="icon"
                                                        className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50"
                                                        onClick={() => handleDelete(c.id)}
                                                        title="Delete Campaign"
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </div>

            <NewCampaignModal
                isOpen={showModal}
                onClose={() => setShowModal(false)}
                onSuccess={handleSuccess}
            />
        </div>
    );
}
