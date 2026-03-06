import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail, Plus, Trash2, Save, Eye, Download, Upload, GripVertical, Image as ImageIcon, Type, Divide, Link, MousePointer, Code } from 'lucide-react';
import { Button } from './ui/Button';
import { getEmailTemplates, createEmailTemplate, updateEmailTemplate, deleteEmailTemplate } from '../api';

const initialBlocks = [];

function extractVariablesFromHtml(html) {
  const vars = new Set();
  const r = /\{\{([^}]+)\}\}/g;
  let m;
  while ((m = r.exec(html)) !== null) {
    const v = m[1].trim();
    if (v) vars.add(v);
  }
  return Array.from(vars);
}

function compileHtml(design) {
  const blocks = Array.isArray(design?.blocks) ? design.blocks : [];
  const head = `
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    body{margin:0;padding:0;background:#f6f9fc;font-family:Arial,Helvetica,sans-serif}
    .container{max-width:600px;margin:0 auto;background:#ffffff}
    .spacer{height:16px}
    .p{padding:16px}
    .t{font-size:14px;line-height:1.6;color:#1f2937}
    .h{font-size:20px;font-weight:700;color:#111827}
    .btn{display:inline-block;padding:10px 16px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px}
    .center{text-align:center}
    img{max-width:100%;height:auto;display:block;border:0}
    hr{border:none;border-top:1px solid #e5e7eb;margin:0}
  </style>`;
  const parts = [`<!doctype html><html><head>${head}</head><body><div class="container">`];
  blocks.forEach((b) => {
    if (b.type === 'spacer') {
      parts.push(`<div class="spacer" style="height:${b.height || 16}px"></div>`);
    } else if (b.type === 'divider') {
      parts.push(`<hr />`);
    } else if (b.type === 'text') {
      const align = b.align || 'left';
      const size = b.size || 14;
      const color = b.color || '#1f2937';
      parts.push(`<div class="p"><div class="t" style="text-align:${align};font-size:${size}px;color:${color}">${b.html || ''}</div></div>`);
    } else if (b.type === 'heading') {
      const align = b.align || 'left';
      const size = b.size || 20;
      const color = b.color || '#111827';
      parts.push(`<div class="p"><div class="h" style="text-align:${align};font-size:${size}px;color:${color}">${b.html || ''}</div></div>`);
    } else if (b.type === 'image') {
      const url = b.url || '';
      const alt = b.alt || '';
      const align = b.align || 'left';
      parts.push(`<div class="p" style="text-align:${align}"><img src="${url}" alt="${alt}"/></div>`);
    } else if (b.type === 'button') {
      const text = b.text || 'Click';
      const href = b.href || '#';
      const align = b.align || 'left';
      const bg = b.bg || '#2563eb';
      const color = b.color || '#ffffff';
      parts.push(`<div class="p" style="text-align:${align}"><a href="${href}" class="btn" style="background:${bg};color:${color}">${text}</a></div>`);
    } else if (b.type === 'html') {
      parts.push(`${b.html || ''}`);
    }
  });
  parts.push(`</div></body></html>`);
  return parts.join('');
}

export default function EmailTemplatesPage({ startCreate = false }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState(initialBlocks);
  const [dragIndex, setDragIndex] = useState(null);
  const iframeRef = useRef(null);

  const design = useMemo(() => ({ blocks }), [blocks]);
  const html = useMemo(() => compileHtml(design), [design]);
  const variables = useMemo(() => extractVariablesFromHtml(html), [html]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getEmailTemplates();
        if (res && res.success) setTemplates(res.templates || []);
        else setTemplates([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (startCreate) {
      setIsCreating(true);
      setEditing(null);
      setName('');
      setSubject('');
      setBlocks([]);
    }
  }, [startCreate]);

  useEffect(() => {
    if (iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      doc.open();
      doc.write(html);
      doc.close();
    }
  }, [html]);

  const addBlock = (type, preset) => {
    const b = preset || {};
    b.type = type;
    if (type === 'text' && b.html == null) b.html = 'Paragraph';
    if (type === 'heading' && b.html == null) b.html = 'Heading';
    setBlocks((arr) => [...arr, b]);
  };

  const onDragStartPalette = (e, type) => {
    e.dataTransfer.setData('email/blocktype', type);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragOverCanvas = (e) => {
    e.preventDefault();
  };
  const onDropCanvas = (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('email/blocktype');
    if (type) addBlock(type);
  };

  const onRowDragStart = (e, idx) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onRowDragOver = (e, overIdx) => {
    e.preventDefault();
    if (dragIndex == null || dragIndex === overIdx) return;
    setBlocks((arr) => {
      const a = [...arr];
      const [m] = a.splice(dragIndex, 1);
      a.splice(overIdx, 0, m);
      return a;
    });
    setDragIndex(overIdx);
  };
  const onRowDragEnd = () => setDragIndex(null);

  const handleCreate = () => {
    setIsCreating(true);
    setEditing(null);
    setName('');
    setSubject('');
    setBlocks([]);
  };
  const handleEdit = (tpl) => {
    setIsCreating(true);
    setEditing(tpl);
    setName(tpl.name || '');
    setSubject(tpl.subject || '');
    const d = tpl.design || {};
    setBlocks(Array.isArray(d.blocks) ? d.blocks : []);
  };
  const handleDelete = async (tpl) => {
    await deleteEmailTemplate(tpl.id);
    const res = await getEmailTemplates();
    setTemplates(res.templates || []);
    if (editing && editing.id === tpl.id) {
      setIsCreating(false);
      setEditing(null);
    }
  };
  const handleSave = async () => {
    const payload = {
      name,
      subject,
      html_body: html,
      text_body: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
      variables,
      design,
    };
    if (editing) {
      await updateEmailTemplate(editing.id, payload);
    } else {
      await createEmailTemplate(payload);
    }
    const res = await getEmailTemplates();
    setTemplates(res.templates || []);
    setIsCreating(false);
    setEditing(null);
  };

  const updateBlock = (idx, patch) => {
    setBlocks((arr) => {
      const a = [...arr];
      a[idx] = { ...a[idx], ...patch };
      return a;
    });
  };

  const removeBlock = (idx) => {
    setBlocks((arr) => arr.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50">
      <div className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold text-xl text-slate-800">Email Templates</h1>
          {loading && <span className="text-xs text-slate-500">Loading…</span>}
        </div>
        {!isCreating ? (
          <Button variant="outline" className="flex items-center gap-2" onClick={handleCreate}>
            <Plus size={16} />
            Create Template
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { setIsCreating(false); setEditing(null); }}>Back</Button>
            <Button className="flex items-center gap-2" onClick={handleSave}>
              <Save size={16} />
              Save
            </Button>
          </div>
        )}
      </div>

      {!isCreating ? (
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-700">Templates</div>
              </div>
              <div className="divide-y divide-slate-100">
                {templates.map(t => (
                  <div key={t.id} className="p-4 flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                      <div className="text-xs text-slate-500">{t.subject}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(t)}>Edit</Button>
                      <Button variant="outline" size="sm" className="text-red-600" onClick={() => handleDelete(t)}>
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {templates.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">No templates yet</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-hidden flex">
          <div className="w-64 border-r border-slate-200 bg-white p-3 space-y-2">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fields</div>
            <input className="w-full border border-slate-300 rounded-md p-2 text-sm" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="w-full border border-slate-300 rounded-md p-2 text-sm" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-3">Blocks</div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'heading')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-grab hover:border-blue-400">
              <Type size={16} />
              <span className="text-sm">Heading</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'text')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-grab hover:border-blue-400">
              <MousePointer size={16} />
              <span className="text-sm">Text</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'image')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-grab hover:border-blue-400">
              <ImageIcon size={16} />
              <span className="text-sm">Image</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'button')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-grab hover:border-blue-400">
              <Link size={16} />
              <span className="text-sm">Button</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'divider')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-grab hover:border-blue-400">
              <Divide size={16} />
              <span className="text-sm">Divider</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'spacer')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-grab hover:border-blue-400">
              <Divide size={16} />
              <span className="text-sm">Spacer</span>
            </div>
            <div draggable onDragStart={(e) => onDragStartPalette(e, 'html')} className="flex items-center gap-2 p-2 border border-slate-200 rounded-md cursor-grab hover:border-blue-400">
              <Code size={16} />
              <span className="text-sm">HTML</span>
            </div>
            <div className="pt-3">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Variables</div>
              <div className="flex flex-wrap gap-1">
                {variables.map(v => (
                  <span key={v} className="text-[10px] bg-slate-100 border border-slate-200 rounded px-2 py-1">{v}</span>
                ))}
                {variables.length === 0 && <span className="text-[11px] text-slate-400">None</span>}
              </div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 overflow-hidden">
            <div className="border-r border-slate-200 flex flex-col">
              <div className="h-10 px-3 border-b border-slate-100 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">Canvas</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setBlocks([])}>Clear</Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto" onDragOver={onDragOverCanvas} onDrop={onDropCanvas}>
                {blocks.map((b, i) => (
                  <div
                    key={i}
                    className="group relative p-3 border-b border-slate-100 cursor-move"
                    draggable
                    onDragStart={(e) => onRowDragStart(e, i)}
                    onDragOver={(e) => onRowDragOver(e, i)}
                    onDragEnd={onRowDragEnd}
                  >
                    <div className="absolute left-2 top-3 text-slate-300">
                      <GripVertical size={14} />
                    </div>
                    <div className="pl-6">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-slate-700">{b.type}</div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" className="text-red-600" onClick={() => removeBlock(i)}>
                            <Trash2 size={12} />
                            Remove
                          </Button>
                        </div>
                      </div>
                      {b.type === 'heading' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className="border border-slate-300 rounded-md p-2 text-sm col-span-2" value={b.html || ''} onChange={(e) => updateBlock(i, { html: e.target.value })} placeholder="Heading text, supports {{variables}}" />
                          <select className="border border-slate-300 rounded-md p-2 text-sm" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.size || 20} onChange={(e) => updateBlock(i, { size: parseInt(e.target.value, 10) || 20 })} placeholder="Size" />
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.color || '#111827'} onChange={(e) => updateBlock(i, { color: e.target.value })} placeholder="#111827" />
                        </div>
                      )}
                      {b.type === 'text' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <textarea className="border border-slate-300 rounded-md p-2 text-sm col-span-2" rows={4} value={b.html || ''} onChange={(e) => updateBlock(i, { html: e.target.value })} placeholder="Text, supports {{variables}}" />
                          <select className="border border-slate-300 rounded-md p-2 text-sm" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.size || 14} onChange={(e) => updateBlock(i, { size: parseInt(e.target.value, 10) || 14 })} placeholder="Size" />
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.color || '#1f2937'} onChange={(e) => updateBlock(i, { color: e.target.value })} placeholder="#1f2937" />
                        </div>
                      )}
                      {b.type === 'image' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className="border border-slate-300 rounded-md p-2 text-sm col-span-2" value={b.url || ''} onChange={(e) => updateBlock(i, { url: e.target.value })} placeholder="Image URL" />
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.alt || ''} onChange={(e) => updateBlock(i, { alt: e.target.value })} placeholder="Alt text" />
                          <select className="border border-slate-300 rounded-md p-2 text-sm" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      )}
                      {b.type === 'button' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.text || ''} onChange={(e) => updateBlock(i, { text: e.target.value })} placeholder="Button text" />
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.href || ''} onChange={(e) => updateBlock(i, { href: e.target.value })} placeholder="https://..." />
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.bg || '#2563eb'} onChange={(e) => updateBlock(i, { bg: e.target.value })} placeholder="Background" />
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.color || '#ffffff'} onChange={(e) => updateBlock(i, { color: e.target.value })} placeholder="Text color" />
                          <select className="border border-slate-300 rounded-md p-2 text-sm" value={b.align || 'left'} onChange={(e) => updateBlock(i, { align: e.target.value })}>
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </div>
                      )}
                      {b.type === 'spacer' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <input className="border border-slate-300 rounded-md p-2 text-sm" value={b.height || 16} onChange={(e) => updateBlock(i, { height: parseInt(e.target.value, 10) || 16 })} placeholder="Height px" />
                        </div>
                      )}
                      {b.type === 'html' && (
                        <div className="mt-2">
                          <textarea className="border border-slate-300 rounded-md p-2 text-sm w-full" rows={6} value={b.html || ''} onChange={(e) => updateBlock(i, { html: e.target.value })} placeholder="<p>Raw HTML</p>" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {blocks.length === 0 && (
                  <div className="p-8 text-center text-slate-400 text-sm">Drag blocks here</div>
                )}
              </div>
            </div>
            <div className="flex flex-col">
              <div className="h-10 px-3 border-b border-slate-100 flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">Preview</div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    const blob = new Blob([html], { type: 'text/html' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${name || 'template'}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}>
                    <Download size={14} />
                    Download HTML
                  </Button>
                </div>
              </div>
              <div className="flex-1 overflow-auto bg-slate-100 p-6">
                <div className="border border-slate-300 rounded-lg overflow-hidden shadow-sm bg-white">
                  <iframe ref={iframeRef} title="preview" className="w-full h-[700px] bg-white" />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
