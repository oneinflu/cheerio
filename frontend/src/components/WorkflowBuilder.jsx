import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Panel,
  ReactFlowProvider,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from './ui/Button';
import { Save, ArrowLeft, Plus, Clock, MessageSquare, GitBranch, Zap, StopCircle, Loader2, Play, MessageCircle, Code, UserCheck, Tag, Mic, Workflow as WorkflowIcon, Megaphone, Filter, Link, Copy, Check, RefreshCw, Trash2, Globe, Send, ChevronDown, ChevronUp, Image, Video, FileText as FileIcon, Upload, X, Star, CreditCard, BellRing, Bell, Mail, ListChecks, Phone, Download, Settings } from 'lucide-react';const LinkIcon = Link;
import { getTemplates, runWorkflow, aiGenerateWorkflow, getWorkflows, getCampaigns, getWebhookEvents, clearWebhookEvents, fetchMediaLibrary, uploadFlowMedia, createPaymentLink, getLabels, getEmailTemplates, getLeadStages } from '../api';
import { GallerySelectModal } from './GallerySelectModal';
import { connectSocket } from '../socket';

// --- Custom Node Components ---

const NodeWrapper = ({ children, selected, title, icon: Icon, colorClass, status }) => {
  let statusClass = 'bg-white/20 text-white';
  let statusText = '';
  if (status === 'running') { statusClass = 'bg-white/20 text-white'; statusText = 'Running'; }
  else if (status === 'completed') { statusClass = 'bg-emerald-200 text-emerald-800'; statusText = 'Completed'; }
  else if (status === 'waiting') { statusClass = 'bg-yellow-200 text-yellow-800'; statusText = 'Waiting'; }
  else if (status === 'error') { statusClass = 'bg-red-200 text-red-800'; statusText = 'Error'; }

  return (
    <div className={`shadow-md rounded-md bg-white border-2 min-w-[200px] ${selected ? 'border-blue-500' : 'border-slate-200'}`}>
      <div className={`flex items-center px-3 py-2 border-b border-slate-100 ${colorClass} text-white rounded-t-[4px]`}>
        <Icon size={16} className="mr-2" />
        <span className="font-medium text-sm">{title}</span>
        {status && <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusClass}`}>{statusText || status}</span>}
      </div>
      <div className="p-3">
        {children}
      </div>
    </div>
  );
};

const MediaPreview = ({ type, url, fileName }) => {
  if (!type || type === 'none' || !url) return null;

  // Simple check for cloudinary/external URLs that might be variables
  const isVariable = url.startsWith('{{') && url.endsWith('}}');

  return (
    <div className="mb-2 bg-slate-50 border border-slate-200 rounded overflow-hidden">
      {type === 'image' ? (
        isVariable ? (
          <div className="w-full h-20 bg-teal-50 flex items-center justify-center p-2 text-center border-b border-teal-100 italic text-[9px] text-teal-600">
            Image: {url}
          </div>
        ) : (
          <img src={url} alt="preview" className="w-full h-24 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
        )
      ) : type === 'video' ? (
        <div className="w-full h-20 bg-slate-800 flex flex-col items-center justify-center gap-1">
          <Video size={24} className="text-white opacity-60" />
          <span className="text-[8px] text-slate-400 px-2 truncate w-full text-center">
            {isVariable ? url : (fileName || 'Video')}
          </span>
        </div>
      ) : type === 'document' ? (
        <div className="w-full h-20 bg-slate-100 flex flex-col items-center justify-center p-2 text-center">
          <FileIcon size={24} className="text-slate-400 mb-1" />
          <span className="text-[9px] text-slate-500 truncate w-full">
            {isVariable ? url : (fileName || 'Document')}
          </span>
        </div>
      ) : (
        <div className="p-2 flex items-center gap-2">
          <Link size={14} className="text-slate-400" />
          <span className="text-[10px] text-slate-500 truncate">{isVariable ? url : (fileName || url)}</span>
        </div>
      )}
    </div>
  );
};

const TriggerNode = ({ data, selected }) => {
  return (
    <NodeWrapper
      selected={selected}
      title="WhatsApp Incoming"
      icon={MessageSquare}
      colorClass="bg-green-600"
      status={data.nodeStatus}
    >
      <div className="text-xs text-slate-600 mb-2">
        {data.label || 'WhatsApp Keyword Trigger'}
      </div>
      {(data.keywords && data.keywords.trim() !== '') && (
        <div className="text-[10px] text-slate-500 bg-green-50 p-1.5 rounded border border-green-100 mb-1 flex flex-wrap gap-1">
          <span className="font-semibold text-green-700">Keywords:</span>
          {data.keywords.split(',').map((kw, i) => (
            <span key={i} className="bg-white border text-green-700 border-green-200 px-1 rounded truncate max-w-[120px]">
              {kw.trim()}
            </span>
          ))}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const TemplateNode = ({ data, selected }) => {
  const buttons = data.buttons || [];

  return (
    <NodeWrapper selected={selected} title="Send Template" icon={MessageSquare} colorClass="bg-green-600" status={data.nodeStatus}>
      <MediaPreview type={data.headerType} url={data.headerUrl} fileName={data.headerFileName} />
      <div className="text-xs text-slate-600 mb-2 font-medium">Template: <span className="text-green-700">{data.template || 'Select...'}</span></div>

      {/* Template Content Preview */}
      {data.content && (
        <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded mb-2 border border-slate-100 whitespace-pre-wrap break-words leading-relaxed">
          {data.content}
        </div>
      )}

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />

      {/* If template has buttons, render a handle for each button */}
      {buttons.length > 0 ? (
        <div className="space-y-2 mt-2">
          {buttons.map((btnText, idx) => (
            <div key={idx} className="relative flex items-center justify-end">
              <span className="text-[10px] text-slate-500 mr-2 bg-slate-100 px-1 rounded">{btnText}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`button-${idx}`}
                className="w-3 h-3 bg-blue-400 !right-[-6px]"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
        </div>
      ) : (
        /* Default single output if no buttons */
        <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 bg-slate-400" />
      )}
    </NodeWrapper>
  );
};

const DelayNode = ({ data, selected }) => {
  const mode = data.delayMode || (data.targetAt ? 'specific' : 'relative');
  let summary = '';
  if (mode === 'specific' && data.targetAt) {
    const d = new Date(data.targetAt);
    summary = isNaN(d.getTime()) ? '' : `Until: ${d.toLocaleString()}`;
  } else if (typeof data.days === 'number' || typeof data.hours === 'number' || typeof data.minutes === 'number') {
    const days = Number.isFinite(Number(data.days)) ? Number(data.days) : 0;
    const hours = Number.isFinite(Number(data.hours)) ? Number(data.hours) : 0;
    const minutes = Number.isFinite(Number(data.minutes)) ? Number(data.minutes) : 0;
    summary = `Wait: ${days}d ${hours}h ${minutes}m`;
  } else {
    summary = `Wait: ${data.duration || 0} ${data.unit || 'minutes'}`;
  }

  return (
    <NodeWrapper selected={selected} title="Time Delay" icon={Clock} colorClass="bg-orange-500" status={data.nodeStatus}>
      <div className="text-xs text-slate-600"><b>{summary}</b></div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const ConditionNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Condition" icon={GitBranch} colorClass="bg-blue-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-2">{data.condition || 'Configure condition'}</div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1">
        <span>YES</span>
        <span>NO</span>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="w-3 h-3 bg-green-500" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="w-3 h-3 bg-red-500" />
    </NodeWrapper>
  );
};

const AttributeConditionNode = ({ data, selected }) => {
  const groups = Array.isArray(data.groups) ? data.groups : [];
  const total = groups.length + 1;
  return (
    <NodeWrapper selected={selected} title="Custom Attributes" icon={GitBranch} colorClass="bg-violet-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-2">Groups: {groups.length} • Default route</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      {groups.map((g, idx) => (
        <Handle
          key={`g-${idx}`}
          type="source"
          position={Position.Bottom}
          id={`group-${idx}`}
          className="w-3 h-3 bg-emerald-500"
          style={{ left: `${Math.round(((idx + 1) / (total + 1)) * 100)}%` }}
        />
      ))}
      <Handle
        type="source"
        position={Position.Bottom}
        id="default"
        className="w-3 h-3 bg-slate-500"
        style={{ left: `${Math.round(((total) / (total + 1)) * 100)}%` }}
      />
    </NodeWrapper>
  );
};

const SendMessageNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Send Message" icon={MessageCircle} colorClass="bg-teal-500" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-2 truncate max-w-[180px]">{data.message || 'Enter message...'}</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const ResponseMessageNode = ({ data, selected }) => {
  const buttons = data.buttons || [];
  const hasMedia = data.headerType && data.headerType !== 'none';

  return (
    <NodeWrapper selected={selected} title="Response Message" icon={MessageSquare} colorClass="bg-teal-600" status={data.nodeStatus}>
      <MediaPreview type={data.headerType} url={data.headerUrl} fileName={data.headerFileName} />
      <div className="text-xs text-slate-600 mb-2 whitespace-pre-wrap break-words leading-relaxed">
        {data.message || 'Enter message...'}
      </div>

      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />

      {buttons.length > 0 ? (
        <div className="space-y-2 mt-2 pt-2 border-t border-slate-100">
          {buttons.map((btnText, idx) => (
            <div key={idx} className="relative flex items-center justify-end">
              <span className="text-[10px] text-slate-500 mr-2 bg-slate-100 px-1 rounded truncate max-w-[120px]">{btnText}</span>
              <Handle
                type="source"
                position={Position.Right}
                id={`btn-${idx}`}
                className="w-3 h-3 bg-blue-400 !right-[-6px]"
                style={{ top: '50%', transform: 'translateY(-50%)' }}
              />
            </div>
          ))}
          {/* Default branch if user skipReply is true or no reply matches */}
          <div className="relative flex items-center justify-center pt-1 border-t border-slate-100 mt-2">
            <span className="text-[9px] text-slate-400 italic">Default</span>
            <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 bg-slate-400" />
          </div>
        </div>
      ) : (
        <Handle type="source" position={Position.Bottom} id="default" className="w-3 h-3 bg-slate-400" />
      )}
    </NodeWrapper>
  );
};

const FeedbackNode = ({ data, selected }) => {
  const style = data.buttonStyle || 'numbers'; // 'numbers' | 'emojis' | 'stars'

  const getDisplay = (val) => {
    if (style === 'emojis') {
      const emojis = ['😠', '🙁', '😐', '🙂', '😄'];
      return emojis[val - 1] || val;
    }
    if (style === 'stars') {
      return `${val} ⭐`;
    }
    return val;
  };

  return (
    <NodeWrapper selected={selected} title="Feedback" icon={Star} colorClass="bg-yellow-600" status={data.nodeStatus}>
      <div className="text-[10px] text-slate-600 mb-2 italic line-clamp-2">
        "{data.question || 'Your feedback matters! Please rate this chat on scale of 1-5'}"
      </div>
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {[1, 2, 3, 4, 5].map(v => (
          <div key={v} className="bg-yellow-50 border border-yellow-200 rounded px-1.5 py-1 text-[10px] text-yellow-700 whitespace-nowrap min-w-[28px] text-center font-bold">
            {getDisplay(v)}
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeWrapper>
  );
};

const PaymentRequestNode = ({ data, selected }) => {
  const type = data.requestType || 'course';
  return (
    <NodeWrapper selected={selected} title="Payment Request" icon={CreditCard} colorClass="bg-indigo-600" status={data.nodeStatus}>
      <div className="bg-slate-50 -mx-3 -mb-3 p-3 rounded-b-xl border-t border-slate-100">
        <div className="text-[9px] font-black text-indigo-500 uppercase tracking-tighter mb-1 border-b border-indigo-100 pb-1">
          {data.headerText || 'Secure Payment'}
        </div>
        <div className="space-y-1 py-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-700 truncate mr-2">
              {type === 'webinar' ? (data.webinarName || 'Webinar') : (data.course || 'Course')}
            </span>
            <span className="text-[10px] font-black text-emerald-600">₹{data.amount || '0'}</span>
          </div>
          {type === 'course' && data.papers && data.papers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.papers.map(p => (
                <span key={p} className="text-[7px] font-bold bg-white border border-slate-200 text-slate-500 px-1 rounded">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-2 border-t border-slate-200 pt-2 flex items-center justify-center gap-1.5 text-indigo-600 font-bold text-[10px] bg-white rounded-lg py-1.5 shadow-sm border border-slate-100">
          <Link size={10} />
          {data.buttonText || 'Pay Now'}
        </div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </NodeWrapper>
  );
};

const PaymentReminderNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Payment Reminder" icon={BellRing} colorClass="bg-orange-500" status={data.nodeStatus}>
    <div className="space-y-1">
      <div className="text-[10px] text-slate-500 flex items-center gap-1">
        <Clock size={10} />
        <span>Wait: {data.duration || '24'} {data.unit || 'hours'}</span>
      </div>
      <div className="text-[11px] font-bold text-slate-800">Branch on: Paid/Unpaid</div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <div className="h-6 rounded bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[8px] font-bold text-emerald-600 uppercase">PAID</div>
        <div className="h-6 rounded bg-red-50 border border-red-100 flex items-center justify-center text-[8px] font-bold text-red-600 uppercase">UNPAID</div>
      </div>
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="paid" style={{ left: '25%' }} />
    <Handle type="source" position={Position.Bottom} id="unpaid" style={{ left: '75%' }} />
  </NodeWrapper>
);


const CustomCodeNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Custom Code" icon={Code} colorClass="bg-gray-800" status={data.nodeStatus}>
      <div className="text-xs text-slate-600 mb-2 font-mono truncate max-w-[180px]">{data.code || '// Enter code...'}</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const ActionNode = ({ data, selected }) => {
  const isAssign = data.actionType === 'assign_agent';
  const isTag = data.actionType === 'add_tag' || data.actionType === 'remove_tag';
  const isVar = data.actionType === 'set_variable';
  const isWorkflow = data.actionType === 'start_workflow';
  const isStatus = data.actionType === 'update_chat_status';
    const isLeadStage = data.actionType === 'update_lead_stage';

  return (
    <NodeWrapper
      selected={selected}
      title="Action"
        icon={isLeadStage ? ListChecks : isAssign ? UserCheck : isWorkflow ? WorkflowIcon : isTag ? Tag : Plus}
      colorClass="bg-indigo-600"
      status={data.nodeStatus}
    >
      <div className="text-xs text-slate-600 font-medium mb-1">
        {data.actionType === 'assign_agent'
          ? 'Assign Agent'
          : data.actionType === 'add_tag'
            ? 'Add to Label'
            : data.actionType === 'remove_tag'
              ? 'Remove Label'
              : data.actionType === 'set_variable'
                ? 'Update Attribute'
                : data.actionType === 'start_workflow'
                  ? 'Start Workflow'
                  : data.actionType === 'update_chat_status'
                    ? 'Update Chat Status'
                    : data.actionType === 'update_lead_stage'
                      ? 'Update Lead Stage'
                    : 'Action'}
      </div>
      <div className="text-xs text-slate-500 truncate max-w-[180px]">
        {isVar
          ? `${data.variableName || 'Key'} = ${data.variableValue || 'Val'}`
          : isWorkflow
            ? data.targetWorkflowName || 'Select workflow...'
            : isStatus
              ? data.actionValue || 'open'
            : isLeadStage
              ? data.leadStageName || 'Select stage...'
              : data.actionValue || 'Configure...'}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const NotificationNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="Internal Alert" icon={Bell} colorClass="bg-orange-500" status={data.nodeStatus}>
      <div className="text-xs text-slate-500 font-medium mb-1 truncate max-w-[180px]">
        {data.message || 'Configure internal alert...'}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const EndNode = ({ data, selected }) => {
  return (
    <NodeWrapper selected={selected} title="End" icon={StopCircle} colorClass="bg-slate-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-600">End Workflow</div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const CampaignTriggerNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Campaign Sent" icon={Megaphone} colorClass="bg-purple-600" status={data.nodeStatus}>
    <div className="text-xs text-slate-600 mb-1">
      Campaign: <b>{data.campaignName || 'Select campaign...'}</b>
    </div>
    <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
  </NodeWrapper>
);

const COND_COLORS = ['bg-green-500', 'bg-blue-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500'];

const CampaignConditionNode = ({ data, selected }) => {
  const d = data.checkDays || 0;
  const h = data.checkHours || 0;
  const m = data.checkMinutes || 0;
  const isSpecific = data.timingMode === 'specific';
  const timeLabel = isSpecific
    ? (data.specificTime ? `At: ${new Date(data.specificTime).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}` : 'Specific time not set')
    : (d || h || m) ? `After ${d ? d + 'd ' : ''}${h ? h + 'h ' : ''}${m ? m + 'm' : ''}`.trim() : 'Timing not set';
  const conditions = data.conditions || [
    { variable: 'WA message', operator: 'eq', value: 'delivered' }
  ];
  const count = conditions.length;
  return (
    <NodeWrapper selected={selected} title="Campaign Condition" icon={Filter} colorClass="bg-violet-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-500 mb-1.5">{timeLabel}</div>
      <div className="space-y-1 mb-3">
        {conditions.map((cond, i) => (
          <div key={i} className="relative flex items-center justify-between">
            <div className="text-[11px] flex-1 bg-violet-50 border border-violet-100 rounded px-2 py-1 text-violet-800 font-medium pr-5">
              {cond.variable} {cond.operator === 'eq' ? '==' : '!='} <span className="text-violet-600 font-semibold">{cond.value}</span>
            </div>
            <Handle
              type="source"
              position={Position.Right}
              id={`cond-${i}`}
              className={`w-3 h-3 !right-[-6px] ${COND_COLORS[i] || 'bg-slate-400'}`}
              style={{ top: '50%', transform: 'translateY(-50%)', position: 'absolute' }}
            />
          </div>
        ))}
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const IncomingWebhookNode = ({ data, selected }) => {
  const paramCount = data.paramMapping ? Object.keys(data.paramMapping).length : 0;
  return (
    <NodeWrapper selected={selected} title="Incoming Webhook" icon={Link} colorClass="bg-cyan-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-500 mb-1">Trigger: any HTTP POST</div>
      {paramCount > 0 && (
        <div className="text-[11px] bg-cyan-50 border border-cyan-100 rounded px-2 py-1 text-cyan-700">
          {paramCount} param{paramCount > 1 ? 's' : ''} mapped
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const NEW_CONTACT_FIELDS = [
  { key: 'contact_name', label: 'Name', defaultVar: 'name' },
  { key: 'contact_phone', label: 'Phone', defaultVar: 'phone' },
  { key: 'contact_email', label: 'Email', defaultVar: 'email' },
  { key: 'contact_tags', label: 'Tags', defaultVar: 'tags' },
  { key: 'contact_source', label: 'Source', defaultVar: 'source' },
  { key: 'contact_id', label: 'Contact ID', defaultVar: 'contact_id' },
];

const NewContactCreatedNode = ({ data, selected }) => {
  const mappedCount = data.fieldMapping
    ? Object.values(data.fieldMapping).filter(Boolean).length
    : NEW_CONTACT_FIELDS.length;
  return (
    <NodeWrapper selected={selected} title="New Contact Created" icon={UserCheck} colorClass="bg-emerald-600" status={data.nodeStatus}>
      <div className="text-xs text-slate-500 mb-1">Trigger: contact is created</div>
      <div className="text-[11px] bg-emerald-50 border border-emerald-100 rounded px-2 py-1 text-emerald-700">
        {mappedCount} field{mappedCount !== 1 ? 's' : ''} mapped
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-slate-400" />
    </NodeWrapper>
  );
};

const XoloxEventNode = ({ data, selected }) => {
  const fieldCount = Array.isArray(data.payloadFields) ? data.payloadFields.length : 0;
  return (
    <NodeWrapper selected={selected} title={data.eventName || 'XOLOX Event'} icon={Globe} colorClass="bg-orange-600">
      <div className="text-[10px] text-slate-400 mb-1 truncate max-w-[180px]">{data.webhookUrl || 'Set webhook URL...'}</div>
      <div className="flex gap-1 mb-2 flex-wrap">
        {fieldCount > 0 && (
          <span className="text-[10px] bg-orange-50 border border-orange-200 text-orange-700 rounded px-1.5 py-0.5">{fieldCount} field{fieldCount !== 1 ? 's' : ''}</span>
        )}
        <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-500 rounded px-1.5 py-0.5">{data.method || 'POST'}</span>
      </div>
      <div className="flex justify-between text-[10px] font-bold text-slate-500 px-1 mb-0.5">
        <span className="text-green-600">SUCCESS</span>
        <span className="text-red-500">FAIL</span>
      </div>
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-slate-400" />
      <Handle type="source" position={Position.Bottom} id="success" style={{ left: '30%' }} className="w-3 h-3 bg-green-500" />
      <Handle type="source" position={Position.Bottom} id="fail" style={{ left: '70%' }} className="w-3 h-3 bg-red-400" />
    </NodeWrapper>
  );
};

// ─── Proper component so hooks are called at top level (fixes Rules of Hooks) ──
function WebhookNodeConfig({ node, workflowId, updateNodeFields }) {
  const baseUrl = window.location.origin;
  // Validate it's a real UUID (not a name slug)
  const isRealId = workflowId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workflowId);
  const webhookUrl = isRealId
    ? `${baseUrl}/webhooks/workflow/${workflowId}`
    : null;


  const [copied, setCopied] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const [eventError, setEventError] = useState('');

  const copyUrl = () => {
    if (!workflowId) return;
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const fetchLastEvent = async () => {
    if (!workflowId) return;
    setLoadingEvents(true);
    setEventError('');
    try {
      const res = await getWebhookEvents(workflowId);
      if (res.success && res.events.length > 0) {
        const ev = res.events[0];
        setLastEvent(ev);
        const payload = ev.payload || {};
        const existing = node.data.paramMapping || {};
        const merged = { ...existing };
        Object.keys(payload).forEach(k => { if (!(k in merged)) merged[k] = k; });
        updateNodeFields(node.id, { paramMapping: merged, lastPayload: payload });
      } else {
        setLastEvent(null);
        setEventError('No events received yet. Send a test POST to the webhook URL.');
      }
    } catch (e) {
      setEventError('Failed to fetch events: ' + e.message);
    } finally {
      setLoadingEvents(false);
    }
  };

  const clearEvents = async () => {
    if (!workflowId) return;
    await clearWebhookEvents(workflowId);
    setLastEvent(null);
    setEventError('');
  };

  const paramMapping = node.data.paramMapping || {};
  const payloadKeys = lastEvent
    ? Object.keys(lastEvent.payload || {})
    : Object.keys(node.data.lastPayload || {});

  return (
    <div className="space-y-5">

      {/* Webhook URL */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">Webhook URL</label>
        {isRealId ? (
          <>
            <div className="bg-slate-900 rounded-lg px-3 py-2.5 flex items-center gap-2">
              <code className="text-cyan-300 text-[11px] flex-1 break-all leading-snug">{webhookUrl}</code>
              <button type="button" onClick={copyUrl}
                className="shrink-0 text-slate-400 hover:text-white transition-colors">
                {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-1">POST any JSON body to this URL. No auth needed.</p>
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3">
            <p className="text-xs text-amber-700 font-medium">⚠ Save the workflow first to generate the webhook URL.</p>
            <p className="text-[10px] text-amber-500 mt-1">The URL requires the workflow's database ID which is assigned on first save.</p>
          </div>
        )}
      </div>

      {/* Last Received Payload */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">Last Received Payload</label>
          <div className="flex gap-1.5">
            <button type="button" onClick={fetchLastEvent} disabled={loadingEvents || !isRealId}
              className="flex items-center gap-1 text-xs text-cyan-600 hover:text-cyan-800 border border-cyan-200 rounded-md px-2 py-1 hover:bg-cyan-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              {loadingEvents ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />} Fetch
            </button>
            <button type="button" onClick={clearEvents} disabled={!isRealId}
              className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-md px-2 py-1 hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <Trash2 size={11} /> Clear
            </button>
          </div>
        </div>

        {eventError && (
          <div className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-md p-2">{eventError}</div>
        )}
        {lastEvent && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-slate-400">
              Received: {new Date(lastEvent.received_at).toLocaleString('en-IN')}
              {lastEvent.source_ip && ` · from ${lastEvent.source_ip}`}
            </div>
            <pre className="bg-slate-900 text-green-300 text-[10px] rounded-lg p-3 overflow-auto max-h-[180px] leading-relaxed">
              {JSON.stringify(lastEvent.payload, null, 2)}
            </pre>
          </div>
        )}
        {!lastEvent && !eventError && (
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center">
            <div className="text-slate-400 text-xs">No payload received yet</div>
            <div className="text-[10px] text-slate-300 mt-1">Click Fetch after sending a test POST</div>
          </div>
        )}
      </div>

      {/* Parameter Mapping */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Parameter Mapping</label>
        <p className="text-[10px] text-slate-400 mb-2">
          Map each incoming JSON key to a variable name for use in later steps as <code className="bg-slate-100 px-1 rounded">{"{{variable}}"}</code>
        </p>
        {payloadKeys.length > 0 ? (
          <div className="space-y-2">
            {payloadKeys.map(key => (
              <div key={key} className="flex items-center gap-2">
                <div className="flex-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono text-slate-600 truncate">{key}</div>
                <span className="text-slate-400 text-xs shrink-0">→</span>
                <input type="text"
                  className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                  placeholder={key}
                  value={paramMapping[key] || ''}
                  onChange={e => {
                    const next = { ...paramMapping, [key]: e.target.value };
                    updateNodeFields(node.id, { paramMapping: next });
                  }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[10px] text-slate-400 italic">Fetch a payload first — keys will appear here automatically.</div>
        )}
      </div>

      {/* Usage guide */}
      {Object.keys(paramMapping).length > 0 && (
        <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-3 space-y-1">
          <div className="text-xs font-semibold text-cyan-800 mb-1.5">How to use in later nodes</div>
          {Object.entries(paramMapping).filter(([, v]) => v).map(([key, varName]) => (
            <div key={key} className="flex items-center gap-2 text-[11px]">
              <code className="bg-white border border-cyan-200 rounded px-1.5 py-0.5 text-cyan-700 font-mono">{`{{${varName}}}`}</code>
              <span className="text-slate-400">← payload.{key}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TwilioSmsNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Send SMS (Twilio)" icon={MessageSquare} colorClass="bg-red-500" status={data.nodeStatus}>
    <div className="space-y-1.5">
      <div className="text-[10px] text-slate-600 flex items-center gap-1">
        <MessageSquare size={10} className="text-red-500" />
        <span className="font-semibold">To:</span>
        <span className="truncate font-mono">{data.toNumber || '{{contact.phone}}'}</span>
      </div>
      {data.message && (
        <div className="text-[10px] text-slate-500 line-clamp-2 italic">"{data.message}"</div>
      )}
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="sent" style={{ left: '30%' }} />
    <Handle type="source" position={Position.Bottom} id="failed" style={{ left: '70%' }} />
  </NodeWrapper>
);

const TwilioCallNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Voice Call (Twilio)" icon={Phone} colorClass="bg-red-600" status={data.nodeStatus}>
    <div className="space-y-1.5">
      <div className="text-[10px] text-slate-600 flex items-center gap-1">
        <Phone size={10} className="text-red-600" />
        <span className="font-semibold">To:</span>
        <span className="truncate font-mono">{data.toNumber || '{{contact.phone}}'}</span>
      </div>
      {data.record && (
        <span className="inline-block text-[8px] font-bold bg-red-50 text-red-600 border border-red-100 px-1.5 py-0.5 rounded">REC</span>
      )}
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="answered" style={{ left: '25%' }} />
    <Handle type="source" position={Position.Bottom} id="failed" style={{ left: '75%' }} />
  </NodeWrapper>
);

const ExotelCallNode = ({ data, selected }) => (
  <NodeWrapper selected={selected} title="Initiate Call" icon={Phone} colorClass="bg-orange-500" status={data.nodeStatus}>
    <div className="space-y-1.5">
      <div className="text-[10px] text-slate-600 flex items-center gap-1">
        <Phone size={10} className="text-orange-500" />
        <span className="font-semibold">To:</span>
        <span className="truncate font-mono">{data.toNumber || '{{contact.phone}}'}</span>
      </div>
      {data.callerId && (
        <div className="text-[10px] text-slate-500 flex items-center gap-1">
          <span className="font-semibold">From:</span>
          <span className="font-mono">{data.callerId}</span>
        </div>
      )}
      {data.record && (
        <span className="inline-block text-[8px] font-bold bg-orange-50 text-orange-600 border border-orange-100 px-1.5 py-0.5 rounded">REC</span>
      )}
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="answered" style={{ left: '25%' }} />
    <Handle type="source" position={Position.Bottom} id="failed" style={{ left: '75%' }} />
  </NodeWrapper>
);

const nodeTypes = {
  trigger: TriggerNode,
  send_template: TemplateNode,
  delay: DelayNode,
  condition: ConditionNode,
  attribute_condition: AttributeConditionNode,
  send_message: SendMessageNode,
  custom_code: CustomCodeNode,
  action: ActionNode,
  end: EndNode,
  response_message: ResponseMessageNode,
  feedback: FeedbackNode,
  payment_request: PaymentRequestNode,
  payment_reminder: PaymentReminderNode,
  razorpay_link: PaymentRequestNode,
  razorpay_status: PaymentReminderNode,
  campaign_trigger: CampaignTriggerNode,
  campaign_condition: CampaignConditionNode,
  incoming_webhook: IncomingWebhookNode,
  new_contact: NewContactCreatedNode,
  xolox_event: XoloxEventNode,
  notification: NotificationNode,
  exotel_call: ExotelCallNode,
  twilio_sms: TwilioSmsNode,
  twilio_call: TwilioCallNode,
};

const COURSE_PAPERS = {
  'CPA US': [
    { id: 'FAR', name: 'Financial Accounting and Reporting (FAR)' },
    { id: 'REG', name: 'Regulation (REG)' },
    { id: 'BEC', name: 'Business Environment and Concepts (BEC)' },
    { id: 'AUD', name: 'Auditing and Attestation (AUD)' },
    { id: 'ISC', name: 'Information Systems and Controls (ISC)' },
    { id: 'TCP', name: 'Tax Compliance and Planning (TCP)' },
  ],
  'CMA US': [
    { id: 'Part 1', name: 'Part 1: Financial Planning, Performance, and Analytics' },
    { id: 'Part 2', name: 'Part 2: Strategic Financial Management' },
  ],
  'ACCA': [
    {
      level: 'Applied Knowledge', papers: [
        { id: 'BT', name: 'Business and Technology (BT)' },
        { id: 'MA', name: 'Management Accounting (MA)' },
        { id: 'FA', name: 'Financial Accounting (FA)' },
      ]
    },
    {
      level: 'Applied Skills', papers: [
        { id: 'LW', name: 'Corporate and Business Law (LW)' },
        { id: 'PM', name: 'Performance Management (PM)' },
        { id: 'TX', name: 'Taxation (TX)' },
        { id: 'FR', name: 'Financial Reporting (FR)' },
        { id: 'AA', name: 'Audit and Assurance (AA)' },
        { id: 'FM', name: 'Financial Management (FM)' },
      ]
    },
    {
      level: 'Strategic Professional', papers: [
        { id: 'SBL', name: 'Strategic Business Leader (SBL)' },
        { id: 'SBR', name: 'Strategic Business Reporting (SBR)' },
        { id: 'AFM', name: 'Advanced Financial Management (AFM)' },
        { id: 'APM', name: 'Advanced Performance Management (APM)' },
        { id: 'ATX', name: 'Advanced Taxation (ATX)' },
        { id: 'AAA', name: 'Advanced Audit and Assurance (AAA)' },
      ]
    }
  ],
  'EA': [
    { id: 'Part 1', name: 'Part 1: Individuals' },
    { id: 'Part 2', name: 'Part 2: Businesses' },
    { id: 'Part 3', name: 'Part 3: Representation, Practices, and Procedures' },
  ],
};

// --- Helper Functions ---

let nodeIdCounter = 0;
const getId = () => {
  nodeIdCounter += 1;
  return `node_${Date.now()}_${nodeIdCounter}`;
};

const extractTemplatePlaceholders = (bodyText) => {
  if (!bodyText) return [];
  const vars = [];
  const regex = /{{([a-zA-Z0-9_]+)}}/g;
  let match;
  while ((match = regex.exec(bodyText)) !== null) {
    if (!vars.includes(match[1])) vars.push(match[1]);
  }
  return vars;
};

const buildTemplateComponentsPayload = (tmpl, variables, header) => {
  if (!tmpl || !tmpl.bodyText) return [];
  const keys = extractTemplatePlaceholders(tmpl.bodyText);
  const components = [];

  // Header media/text (if template has header format and header provided)
  const headerType = header?.headerType || 'none';
  const headerUrl = header?.headerUrl || '';
  const headerFileName = header?.headerFileName || '';
  const hf = (tmpl && tmpl.headerFormat) ? String(tmpl.headerFormat).toUpperCase() : null; // IMAGE | VIDEO | DOCUMENT | TEXT | null

  if (hf && hf !== 'NONE') {
    if (hf === 'IMAGE' && headerType === 'image' && headerUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'image', image: { link: headerUrl } }],
      });
    } else if (hf === 'VIDEO' && headerType === 'video' && headerUrl) {
      components.push({
        type: 'header',
        parameters: [{ type: 'video', video: { link: headerUrl } }],
      });
    } else if (hf === 'DOCUMENT' && headerType === 'document' && headerUrl) {
      const doc = { link: headerUrl };
      if (headerFileName) doc.filename = headerFileName;
      components.push({
        type: 'header',
        parameters: [{ type: 'document', document: doc }],
      });
    } else if (hf === 'TEXT') {
      // If header text exists (and includes variables), derive from variables map if keys exist
      // Many TEXT headers don't require parameters; skip unless keys indicate placeholders
      const headerKeys = extractTemplatePlaceholders(tmpl.headerText || '');
      if (headerKeys.length > 0) {
        components.push({
          type: 'header',
          parameters: headerKeys.map((k) => ({
            type: 'text',
            text: (variables && variables[k]) || '',
            ...(tmpl.parameterFormat === 'NAMED' ? { parameter_name: k } : {}),
          })),
        });
      }
    }
  }

  // Body parameters
  if (keys.length > 0) {
    const bodyParams = keys.map((k) => {
      const value = (variables && variables[k]) || '';
      const param = {
        type: 'text',
        text: value,
      };
      if (tmpl.parameterFormat === 'NAMED') {
        param.parameter_name = k;
      }
      return param;
    });
    components.push({
      type: 'body',
      parameters: bodyParams,
    });
  }

  return components;
};

/**
 * Centrally manages the collection of all {{variables}} available to a given node
 * by walking backward through the workflow graph (BFS).
 */
const getUpstreamVariables = (targetNodeId, nodes, edges) => {
  const vars = [];
  const visited = new Set();
  const queue = [targetNodeId];

  while (queue.length > 0) {
    const nid = queue.shift();
    if (visited.has(nid)) continue;
    visited.add(nid);

    // Find all edges pointing to this node
    const incomingEdges = edges.filter(e => e.target === nid);
    for (const edge of incomingEdges) {
      const srcNode = nodes.find(n => n.id === edge.source);
      if (!srcNode) continue;

      if (srcNode.type === 'new_contact') {
        const fm = srcNode.data.fieldMapping || {};
        Object.values(fm).forEach(v => {
          if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
        });
        // Core defaults
        ['name', 'phone', 'email', 'tags', 'source', 'contact_id'].forEach(def => {
          if (!vars.includes(`{{${def}}}`)) vars.push(`{{${def}}}`);
        });
      } else if (srcNode.type === 'incoming_webhook') {
        const pm = srcNode.data.paramMapping || {};
        Object.values(pm).forEach(v => {
          if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
        });
      } else if (srcNode.type === 'response_message') {
        // Collect the variable name the user defined to save their choice
        const saveVar = srcNode.data.saveVariable;
        if (saveVar && !vars.includes(`{{${saveVar}}}`)) {
          vars.push(`{{${saveVar}}}`);
        }
      } else if (srcNode.type === 'feedback') {
        const saveVar = srcNode.data.saveVariable;
        if (saveVar && !vars.includes(`{{${saveVar}}}`)) {
          vars.push(`{{${saveVar}}}`);
        }
      } else if (srcNode.type === 'action' && srcNode.data && srcNode.data.actionType === 'set_variable') {
        const varName = srcNode.data.variableName;
        if (varName && !vars.includes(`{{${varName}}}`)) {
          vars.push(`{{${varName}}}`);
        }
      } else if (srcNode.type === 'action' && srcNode.data && srcNode.data.actionType === 'send_sms_otp') {
        const saveVar = srcNode.data.saveVariable;
        if (saveVar && !vars.includes(`{{${saveVar}}}`)) {
          vars.push(`{{${saveVar}}}`);
        }
      }

      // Continue walking backward
      queue.push(edge.source);
    }
  }

  // Fallback defaults if the graph is empty or disconnected
  if (vars.length === 0) {
    ['{{name}}', '{{phone}}', '{{email}}', '{{tags}}', '{{source}}', '{{contact_id}}'].forEach(v => vars.push(v));
  }

  return vars;
};

const getAllDefinedVariables = (nodes) => {
  const vars = [];
  (nodes || []).forEach((n) => {
    if (!n || !n.data) return;
    if (n.type === 'new_contact') {
      const fm = n.data.fieldMapping || {};
      Object.values(fm).forEach((v) => {
        if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
      });
      ['name', 'phone', 'email', 'tags', 'source', 'contact_id'].forEach((def) => {
        if (!vars.includes(`{{${def}}}`)) vars.push(`{{${def}}}`);
      });
    } else if (n.type === 'incoming_webhook') {
      const pm = n.data.paramMapping || {};
      Object.values(pm).forEach((v) => {
        if (v && !vars.includes(`{{${v}}}`)) vars.push(`{{${v}}}`);
      });
    } else if (n.type === 'response_message' || n.type === 'feedback') {
      const saveVar = n.data.saveVariable;
      if (saveVar && !vars.includes(`{{${saveVar}}}`)) vars.push(`{{${saveVar}}}`);
    } else if (n.type === 'action' && n.data.actionType === 'set_variable') {
      const varName = n.data.variableName;
      if (varName && !vars.includes(`{{${varName}}}`)) vars.push(`{{${varName}}}`);
    } else if (n.type === 'action' && n.data.actionType === 'send_sms_otp') {
      const saveVar = n.data.saveVariable;
      if (saveVar && !vars.includes(`{{${saveVar}}}`)) vars.push(`{{${saveVar}}}`);
    }
  });
  if (vars.length === 0) {
    ['{{name}}', '{{phone}}', '{{email}}', '{{tags}}', '{{source}}', '{{contact_id}}'].forEach((v) => vars.push(v));
  }
  return vars;
};

// --- Main Component ---

export default function WorkflowBuilder({ onBack, onSave, initialWorkflow }) {
  const reactFlowWrapper = useRef(null);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow?.steps?.nodes || []);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow?.steps?.edges || []);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loadingEmailTemplates, setLoadingEmailTemplates] = useState(false);
  const [availableWorkflows, setAvailableWorkflows] = useState([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(false);
  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [availableLabels, setAvailableLabels] = useState([]);
  const [loadingLabels, setLoadingLabels] = useState(false);
  const [viewMode, setViewMode] = useState('canvas');
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [expandedNodeId, setExpandedNodeId] = useState(null);
  const [branchTarget, setBranchTarget] = useState(null);
  const [socket, setSocket] = useState(null);

  // Test/Run State
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);
  const [runPhoneNumber, setRunPhoneNumber] = useState('');
  const [isWebhookTestModalOpen, setIsWebhookTestModalOpen] = useState(false);
  const [webhookTestFields, setWebhookTestFields] = useState([{ key: 'phone', value: '' }]);
  const [isWebhookSending, setIsWebhookSending] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceContext, setVoiceContext] = useState(null);
  const [voiceGraph, setVoiceGraph] = useState(null);
  const [voicePreview, setVoicePreview] = useState([]);
  const [isVoiceProcessing, setIsVoiceProcessing] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  // Tracks which XOLOX payload variable input is focused (for chip-click-to-insert)
  const [focusedVarIdx, setFocusedVarIdx] = useState(null);
  // Template media gallery state
  const [showGalleryModal, setShowGalleryModal] = useState(false);
  const [galleryTarget, setGalleryTarget] = useState(null); // 'header' | null
  const [templateFocusedVarKey, setTemplateFocusedVarKey] = useState(null);
  const [isCSVModalOpen, setIsCSVModalOpen] = useState(false);
  const recognitionRef = useRef(null);
  const hasIncomingWebhookTrigger = nodes.some((n) => n && n.type === 'incoming_webhook');

  React.useEffect(() => {
    let styleEl = document.getElementById('workflow-builder-reactflow-style');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'workflow-builder-reactflow-style';
      styleEl.textContent = `
        .react-flow__handle {
          width: 14px;
          height: 14px;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(15, 23, 42, 0.25);
        }
        .react-flow__handle-source { background: #3b82f6; }
        .react-flow__handle-target { background: #64748b; }
        .react-flow__handle-connecting { background: #22c55e; }
        .react-flow__handle-valid { background: #22c55e; }
      `;
      document.head.appendChild(styleEl);
    }
  }, []);

  React.useEffect(() => {
    const s = connectSocket({ userId: null, teamIds: [] });
    setSocket(s);
    const wfId = initialWorkflow?.id;
    let edgeTimer = null;
    const clearEdgeTimer = () => {
      if (edgeTimer) {
        clearTimeout(edgeTimer);
        edgeTimer = null;
      }
    };
    const onStart = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, nodeStatus: undefined, nodeError: undefined } })));
      setSelectedNode((n) => (n ? { ...n, data: { ...n.data, nodeStatus: undefined, nodeError: undefined } } : n));
      setEdges((eds) => eds.map((e) => ({ ...e, animated: false, style: undefined })));
      setIsRunning(true);
    };
    const onStepStart = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === ev.nodeId
            ? { ...n, data: { ...n.data, nodeStatus: 'running', nodeError: undefined, lastContextPreview: ev.contextPreview || n.data.lastContextPreview } }
            : n
        )
      );
      setSelectedNode((n) =>
        n && n.id === ev.nodeId
          ? { ...n, data: { ...n.data, nodeStatus: 'running', nodeError: undefined } }
          : n
      );
    };
    const onStepWait = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) =>
        nds.map((n) => (n.id === ev.nodeId ? { ...n, data: { ...n.data, nodeStatus: 'waiting' } } : n))
      );
      setSelectedNode((n) =>
        n && n.id === ev.nodeId
          ? { ...n, data: { ...n.data, nodeStatus: 'waiting' } }
          : n
      );
    };
    const onStepComplete = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === ev.nodeId
            ? { ...n, data: { ...n.data, nodeStatus: 'completed', nodeError: undefined, lastContextPreview: ev.contextPreview || n.data.lastContextPreview } }
            : n
        )
      );
      setSelectedNode((n) =>
        n && n.id === ev.nodeId
          ? { ...n, data: { ...n.data, nodeStatus: 'completed', nodeError: undefined } }
          : n
      );
    };
    const onStepError = (ev) => {
      if (ev.workflowId !== wfId) return;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === ev.nodeId
            ? { ...n, data: { ...n.data, nodeStatus: 'error', nodeError: ev.message || 'Step failed', lastContextPreview: ev.contextPreview || n.data.lastContextPreview } }
            : n
        )
      );
      setSelectedNode((n) =>
        n && n.id === ev.nodeId
          ? { ...n, data: { ...n.data, nodeStatus: 'error', nodeError: ev.message || 'Step failed' } }
          : n
      );
    };
    const onTransition = (ev) => {
      if (ev.workflowId !== wfId) return;
      const fromId = ev.fromNodeId;
      const toId = ev.toNodeId;
      if (!fromId || !toId) return;
      clearEdgeTimer();
      setEdges((eds) => {
        const hit = eds.find((e) => e.source === fromId && e.target === toId);
        if (!hit) return eds;
        return eds.map((e) =>
          e.id === hit.id
            ? { ...e, animated: true, style: { ...(e.style || {}), stroke: '#22c55e', strokeWidth: 2 } }
            : { ...e, animated: false, style: e.style ? { ...e.style, strokeWidth: 1 } : e.style }
        );
      });
      edgeTimer = setTimeout(() => {
        setEdges((eds) => eds.map((e) => ({ ...e, animated: false, style: e.style ? { ...e.style, strokeWidth: 1 } : e.style })));
      }, 2200);
    };
    const onComplete = (ev) => {
      if (ev.workflowId !== wfId) return;
      setIsRunning(false);
      clearEdgeTimer();
    };
    s.on('workflow:run:start', onStart);
    s.on('workflow:step:start', onStepStart);
    s.on('workflow:step:wait', onStepWait);
    s.on('workflow:step:complete', onStepComplete);
    s.on('workflow:step:error', onStepError);
    s.on('workflow:step:transition', onTransition);
    s.on('workflow:run:complete', onComplete);
    return () => {
      try {
        s.off('workflow:run:start', onStart);
        s.off('workflow:step:start', onStepStart);
        s.off('workflow:step:wait', onStepWait);
        s.off('workflow:step:complete', onStepComplete);
        s.off('workflow:step:error', onStepError);
        s.off('workflow:step:transition', onTransition);
        s.off('workflow:run:complete', onComplete);
        clearEdgeTimer();
        s.disconnect();
      } catch {}
    };
  }, [initialWorkflow, setNodes, setEdges]);

  React.useEffect(() => {
    const fetchTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const res = await getTemplates();
        if (res && res.data) {
          const mapped = res.data
            .filter((t) => t.status === 'APPROVED')
            .map((t) => {
              const bodyComp = t.components && t.components.find((c) => c.type === 'BODY');
              const buttonsComp = t.components && t.components.find((c) => c.type === 'BUTTONS');
              const headerComp = t.components && t.components.find((c) => c.type === 'HEADER');
              const examples = {};
              if (bodyComp && bodyComp.example) {
                if (t.parameter_format === 'NAMED' && bodyComp.example.body_text_named_params) {
                  bodyComp.example.body_text_named_params.forEach((p) => {
                    examples[p.param_name] = p.example;
                  });
                } else if (bodyComp.example.body_text && Array.isArray(bodyComp.example.body_text[0])) {
                  bodyComp.example.body_text[0].forEach((ex, i) => {
                    examples[(i + 1).toString()] = ex;
                  });
                }
              }
              return {
                id: t.id,
                name: t.name,
                language: t.language,
                status: t.status,
                category: t.category,
                bodyText: bodyComp ? bodyComp.text : '',
                buttons: buttonsComp ? buttonsComp.buttons : [],
                parameterFormat: t.parameter_format || 'POSITIONAL',
                headerFormat: headerComp ? (headerComp.format || 'NONE') : 'NONE',
                headerText: headerComp && headerComp.text ? headerComp.text : '',
                examples,
              };
            });
          setTemplates(mapped);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      } finally {
        setLoadingTemplates(false);
      }
    };
    fetchTemplates();
  }, []);

  React.useEffect(() => {
    const fetchWorkflows = async () => {
      setLoadingWorkflows(true);
      try {
        const res = await getWorkflows();
        if (Array.isArray(res)) {
          const filtered =
            initialWorkflow && initialWorkflow.id
              ? res.filter((w) => w.id !== initialWorkflow.id)
              : res;
          setAvailableWorkflows(filtered);
        } else {
          setAvailableWorkflows([]);
        }
      } catch (err) {
        console.error('Failed to load workflows:', err);
        setAvailableWorkflows([]);
      } finally {
        setLoadingWorkflows(false);
      }
    };
    fetchWorkflows();
  }, [initialWorkflow]);

  React.useEffect(() => {
    getCampaigns()
      .then(res => { if (res.success) setAvailableCampaigns(res.campaigns || []); })
      .catch(console.error);
  }, []);

  React.useEffect(() => {
    const fetchLabels = async () => {
      setLoadingLabels(true);
      try {
        const res = await getLabels();
        if (res && res.success) setAvailableLabels(res.labels || []);
        else setAvailableLabels([]);
      } catch (e) {
        console.error('Failed to load labels:', e);
        setAvailableLabels([]);
      } finally {
        setLoadingLabels(false);
      }
    };
    fetchLabels();
  }, []);

  React.useEffect(() => {
    const fetchEmailTemplates = async () => {
      setLoadingEmailTemplates(true);
      try {
        const res = await getEmailTemplates();
        if (res && res.success) setEmailTemplates(res.templates || []);
        else setEmailTemplates([]);
      } catch (e) {
        console.error('Failed to load email templates:', e);
        setEmailTemplates([]);
      } finally {
        setLoadingEmailTemplates(false);
      }
    };
    fetchEmailTemplates();
  }, []);

  const [availableLeadStages, setAvailableLeadStages] = useState([]);
  const [loadingLeadStages, setLoadingLeadStages] = useState(false);
  React.useEffect(() => {
    const fetchLeadStages = async () => {
      setLoadingLeadStages(true);
      try {
        const res = await getLeadStages();
        if (res && Array.isArray(res.stages)) setAvailableLeadStages(res.stages);
        else setAvailableLeadStages([]);
      } catch (e) {
        console.error('Failed to load lead stages:', e);
        setAvailableLeadStages([]);
      } finally {
        setLoadingLeadStages(false);
      }
    };
    fetchLeadStages();
  }, []);
  const handleAddNotificationAction = useCallback(() => {
    const newNode = {
      id: `notification_${Math.random().toString(36).substr(2, 9)}`,
      type: 'notification',
      position: { x: 500, y: 300 },
      data: { message: 'Alert team!' },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [setNodes]);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow');
      const actionType = event.dataTransfer.getData('application/actiontype');

      // check if the dropped element is valid
      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: getId(),
        type,
        position,
        data: { label: `${type} node` },
      };

      if (type === 'action' && actionType) {
        newNode.data.actionType = actionType;
        if (actionType === 'update_chat_status') {
          newNode.data.actionValue = 'open';
        }
        if (actionType === 'add_to_label') {
          newNode.data.actionValue = '';
        }
        if (actionType === 'update_lead_stage') {
          newNode.data.actionValue = '';
          newNode.data.leadStageName = '';
        }
        if (actionType === 'start_workflow') {
          newNode.data.actionValue = '';
          newNode.data.targetWorkflowName = '';
        }
        if (actionType === 'send_email') {
          newNode.data.actionValue = '';
          newNode.data.emailTemplateId = '';
          newNode.data.variableMapping = {};
          newNode.data.toVarKey = 'email';
        }
        if (actionType === 'send_sms_otp') {
          newNode.data.actionValue = '';
          newNode.data.otpDigits = 6;
          newNode.data.saveVariable = 'otp';
        }
      }
      if (type === 'trigger') {
        newNode.data = {
          label: 'WhatsApp Incoming',
          triggerType: 'incoming_whatsapp',
          keywords: '',
        };
      }
      if (type === 'campaign_trigger') {
        newNode.data = {
          label: 'Campaign Sent',
          triggerType: 'campaign_sent',
          campaignId: '',
          campaignName: '',
        };
      }
      if (type === 'incoming_webhook') {
        newNode.data = {
          label: 'Incoming Webhook',
          triggerType: 'incoming_webhook',
          paramMapping: {},
          lastPayload: null,
        };
      }
      if (type === 'new_contact') {
        const defaultMapping = {};
        NEW_CONTACT_FIELDS.forEach((f) => {
          defaultMapping[f.key] = f.defaultVar;
        });
        newNode.data = {
          label: 'New Contact Created',
          triggerType: 'new_contact_created',
          fieldMapping: defaultMapping,
        };
      }
      if (type === 'send_template') {
        newNode.data = {
          label: 'Send Template',
          template: '',
          languageCode: 'en_US',
          variables: {},
          components: [],
          buttons: [],
          headerType: 'none',
          headerUrl: '',
          headerFileName: '',
        };
      }
      if (type === 'send_message') {
        newNode.data = {
          label: 'Send Message',
          message: '',
        };
      }
      if (type === 'response_message') {
        newNode.data = {
          label: 'Response Message',
          message: '',
          buttons: [],
          skipReply: false,
          saveVariable: '',
          headerType: 'none',
          headerUrl: '',
          headerFileName: '',
        };
      }
      if (type === 'feedback') {
        newNode.data = {
          label: 'Feedback Collection',
          question: 'Your feedback matters! Please rate this chat on scale of 1-5',
          buttonStyle: 'numbers',
        };
      }
      if (type === 'xolox_event') {
        newNode.data = {
          label: 'XOLOX Event',
          eventName: 'Lead Create',
          webhookUrl: '',
          method: 'POST',
          payloadFields: [
            { field: 'name', variable: '{{name}}' },
            { field: 'phone', variable: '{{phone}}' },
            { field: 'email', variable: '{{email}}' },
            { field: 'source', variable: '{{source}}' },
          ],
          successCondition: 'status_2xx',
          successField: '',
          successValue: 'true',
        };
      }
      if (type === 'notification') {
        newNode.data = { message: 'Alert team!' };
      }
      if (type === 'payment_request' || type === 'razorpay_link') {
        newNode.data = {
          label: type === 'razorpay_link' ? 'Razorpay Link' : 'Payment Request',
          requestType: 'course',
          amount: '15000',
          course: 'CPA US',
          papers: ['FAR'],
          packageName: 'Full Course',
          validityTerms: '12 Months',
          paymentSummary: 'Standard course enrollment fee',
          headerText: '💳 Secure Payment Request',
          buttonText: 'Pay Now',
          footerText: 'Official Razorpay link',
        };
      }
      if (type === 'payment_reminder' || type === 'razorpay_status') {
        newNode.data = {
          label: type === 'razorpay_status' ? 'Razorpay Status' : 'Payment Reminder',
          duration: '24',
          unit: 'hours'
        };
      }
      if (type === 'twilio_sms') {
        newNode.data = { label: 'Send SMS', toNumber: '{{contact.phone}}', message: '' };
      }
      if (type === 'twilio_call') {
        newNode.data = { label: 'Voice Call', toNumber: '{{contact.phone}}', fromNumber: '', record: false };
      }
      if (type === 'exotel_call') {
        newNode.data = {
          label: 'Initiate Call',
          toNumber: '{{contact.phone}}',
          callerId: '',
          record: false,
        };
      }
      if (type === 'delay') {
        newNode.data.label = 'Time Delay';
        newNode.data.delayMode = 'relative';
        newNode.data.days = 0;
        newNode.data.hours = 0;
        newNode.data.minutes = 0;
        newNode.data.targetAt = null;
      }
      if (type === 'attribute_condition') {
        newNode.data = {
          label: 'Custom Attributes',
          groups: [
            {
              id: 'g1',
              clauses: [
                { key: '', op: 'eq', value: '', join: 'AND' }
              ]
            }
          ]
        };
      }

      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes]
  );

  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const syncGraphFromList = useCallback(() => {
    setNodes((nds) => {
      const sorted = [...nds].sort((a, b) => {
        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
        return ay - by;
      });

      const messageTypes = ['send_template', 'send_message'];

      const newNodes = [];

      for (let i = 0; i < sorted.length; i++) {
        const node = sorted[i];
        newNodes.push(node);

        if (messageTypes.includes(node.type) && !(node.data && node.data.branchConditionId)) {
          const data = node.data || {};
          const scheduleType = data.scheduleType || 'immediate';
          const delayValue = data.delayValue ?? null;

          if (scheduleType === 'delay' && delayValue && delayValue > 0) {
            const prevNode = i > 0 ? sorted[i - 1] : null;
            if (!prevNode) continue;

            const delayId = `delay_${node.id}`;
            let delayNode = sorted.find((n) => n.id === delayId);

            if (!delayNode) {
              const baseY =
                prevNode.position && typeof prevNode.position.y === 'number'
                  ? prevNode.position.y
                  : 0;
              delayNode = {
                id: delayId,
                type: 'delay',
                position: {
                  x:
                    prevNode.position && typeof prevNode.position.x === 'number'
                      ? prevNode.position.x
                      : 0,
                  y: baseY + 60,
                },
                data: {
                  label: 'Delay',
                  duration: data.delayValue,
                  unit: data.delayUnit || 'minutes',
                },
              };
            } else {
              delayNode = {
                ...delayNode,
                data: {
                  ...(delayNode.data || {}),
                  duration: data.delayValue,
                  unit: data.delayUnit || delayNode.data?.unit || 'minutes',
                },
              };
            }

            newNodes.push(delayNode);
          }
        }
      }

      const finalNodes = newNodes.filter((n) => {
        if (n.type !== 'delay') return true;
        if (!n.id.startsWith('delay_')) return true;
        const targetId = n.id.replace('delay_', '');
        const targetNode = newNodes.find((nn) => nn.id === targetId);
        const data = targetNode?.data || {};
        return data.scheduleType === 'delay' && data.delayValue && data.delayValue > 0;
      });

      const linear = [...finalNodes].sort((a, b) => {
        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
        return ay - by;
      });

      const positionedMap = {};
      linear.forEach((node, index) => {
        const x =
          node.position && typeof node.position.x === 'number'
            ? node.position.x
            : 0;
        positionedMap[node.id] = {
          x,
          y: index * 140,
        };
      });

      const positionedNodes = finalNodes.map((node) => {
        const pos = positionedMap[node.id];
        if (!pos) return node;
        return {
          ...node,
          position: pos,
        };
      });

      const byId = {};
      positionedNodes.forEach((n) => {
        byId[n.id] = n;
      });

      const topLevel = positionedNodes.filter((n) => !(n.data && n.data.branchConditionId));

      const nextEdges = [];

      for (let i = 0; i < topLevel.length - 1; i++) {
        const source = topLevel[i];
        const target = topLevel[i + 1];
        if (source.type === 'end') continue;
        if (source.type === 'condition') continue;
        nextEdges.push({
          id: `e_${source.id}_${target.id}`,
          source: source.id,
          target: target.id,
        });
      }

      const branchMap = {};
      positionedNodes.forEach((n) => {
        const data = n.data || {};
        const condId = data.branchConditionId;
        const side = data.branchSide;
        if (condId && (side === 'yes' || side === 'no')) {
          if (!branchMap[condId]) branchMap[condId] = { yes: [], no: [] };
          branchMap[condId][side].push(n);
        }
      });

      Object.keys(branchMap).forEach((condId) => {
        const condNode = byId[condId];
        if (!condNode) return;
        const branches = branchMap[condId];
        ['yes', 'no'].forEach((side) => {
          const children = branches[side]
            .slice()
            .sort((a, b) => {
              const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
              const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
              return ay - by;
            });
          if (children.length === 0) return;
          const first = children[0];
          nextEdges.push({
            id: `e_${condId}_${side}_${first.id}`,
            source: condId,
            sourceHandle: side,
            target: first.id,
          });
          for (let i = 0; i < children.length - 1; i++) {
            const s = children[i];
            const t = children[i + 1];
            nextEdges.push({
              id: `e_${s.id}_${t.id}`,
              source: s.id,
              target: t.id,
            });
          }
        });
      });

      const uniqueEdges = [];
      const seenEdgeKey = new Set();

      nextEdges.forEach((edge) => {
        const srcNode = byId[edge.source];
        const srcType = srcNode && srcNode.type;
        const isCondition = srcType === 'condition';
        const isTemplateWithButtons =
          srcType === 'send_template' &&
          srcNode &&
          Array.isArray(srcNode.data?.buttons) &&
          srcNode.data.buttons.length > 0;

        const key = `${edge.source}-${edge.sourceHandle || ''}`;

        if (isCondition || isTemplateWithButtons) {
          uniqueEdges.push(edge);
        } else {
          if (seenEdgeKey.has(key)) {
            return;
          }
          seenEdgeKey.add(key);
          uniqueEdges.push(edge);
        }
      });

      setEdges(uniqueEdges);
      return positionedNodes;
    });
  }, [setNodes, setEdges]);
  
  // --- CSV Helpers ---
  const downloadCSV = (rows, filename) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map(row => headers.map(h => {
        let val = row[h] === undefined ? '' : row[h];
        if (typeof val === 'object') val = JSON.stringify(val);
        // Escape quotes
        val = String(val).replace(/"/g, '""');
        return `"${val}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
    return lines.slice(1).filter(l => l.trim()).map(line => {
      // Simple regex for CSV parsing that handles quotes
      const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
      const row = {};
      headers.forEach((h, i) => {
        let val = values[i] || '';
        val = val.replace(/^"|"$/g, '').replace(/""/g, '"');
        row[h] = val;
      });
      return row;
    });
  };

  const handleDownloadFull = () => {
    const rows = [];
    
    // Add Nodes
    nodes.forEach(n => {
      rows.push({
        entry_type: 'node',
        id: n.id,
        type: n.type,
        label: n.data?.label || '',
        x: n.position?.x || 0,
        y: n.position?.y || 0,
        source: '',
        target: '',
        sourceHandle: '',
        targetHandle: '',
        data: JSON.stringify(n.data || {})
      });
    });

    // Add Edges
    edges.forEach(e => {
      rows.push({
        entry_type: 'edge',
        id: e.id,
        type: '',
        label: '',
        x: '',
        y: '',
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle || '',
        targetHandle: e.targetHandle || '',
        data: ''
      });
    });

    if (rows.length === 0) {
      alert("Workflow is empty. Add some nodes first.");
      return;
    }
    
    downloadCSV(rows, 'workflow_full.csv');
  };

  const handleUploadFull = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const rows = parseCSV(event.target.result);
        const nextNodes = [];
        const nextEdges = [];

        rows.forEach(row => {
          if (row.entry_type === 'node') {
            nextNodes.push({
              id: row.id || getId(),
              type: row.type || 'send_message',
              position: { x: parseFloat(row.x || 0), y: parseFloat(row.y || 0) },
              data: row.data ? JSON.parse(row.data) : { label: row.label }
            });
          } else if (row.entry_type === 'edge') {
            nextEdges.push({
              id: row.id || `e_${row.source}_${row.target}`,
              source: row.source,
              target: row.target,
              sourceHandle: row.sourceHandle || undefined,
              targetHandle: row.targetHandle || undefined
            });
          }
        });

        if (nextNodes.length === 0) {
          alert("No nodes found in the CSV. Please check the 'entry_type' column.");
          return;
        }

        setNodes(nextNodes);
        setEdges(nextEdges);
        alert(`Successfully imported ${nextNodes.length} nodes and ${nextEdges.length} edges.`);
      } catch (err) {
        console.error(err);
        alert('Failed to parse Full Workflow CSV. Ensure JSON in the "data" column is valid.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset
  };

  const handleListItemDragStart = (event, nodeId) => {
    setDraggingNodeId(nodeId);
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleListItemDragOver = (event) => {
    event.preventDefault();
  };

  const handleListItemDrop = (event, targetNodeId) => {
    event.preventDefault();
    if (!draggingNodeId || draggingNodeId === targetNodeId) return;
    setNodes((nds) => {
      const ordered = [...nds].sort((a, b) => {
        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
        return ay - by;
      });
      const fromIndex = ordered.findIndex((n) => n.id === draggingNodeId);
      const toIndex = ordered.findIndex((n) => n.id === targetNodeId);
      if (fromIndex === -1 || toIndex === -1) return nds;
      const updated = [...ordered];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      const reordered = updated.map((node, index) => {
        const x = node.position && typeof node.position.x === 'number' ? node.position.x : 0;
        return {
          ...node,
          position: {
            x,
            y: index * 120,
          },
        };
      });
      return reordered;
    });
    syncGraphFromList();
    setDraggingNodeId(null);
  };

  const handleListItemDragEnd = () => {
    setDraggingNodeId(null);
  };

  const handleAddNodeFromPalette = useCallback(
    (type, actionType) => {
      let createdNode = null;
      setNodes((nds) => {
        const yValues = nds.map((n) =>
          n.position && typeof n.position.y === 'number' ? n.position.y : 0
        );
        const maxY = yValues.length > 0 ? Math.max(...yValues) : 0;
        let position = {
          x: 0,
          y: yValues.length > 0 ? maxY + 120 : 0,
        };

        let data = { label: `${type} node` };

        if (type === 'action' && actionType) {
          data.actionType = actionType;
          if (actionType === 'update_chat_status') {
            data.actionValue = 'open';
          }
          if (actionType === 'add_to_label') {
            data.actionValue = '';
          }
          if (actionType === 'update_lead_stage') {
            data.actionValue = '';
            data.leadStageName = '';
          }
          if (actionType === 'send_email') {
            data.actionValue = '';
            data.emailTemplateId = '';
            data.variableMapping = {};
            data.toVarKey = 'email';
          }
          if (actionType === 'send_sms_otp') {
            data.actionValue = '';
            data.otpDigits = 6;
            data.saveVariable = 'otp';
          }
        }
        if (type === 'delay') {
          data = {
            label: 'Time Delay',
            delayMode: 'relative',
            days: 0,
            hours: 0,
            minutes: 0,
            targetAt: null,
          };
        }

        if (
          viewMode === 'list' &&
          branchTarget &&
          (type === 'send_template' || type === 'send_message')
        ) {
          const condNode = nds.find((n) => n.id === branchTarget.conditionId);
          if (condNode && condNode.position) {
            position = {
              x: condNode.position.x,
              y: condNode.position.y + 140,
            };
          }
          data = {
            ...data,
            branchConditionId: branchTarget.conditionId,
            branchSide: branchTarget.side,
          };
        }

        createdNode = {
          id: getId(),
          type,
          position,
          data,
        };
        const newNodes = [...nds, createdNode];
        return newNodes;
      });
      if (createdNode) {
        setSelectedNode(createdNode);
      }
      if (viewMode === 'list') {
        syncGraphFromList();
      }
    },
    [setNodes, syncGraphFromList, viewMode, branchTarget]
  );

  // Drop BOTH campaign_trigger + campaign_condition pre-wired
  const handleAddCampaignTrigger = useCallback(() => {
    const triggerId = getId();
    const conditionId = getId();
    const triggerNode = {
      id: triggerId,
      type: 'campaign_trigger',
      position: { x: 0, y: 0 },
      data: { label: 'Campaign Sent', triggerType: 'campaign_sent', campaignId: '', campaignName: '' },
    };
    const conditionNode = {
      id: conditionId,
      type: 'campaign_condition',
      position: { x: 0, y: 160 },
      data: {
        label: 'Campaign Condition',
        timingMode: 'after',  // 'after' | 'specific'
        checkDays: 0,
        checkHours: 24,
        checkMinutes: 0,
        specificTime: '',
        conditions: [
          { variable: 'WA message', operator: 'eq', value: 'delivered' },
        ],
      },
    };
    const edge = {
      id: `e_${triggerId}_${conditionId}`,
      source: triggerId,
      target: conditionId,
    };
    setNodes(nds => [...nds, triggerNode, conditionNode]);
    setEdges(eds => [...eds, edge]);
    setSelectedNode(triggerNode);
  }, [setNodes, setEdges]);

  // Drop a single incoming_webhook trigger node
  const handleAddWebhookTrigger = useCallback(() => {
    const nodeId = getId();
    const webhookNode = {
      id: nodeId,
      type: 'incoming_webhook',
      position: { x: 0, y: 0 },
      data: {
        label: 'Incoming Webhook',
        triggerType: 'incoming_webhook',
        paramMapping: {},   // { payloadKey: 'variableName' }
        lastPayload: null,
      },
    };
    setNodes(nds => [...nds, webhookNode]);
    setSelectedNode(webhookNode);
  }, [setNodes]);

  // Drop a new_contact trigger node with default field mapping pre-filled
  const handleAddNewContactTrigger = useCallback(() => {
    const nodeId = getId();
    const defaultMapping = {};
    NEW_CONTACT_FIELDS.forEach(f => { defaultMapping[f.key] = f.defaultVar; });
    const newContactNode = {
      id: nodeId,
      type: 'new_contact',
      position: { x: 0, y: 0 },
      data: {
        label: 'New Contact Created',
        triggerType: 'new_contact_created',
        fieldMapping: defaultMapping,
      },
    };
    setNodes(nds => [...nds, newContactNode]);
    setSelectedNode(newContactNode);
  }, [setNodes]);

  // Add a XOLOX Event node — action with YES/NO output branches
  const handleAddXoloxEvent = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'xolox_event',
      position: { x: 0, y: 160 },
      data: {
        label: 'XOLOX Event',
        eventName: 'Lead Create',
        webhookUrl: '',
        method: 'POST',
        // Array of { field: string, variable: string } — field = key XOLOX expects, variable = {{var}} to inject
        payloadFields: [
          { field: 'name', variable: '{{name}}' },
          { field: 'phone', variable: '{{phone}}' },
          { field: 'email', variable: '{{email}}' },
          { field: 'source', variable: '{{source}}' },
        ],
        // How to judge success: 'status_2xx' | 'field_true'
        successCondition: 'status_2xx',
        successField: '',      // e.g. 'success' when condition is field_true
        successValue: 'true',  // value to compare against
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  // Create a clean send_template action node (with header/variable slots)
  const handleAddSendTemplateAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'send_template',
      position: { x: 0, y: 200 },
      data: {
        label: 'Send Template',
        template: '',
        languageCode: 'en_US',
        variables: {},
        components: [],
        buttons: [],
        headerType: 'none',  // 'none' | 'image' | 'video' | 'document'
        headerUrl: '',
        headerFileName: '',
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddResponseMessageAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'response_message',
      position: { x: 0, y: 200 },
      data: {
        label: 'Response Message',
        message: '',
        buttons: [],
        skipReply: false,
        saveVariable: '',
        headerType: 'none',
        headerUrl: '',
        headerFileName: '',
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddFeedbackAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'feedback',
      position: { x: 0, y: 200 },
      data: {
        label: 'Feedback Collection',
        question: 'Your feedback matters! Please rate this chat on scale of 1-5',
        buttonStyle: 'numbers', // 'numbers', 'emojis', 'stars'
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddPaymentRequestAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'payment_request',
      position: { x: 0, y: 300 },
      data: {
        label: 'Payment Request',
        requestType: 'course',
        amount: '15000',
        course: 'CPA US',
        papers: ['FAR'],
        packageName: 'Full Course',
        validityTerms: '12 Months',
        paymentSummary: 'Standard course enrollment fee',
        headerText: '💳 Secure Payment Request',
        buttonText: 'Pay Now',
        footerText: 'Official Razorpay link'
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddExotelCallAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'exotel_call',
      position: { x: 0, y: 400 },
      data: {
        label: 'Initiate Call',
        toNumber: '{{contact.phone}}',
        callerId: '',
        record: false,
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddTwilioSmsAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'twilio_sms',
      position: { x: 0, y: 400 },
      data: { label: 'Send SMS', toNumber: '{{contact.phone}}', message: '' },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddTwilioCallAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'twilio_call',
      position: { x: 0, y: 400 },
      data: { label: 'Voice Call', toNumber: '{{contact.phone}}', fromNumber: '', record: false },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  const handleAddPaymentReminderAction = useCallback(() => {
    const nodeId = getId();
    const node = {
      id: nodeId,
      type: 'payment_reminder',
      position: { x: 0, y: 400 },
      data: {
        label: 'Payment Reminder',
        duration: '24',
        unit: 'hours'
      },
    };
    setNodes(nds => [...nds, node]);
    setSelectedNode(node);
  }, [setNodes]);

  // Load gallery and open the picker modal
  const openGallery = useCallback(async () => {
    setShowGalleryModal(true);
  }, []);

  const updateNodeData = (key, value) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const newData = { ...node.data, [key]: value };
          // Optimistic update for selected node
          setSelectedNode({ ...node, data: newData });
          return { ...node, data: newData };
        }
        return node;
      })
    );
  };

  const updateNodeFields = (nodeId, changes) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...changes,
            },
          };
        }
        return node;
      })
    );
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode((node) =>
        node
          ? {
            ...node,
            data: {
              ...node.data,
              ...changes,
            },
          }
          : node
      );
    }
    if (
      Object.prototype.hasOwnProperty.call(changes, 'scheduleType') ||
      Object.prototype.hasOwnProperty.call(changes, 'delayValue') ||
      Object.prototype.hasOwnProperty.call(changes, 'delayUnit')
    ) {
      if (viewMode === 'list') {
        syncGraphFromList();
      }
    }
  };

  const handleSave = () => {
    // Convert Graph to JSON format required
    // { workflow_id, trigger, nodes: [...] }

    // Find trigger node — support both old 'trigger' type and new typed triggers
    const triggerNode = nodes.find(n =>
      n.type === 'trigger' || n.type === 'incoming_webhook' ||
      n.type === 'new_contact' || n.type === 'campaign_trigger'
    );
    let triggerType = triggerNode?.data?.triggerType || 'incoming_whatsapp';
    // Map canvas node types to execution trigger keys
    if (triggerNode?.type === 'incoming_webhook') triggerType = 'incoming_webhook';
    if (triggerNode?.type === 'new_contact') triggerType = 'new_contact';

    const formattedNodes = nodes.map(node => {
      const nodeDef = {
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data
      };

      // Find connections for each node type
      if (node.type === 'condition' || node.type === 'campaign_condition') {
        const yesEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'yes');
        const noEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'no');
        if (yesEdge) nodeDef.yes = yesEdge.target;
        if (noEdge) nodeDef.no = noEdge.target;
      } else if (node.type === 'send_template' && node.data.buttons && node.data.buttons.length > 0) {
        nodeDef.routes = {};
        node.data.buttons.forEach((btn, idx) => {
          const edge = edges.find(e => e.source === node.id && e.sourceHandle === `button-${idx}`);
          if (edge) {
            nodeDef.routes[btn] = edge.target;
          }
        });
      } else if (node.type === 'xolox_event') {
        // XOLOX event node has two named handles: success and fail
        const successEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'success');
        const failEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'fail');
        if (successEdge) nodeDef.onSuccess = successEdge.target;
        if (failEdge) nodeDef.onFail = failEdge.target;
      } else if (node.type === 'twilio_sms') {
        const sentEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'sent');
        const failedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'failed');
        nodeDef.routes = {};
        if (sentEdge) nodeDef.routes.sent = sentEdge.target;
        if (failedEdge) nodeDef.routes.failed = failedEdge.target;
      } else if (node.type === 'twilio_call') {
        const answeredEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'answered');
        const failedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'failed');
        nodeDef.routes = {};
        if (answeredEdge) nodeDef.routes.answered = answeredEdge.target;
        if (failedEdge) nodeDef.routes.failed = failedEdge.target;
      } else if (node.type === 'exotel_call') {
        const answeredEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'answered');
        const failedEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'failed');
        nodeDef.routes = {};
        if (answeredEdge) nodeDef.routes.answered = answeredEdge.target;
        if (failedEdge) nodeDef.routes.failed = failedEdge.target;
      } else if (node.type === 'payment_reminder') {
        const paidEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'paid');
        const unpaidEdge = edges.find(e => e.source === node.id && e.sourceHandle === 'unpaid');
        nodeDef.routes = {};
        if (paidEdge) nodeDef.routes.paid = paidEdge.target;
        if (unpaidEdge) nodeDef.routes.unpaid = unpaidEdge.target;
      } else {
        const edge = edges.find(e => e.source === node.id);
        if (edge) nodeDef.next = edge.target;
      }

      return nodeDef;
    });

    const workflowJson = {
      workflow_id: initialWorkflow?.id || `wf_${Date.now()}`,
      trigger: triggerType,
      nodes: formattedNodes,
      edges: edges
    };

    console.log('Saved Workflow JSON:', workflowJson);
    return workflowJson; // Return for immediate use if needed
  };

  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [autoSaveStatus, setAutoSaveStatus] = useState(null); // null | 'saving' | 'saved'

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!onSave || !initialWorkflow?.id) return;
    const interval = setInterval(async () => {
      setAutoSaveStatus('saving');
      try {
        const json = handleSave();
        await onSave(json);
        setAutoSaveStatus('saved');
        setTimeout(() => setAutoSaveStatus(null), 2000);
      } catch {
        setAutoSaveStatus(null);
      }
    }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onSave, initialWorkflow?.id, nodes, edges]);

  const handleManualSave = async () => {
    setSaveStatus('saving');
    try {
      const json = handleSave();
      if (onSave) await onSave(json);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleRun = async () => {
    if (!runPhoneNumber) {
      alert('Please enter a phone number');
      return;
    }

    setIsRunning(true);
    try {
      // Auto-save before running to ensure backend has latest version
      if (onSave) {
        // We need to wait for save to complete if it was async, but onSave is likely just passing data up.
        // Ideally we should call API to save here if not already saved.
        // But `onSave` in App.jsx calls updateWorkflow.
        // Let's assume user should save first or we trigger save.
        // To be safe, we'll just proceed assuming the user saved or we are running the *persisted* version.
        // Actually, if we just edited, the backend is stale.
        // We should force a save.
        const json = handleSave();
        // Wait a bit for propagation if needed, or better, change onSave to be async and await it.
        // But onSave in App.jsx is async.
        // Let's await it if it returns a promise.
        await onSave(json);
      }

      // Now run
      const res = await runWorkflow(initialWorkflow.id, runPhoneNumber);
      if (res.error) throw new Error(res.error);

      alert('Workflow execution started! Check console for details.');
      console.log('Run logs:', res.log);
      setIsRunModalOpen(false);
    } catch (err) {
      console.error('Failed to run workflow:', err);
      alert('Failed to run workflow: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const openWebhookTestModal = () => {
    const triggerNode = nodes.find((n) => n && n.type === 'incoming_webhook');
    const mapping = (triggerNode && triggerNode.data && triggerNode.data.paramMapping) ? triggerNode.data.paramMapping : {};
    const mappedKeys = Object.keys(mapping || {}).filter(Boolean);

    const base = [
      { key: 'phone', value: runPhoneNumber || '' },
      { key: 'name', value: '' },
      { key: 'email', value: '' },
    ];

    const extras = mappedKeys
      .filter((k) => !base.some((b) => b.key === k))
      .map((k) => ({ key: k, value: '' }));

    setWebhookTestFields([...base, ...extras]);
    setIsWebhookTestModalOpen(true);
  };

  const handleWebhookTestRun = async () => {
    const workflowId = initialWorkflow?.id || null;
    const isRealId = workflowId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workflowId);
    if (!isRealId) {
      alert('Please save the workflow first to generate a webhook URL.');
      return;
    }

    const payload = {};
    for (const row of webhookTestFields) {
      const k = (row.key || '').trim();
      if (!k) continue;
      payload[k] = row.value;
    }

    const phone = payload.phone || payload.mobile || payload.whatsapp || payload.contact || '';
    if (!String(phone).trim()) {
      alert('Phone is required for webhook test (use key "phone").');
      return;
    }

    setIsWebhookSending(true);
    try {
      if (onSave) {
        const json = handleSave();
        await onSave(json);
      }

      const webhookUrl = `${window.location.origin}/webhooks/workflow/${workflowId}`;
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data && (data.error || data.message)) || 'Webhook request failed');
      }

      setIsWebhookTestModalOpen(false);
    } catch (err) {
      console.error('Webhook test failed:', err);
      alert('Webhook test failed: ' + (err.message || 'Unknown error'));
    } finally {
      setIsWebhookSending(false);
    }
  };

  const handleStartRecording = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setVoiceError('Voice input is not supported in this browser. You can type your request instead.');
      return;
    }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setVoiceText((prev) => (prev ? `${prev} ${transcript}` : transcript));
      };
      recognition.onerror = (event) => {
        setVoiceError(event.error || 'Voice capture error');
        setIsRecording(false);
      };
      recognition.onend = () => {
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
      setIsRecording(true);
      recognition.start();
      setVoiceError('');
    } catch (err) {
      setVoiceError('Unable to start voice capture. You can type your request instead.');
    }
  };

  const handleStopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const handleGenerateFromVoice = async () => {
    if (!voiceText.trim()) {
      setVoiceError('Please speak or type what you want the workflow to do.');
      return;
    }
    if (voiceGraph && voicePreview.length > 0) {
      const graph = voiceGraph;
      const ctx = voiceContext;
      if (ctx && ctx.mode === 'branch' && ctx.conditionId && ctx.side) {
        const conditionId = ctx.conditionId;
        const side = ctx.side;
        const steps = (graph.nodes || []).filter(
          (n) => n.type === 'send_template' || n.type === 'send_message'
        );
        if (!steps.length) {
          setVoiceError('Could not understand any steps from your description.');
          return;
        }
        setNodes((nds) => {
          const condNode = nds.find((n) => n.id === conditionId);
          const baseX =
            condNode && condNode.position && typeof condNode.position.x === 'number'
              ? condNode.position.x
              : 0;
          const baseY =
            condNode && condNode.position && typeof condNode.position.y === 'number'
              ? condNode.position.y
              : 0;
          const created = steps.map((step, index) => ({
            id: getId(),
            type: step.type,
            position: {
              x: baseX,
              y: baseY + (index + 1) * 140,
            },
            data: {
              ...(step.data || {}),
              branchConditionId: conditionId,
              branchSide: side,
            },
          }));
          return [...nds, ...created];
        });
        if (viewMode === 'list') {
          syncGraphFromList();
        }
      } else {
        const steps = (graph.nodes || []).filter(
          (n) => n.type === 'send_template' || n.type === 'send_message'
        );
        if (!steps.length) {
          setVoiceError('Could not understand any steps from your description.');
          return;
        }
        setNodes((nds) => {
          const yValues = nds.map((n) =>
            n.position && typeof n.position.y === 'number' ? n.position.y : 0
          );
          const maxY = yValues.length > 0 ? Math.max(...yValues) : 0;
          const firstMessage = nds.find(
            (n) => n.type === 'send_template' || n.type === 'send_message'
          );
          const baseX =
            firstMessage && firstMessage.position && typeof firstMessage.position.x === 'number'
              ? firstMessage.position.x
              : 0;
          const created = steps.map((step, index) => ({
            id: getId(),
            type: step.type,
            position: {
              x: baseX,
              y: maxY + (index + 1) * 140,
            },
            data: {
              ...(step.data || {}),
            },
          }));
          return [...nds, ...created];
        });
        if (viewMode === 'list') {
          syncGraphFromList();
        }
      }
      setIsVoiceModalOpen(false);
      setVoiceText('');
      setVoiceContext(null);
      setVoiceGraph(null);
      setVoicePreview([]);
      return;
    }
    setIsVoiceProcessing(true);
    setVoiceError('');
    try {
      const graph = await aiGenerateWorkflow(voiceText.trim());
      if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.edges)) {
        const lines = summarizeVoiceSteps(graph, voiceContext);
        if (!lines.length) {
          setVoiceError('Could not understand any steps from your description.');
          setVoiceGraph(null);
          setVoicePreview([]);
        } else {
          setVoiceGraph(graph);
          setVoicePreview(lines);
        }
      } else {
        setVoiceError('Could not understand AI response. Please try again.');
      }
    } catch (err) {
      console.error('Failed to generate workflow from voice:', err);
      setVoiceError('Failed to generate workflow. Please try again.');
      setVoiceGraph(null);
      setVoicePreview([]);
    } finally {
      setIsVoiceProcessing(false);
    }
  };

  const sortedNodes = [...nodes].sort((a, b) => {
    const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
    const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
    return ay - by;
  });

  const summarizeVoiceSteps = (graph, context) => {
    if (!graph || !Array.isArray(graph.nodes)) return [];
    let nodesToUse = Array.isArray(graph.nodes) ? [...graph.nodes] : [];
    if (context && context.mode === 'branch') {
      nodesToUse = nodesToUse.filter(
        (n) => n.type === 'send_template' || n.type === 'send_message'
      );
    }
    nodesToUse = nodesToUse.filter(
      (n) => n.type === 'send_template' || n.type === 'send_message' || n.type === 'delay'
    );
    nodesToUse.sort((a, b) => {
      const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
      const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
      return ay - by;
    });
    const lines = [];
    nodesToUse.forEach((node) => {
      const data = node.data || {};
      if (node.type === 'send_template' || node.type === 'send_message') {
        const type = data.scheduleType || 'immediate';
        if (type === 'delay') {
          const rawVal =
            typeof data.delayValue === 'number'
              ? data.delayValue
              : parseInt(String(data.delayValue || '0'), 10);
          const v = Number.isNaN(rawVal) ? 0 : rawVal;
          const u = data.delayUnit || 'minutes';
          if (v > 0) {
            lines.push(`Wait ${v} ${u}`);
          }
        }
        if (node.type === 'send_template') {
          const name = data.template || data.label || 'template';
          lines.push(`Send template "${name}"`);
        } else {
          const msg = (data.message || '').trim();
          const short =
            msg.length > 60 ? `${msg.slice(0, 57)}...` : msg || 'message';
          lines.push(`Send message "${short}"`);
        }
      } else if (node.type === 'delay') {
        const v =
          typeof data.duration === 'number'
            ? data.duration
            : parseInt(String(data.duration || '0'), 10);
        const u = data.unit || 'minutes';
        if (!Number.isNaN(v) && v > 0) {
          lines.push(`Wait ${v} ${u}`);
        }
      }
    });
    return lines;
  };

  const getScheduleSummary = (data) => {
    const type = data.scheduleType || 'immediate';
    if (type === 'immediate') {
      return 'Message sent immediately after previous step';
    }
    if (type === 'delay') {
      const value = data.delayValue || data.duration || 0;
      const unit = data.delayUnit || data.unit || 'minutes';
      return `Message sent ${value} ${unit} after previous step`;
    }
    if (type === 'specific_time') {
      return 'Message sent at the scheduled time';
    }
    return '';
  };

  return (
    <div className="flex flex-col h-screen w-full bg-slate-50 relative">
      {/* CSV Modal */}
      {isCSVModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[95vw] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <FileIcon size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">CSV Bulk Interface</h3>
                  <p className="text-xs text-slate-500">Import or Export workflow structure via Google Sheets / Excel.</p>
                </div>
              </div>
              <button 
                onClick={() => setIsCSVModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl flex gap-3">
                <div className="p-1.5 bg-white text-amber-600 rounded shadow-sm h-fit">
                  <Settings size={14} />
                </div>
                <div>
                  <p className="text-[11px] text-amber-800 font-bold">Unified CSV Management</p>
                  <p className="text-[10px] text-amber-700 leading-relaxed mt-0.5">
                    We've combined Nodes and Edges into a single file. 
                    <b>Uploads will REFRESH</b> the entire canvas. Always back up your current flow before importing.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 1: Download Format</h4>
                  <button
                    onClick={handleDownloadFull}
                    className="w-full flex items-center justify-between p-4 border border-slate-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-100 text-green-600 rounded-lg group-hover:scale-110 transition-transform">
                        <Download size={20} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-slate-800">Download Current Flow</div>
                        <div className="text-[10px] text-slate-500">Includes all nodes, data, and connections.</div>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold text-green-600 border border-green-200 px-2 py-1 rounded bg-white">Get CSV</div>
                  </button>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Step 2: Upload Changes</h4>
                  <label className="relative flex items-center justify-between p-4 border border-slate-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all group">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 text-blue-600 rounded-lg group-hover:scale-110 transition-transform">
                        <Upload size={20} />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-bold text-slate-800">Upload Restructured CSV</div>
                        <div className="text-[10px] text-slate-500">Must follow the unified format (entry_type: node/edge).</div>
                      </div>
                    </div>
                    <input type="file" className="hidden" accept=".csv" onChange={handleUploadFull} />
                    <div className="text-[10px] font-bold text-blue-600 border border-blue-200 px-2 py-1 rounded bg-white">Upload File</div>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setIsCSVModalOpen(false)}>Close Interface</Button>
            </div>
          </div>
        </div>
      )}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[480px] max-w-[95vw] p-6 space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Mic size={18} className="text-slate-700" />
              Add using voice
            </h3>
            <p className="text-xs text-slate-500">
              Example: I want to send a WhatsApp template named "course_selection" and after 1 day send a message saying hi.
            </p>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={isRecording ? 'destructive' : 'outline'}
                  onClick={isRecording ? handleStopRecording : handleStartRecording}
                  className="flex items-center gap-2"
                >
                  <Mic size={16} />
                  {isRecording ? 'Stop recording' : 'Start recording'}
                </Button>
                <span className="text-xs text-slate-500">
                  {isRecording ? 'Listening...' : 'You can also type below'}
                </span>
              </div>
              <textarea
                className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[80px]"
                placeholder='Describe the flow you want, for example: "Send template course_selection, then after 1 day send a message saying hi."'
                value={voiceText}
                onChange={(e) => setVoiceText(e.target.value)}
              />
              {voicePreview.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-md p-2 bg-slate-50">
                  <div className="text-[11px] font-semibold text-slate-600 mb-1">
                    Detected steps
                  </div>
                  <ol className="text-[11px] text-slate-700 space-y-1 list-decimal list-inside">
                    {voicePreview.map((line, idx) => (
                      <li key={idx}>{line}</li>
                    ))}
                  </ol>
                </div>
              )}
              {voiceError && (
                <p className="text-xs text-red-500">
                  {voiceError}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => {
                  setIsVoiceModalOpen(false);
                  setVoiceText('');
                  setVoiceError('');
                  setVoiceGraph(null);
                  setVoicePreview([]);
                  if (isRecording) {
                    handleStopRecording();
                  }
                }}
              >
                Cancel
              </Button>
              <Button type="button" onClick={handleGenerateFromVoice} disabled={isVoiceProcessing}>
                {isVoiceProcessing && <Loader2 size={16} className="animate-spin mr-2" />}
                {isVoiceProcessing
                  ? 'Generating...'
                  : voiceGraph && voicePreview.length > 0
                    ? 'Apply to workflow'
                    : 'Generate steps'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Webhook Test Modal */}
      {isWebhookTestModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[520px] overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900">Test Incoming Webhook</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setIsWebhookTestModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-500">
              This sends your payload to the workflow webhook URL and runs the remaining steps.
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_1.4fr_32px] gap-2 text-xs font-medium text-slate-600">
                <div>Key</div>
                <div>Value</div>
                <div></div>
              </div>
              <div className="space-y-2">
                {webhookTestFields.map((row, idx) => (
                  <div key={`${row.key}-${idx}`} className="grid grid-cols-[1fr_1.4fr_32px] gap-2 items-center">
                    <input
                      className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                      placeholder="phone / name / course ..."
                      value={row.key}
                      onChange={(e) => {
                        const next = [...webhookTestFields];
                        next[idx] = { ...next[idx], key: e.target.value };
                        setWebhookTestFields(next);
                      }}
                    />
                    <input
                      className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                      placeholder="value"
                      value={row.value}
                      onChange={(e) => {
                        const next = [...webhookTestFields];
                        next[idx] = { ...next[idx], value: e.target.value };
                        setWebhookTestFields(next);
                      }}
                    />
                    <button
                      type="button"
                      className="text-slate-400 hover:text-red-600"
                      onClick={() => setWebhookTestFields((prev) => prev.filter((_, i) => i !== idx))}
                      title="Remove"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWebhookTestFields((prev) => [...prev, { key: '', value: '' }])}
                >
                  <Plus size={14} className="mr-2" />
                  Add field
                </Button>
                <div className="text-[11px] text-slate-500">
                  Required: <span className="font-mono bg-slate-100 px-1 rounded">phone</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsWebhookTestModalOpen(false)}>Cancel</Button>
              <Button onClick={handleWebhookTestRun} disabled={isWebhookSending}>
                {isWebhookSending ? <Loader2 size={16} className="animate-spin mr-2" /> : <Send size={16} className="mr-2" />}
                {isWebhookSending ? 'Sending...' : 'Run Test'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* Run Modal */}
      {isRunModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-xl w-[400px] overflow-hidden p-6 space-y-4">
            <h3 className="font-semibold text-slate-900">Run Workflow</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Test Phone Number</label>
              <input
                className="w-full border border-slate-300 rounded-md p-2 text-sm"
                placeholder="e.g. 15551234567"
                value={runPhoneNumber}
                onChange={(e) => setRunPhoneNumber(e.target.value)}
              />
              <p className="text-xs text-slate-500">Enter number with country code (no +)</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setIsRunModalOpen(false)}>Cancel</Button>
              <Button onClick={handleRun} disabled={isRunning}>
                {isRunning ? <Loader2 size={16} className="animate-spin mr-2" /> : <Play size={16} className="mr-2" />}
                {isRunning ? 'Running...' : 'Run Now'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft size={20} />
          </Button>
          <h1 className="text-lg font-semibold text-slate-800">Workflow Builder</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 mr-2">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${viewMode === 'canvas' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              Builder
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 text-xs font-medium rounded-md ${viewMode === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
            >
              List
            </button>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setVoiceContext({ mode: 'global' });
              setIsVoiceModalOpen(true);
            }}
            className="flex items-center gap-2 text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <Mic size={16} />
            Add using voice
          </Button>
          <Button
            variant="outline"
            onClick={() => setIsCSVModalOpen(true)}
            className="flex items-center gap-2 text-slate-700 border-slate-200 hover:bg-slate-50"
          >
            <FileIcon size={16} />
            CSV Interface
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (hasIncomingWebhookTrigger) {
                openWebhookTestModal();
              } else {
                setIsRunModalOpen(true);
              }
            }}
            className="flex items-center gap-2 text-green-600 border-green-200 hover:bg-green-50"
          >
            {hasIncomingWebhookTrigger ? <Link size={16} /> : <Play size={16} />}
            Run Test
          </Button>
          {autoSaveStatus && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              {autoSaveStatus === 'saving' ? (
                <><Loader2 size={13} className="animate-spin text-slate-400" /> Auto-saving…</>
              ) : (
                <><Check size={13} className="text-green-500" /> Auto-saved</>
              )}
            </span>
          )}
          <Button
            onClick={handleManualSave}
            disabled={saveStatus === 'saving'}
            className={`flex items-center gap-2 transition-colors ${saveStatus === 'saved' ? 'bg-green-600 hover:bg-green-700' :
              saveStatus === 'error' ? 'bg-red-600 hover:bg-red-700' : ''
              }`}
          >
            {saveStatus === 'saving' ? <Loader2 size={16} className="animate-spin" /> :
              saveStatus === 'saved' ? <Check size={16} /> :
                saveStatus === 'error' ? <span className="text-xs">✗</span> :
                  <Save size={16} />}
            {saveStatus === 'saving' ? 'Saving…' :
              saveStatus === 'saved' ? 'Saved!' :
                saveStatus === 'error' ? 'Save Failed' :
                  'Save Workflow'}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Palette */}
        <div className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Triggers</h2>
          </div>
          <div className="p-4 space-y-3 overflow-y-auto">
            {viewMode === 'canvas' && (
              <div className="pt-1 pb-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Triggers</h2>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'trigger');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('trigger')}
                title="Triggers when a specific keyword is received"
              >
                <div className="w-9 h-9 rounded-md bg-green-600 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-green-800">Whatsapp Incoming</div>
                  <div className="text-xs text-green-600">Keyword match trigger</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-purple-50 border border-purple-200 cursor-pointer hover:bg-purple-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'campaign_trigger');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddCampaignTrigger}
                title="Adds Campaign Sent trigger + Condition node pre-wired"
              >
                <div className="w-9 h-9 rounded-md bg-purple-600 flex items-center justify-center shrink-0">
                  <Megaphone size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-purple-800">Campaign Sent</div>
                  <div className="text-xs text-purple-500">Adds trigger + condition</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-cyan-50 border border-cyan-200 cursor-pointer hover:bg-cyan-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'incoming_webhook');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddWebhookTrigger}
                title="HTTP POST webhook that triggers this workflow"
              >
                <div className="w-9 h-9 rounded-md bg-cyan-600 flex items-center justify-center shrink-0">
                  <Link size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-cyan-800">Incoming Webhook</div>
                  <div className="text-xs text-cyan-500">HTTP POST → workflow</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'new_contact');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddNewContactTrigger}
                title="Triggers when a new contact is created"
              >
                <div className="w-9 h-9 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-800">New Contact Created</div>
                  <div className="text-xs text-emerald-500">Contact added → workflow</div>
                </div>
              </div>
            )}

            {/* ── Actions heading ─────────────────────────── */}
            {viewMode === 'canvas' && (
              <div className="pt-3 pb-1">
                <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</h2>
              </div>
            )}

            {/* XOLOX CRM integration */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-indigo-50 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'action');
                    e.dataTransfer.setData('application/actiontype', 'start_workflow');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'start_workflow')}
                title="Trigger another workflow"
              >
                <div className="w-9 h-9 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
                  <WorkflowIcon size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-indigo-800">Start Workflow</div>
                  <div className="text-xs text-indigo-600">Chain another flow</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-orange-50 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'xolox_event');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddXoloxEvent}
                title="Send data to XOLOX CRM webhook; branches on success/fail"
              >
                <div className="w-9 h-9 rounded-md bg-orange-600 flex items-center justify-center shrink-0">
                  <Globe size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-800">XOLOX Event</div>
                  <div className="text-xs text-orange-500">CRM webhook → YES / NO</div>
                </div>
              </div>
            )}

            {/* Send Template action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'send_template');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddSendTemplateAction}
                title="Send a WhatsApp template with variables and optional media header"
              >
                <div className="w-9 h-9 rounded-md bg-green-600 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-green-800">Send Template</div>
                  <div className="text-xs text-green-600">WhatsApp template + media</div>
                </div>
              </div>
            )}

            {/* Response Message action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-teal-50 border border-teal-200 cursor-pointer hover:bg-teal-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'response_message');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddResponseMessageAction}
                title="Send a direct message with optional media and quick reply options"
              >
                <div className="w-9 h-9 rounded-md bg-teal-600 flex items-center justify-center shrink-0">
                  <MessageCircle size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-teal-800">Response Message</div>
                  <div className="text-xs text-teal-600">Direct message + Quick replies</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-blue-50 border border-blue-200 cursor-pointer hover:bg-blue-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'action');
                    e.dataTransfer.setData('application/actiontype', 'send_email');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'send_email')}
                title="Send an email using a selected template"
              >
                <div className="w-9 h-9 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
                  <Mail size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-blue-800">Send Email</div>
                  <div className="text-xs text-blue-600">ZeptoMail template</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-fuchsia-50 border border-fuchsia-200 cursor-pointer hover:bg-fuchsia-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'action');
                    e.dataTransfer.setData('application/actiontype', 'send_sms_otp');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'send_sms_otp')}
                title="Send OTP SMS with configurable digit count"
              >
                <div className="w-9 h-9 rounded-md bg-fuchsia-600 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-fuchsia-800">Send SMS OTP</div>
                  <div className="text-xs text-fuchsia-600">Fast2SMS OTP route</div>
                </div>
              </div>
            )}

            {/* Feedback Collection action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-yellow-50 border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'feedback');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddFeedbackAction}
                title="Collect CSAT feedback from customers at the end of a flow"
              >
                <div className="w-9 h-9 rounded-md bg-yellow-600 flex items-center justify-center shrink-0">
                  <Star size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-yellow-800">Feedback Collection</div>
                  <div className="text-xs text-yellow-600">Track customer CSAT</div>
                </div>
              </div>
            )}

            {/* Razorpay Payments */}
            {viewMode === 'canvas' && (
              <div className="pt-4 pb-1">
                <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] px-1">Razorpay Integrations</h3>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-indigo-50 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'razorpay_link');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('razorpay_link')}
                title="Create and send a Razorpay payment link"
              >
                <div className="w-9 h-9 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
                  <CreditCard size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-indigo-800">Create Payment Link</div>
                  <div className="text-xs text-indigo-600">Razorpay auto-generation</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-indigo-50 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'razorpay_status');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('razorpay_status')}
                title="Check payment status and branch the flow"
              >
                <div className="w-9 h-9 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
                  <RefreshCw size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-indigo-800">Check Payment Status</div>
                  <div className="text-xs text-indigo-600">Branch on Paid/Unpaid</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div className="pt-3 pb-1">
                <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">System Actions</h3>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'action');
                    e.dataTransfer.setData('application/actiontype', 'update_lead_stage');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'update_lead_stage')}
                title="Update the conversation's lead stage"
              >
                <div className="w-9 h-9 rounded-md bg-slate-700 flex items-center justify-center shrink-0">
                  <ListChecks size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">Update Lead Stage</div>
                  <div className="text-xs text-slate-600">Set to New/Contacted/Enrolled...</div>
                </div>
              </div>
            )}

            {/* Payment Request action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-indigo-50 border border-indigo-200 cursor-pointer hover:bg-indigo-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'payment_request');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddPaymentRequestAction}
                title="Send a payment request for courses or webinars"
              >
                <div className="w-9 h-9 rounded-md bg-indigo-600 flex items-center justify-center shrink-0">
                  <CreditCard size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-indigo-800">Payment Request</div>
                  <div className="text-xs text-indigo-600">Course & webinar fees</div>
                </div>
              </div>
            )}

            {/* Payment Reminder action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-orange-50 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'payment_reminder');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddPaymentReminderAction}
                title="Follow up on pending payments with specific conditions"
              >
                <div className="w-9 h-9 rounded-md bg-orange-600 flex items-center justify-center shrink-0">
                  <BellRing size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-800">Payment Reminder</div>
                  <div className="text-xs text-orange-600">Follow up on unpaid</div>
                </div>
              </div>
            )}

            {/* Exotel Call action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-orange-50 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'exotel_call');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddExotelCallAction}
                title="Initiate an outbound VoIP call via Exotel"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <Phone size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-800">Exotel Call</div>
                  <div className="text-xs text-orange-600">Initiate VoIP call</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'twilio_sms');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddTwilioSmsAction}
                title="Send an SMS via Twilio"
              >
                <div className="w-9 h-9 rounded-md bg-red-500 flex items-center justify-center shrink-0">
                  <MessageSquare size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-800">Twilio SMS</div>
                  <div className="text-xs text-red-600">Send SMS message</div>
                </div>
              </div>
            )}

            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-red-50 border border-red-200 cursor-pointer hover:bg-red-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'twilio_call');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddTwilioCallAction}
                title="Make an outbound voice call via Twilio"
              >
                <div className="w-9 h-9 rounded-md bg-red-600 flex items-center justify-center shrink-0">
                  <Phone size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-red-800">Twilio Call</div>
                  <div className="text-xs text-red-600">Outbound voice call</div>
                </div>
              </div>
            )}

            {/* Internal Alert action */}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-orange-50 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'notification');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={handleAddNotificationAction}
                title="Send an internal alert to agents when this point is reached"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-800">Internal Alert</div>
                  <div className="text-xs text-orange-600">Notify your team</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-orange-50 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'action');
                    e.dataTransfer.setData('application/actiontype', 'assign_agent');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'assign_agent')}
                title="Assign conversation to an agent (Round Robin or Direct)"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <UserCheck size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-800">Assign Agent</div>
                  <div className="text-xs text-orange-600">Route to team member</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-orange-50 border border-orange-200 cursor-pointer hover:bg-orange-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'delay');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('delay')}
                title="Wait before executing the next node"
              >
                <div className="w-9 h-9 rounded-md bg-orange-500 flex items-center justify-center shrink-0">
                  <Clock size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-orange-800">Time Delay</div>
                  <div className="text-xs text-orange-600">Run next step later</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-slate-50 border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'end');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('end')}
                title="Terminate the workflow here"
              >
                <div className="w-9 h-9 rounded-md bg-slate-600 flex items-center justify-center shrink-0">
                  <StopCircle size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800">End Flow</div>
                  <div className="text-xs text-slate-600">Stop execution</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-cyan-50 border border-cyan-200 cursor-pointer hover:bg-cyan-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'action');
                    e.dataTransfer.setData('application/actiontype', 'update_chat_status');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'update_chat_status')}
                title="Change conversation status (open / snoozed / closed)"
              >
                <div className="w-9 h-9 rounded-md bg-cyan-600 flex items-center justify-center shrink-0">
                  <MessageCircle size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-cyan-800">Update Chat Status</div>
                  <div className="text-xs text-cyan-600">Open / Snooze / Close</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-emerald-50 border border-emerald-200 cursor-pointer hover:bg-emerald-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'action');
                    e.dataTransfer.setData('application/actiontype', 'add_to_label');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('action', 'add_to_label')}
                title="Add contact to a label (group)"
              >
                <div className="w-9 h-9 rounded-md bg-emerald-600 flex items-center justify-center shrink-0">
                  <Tag size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-emerald-800">Add To Label</div>
                  <div className="text-xs text-emerald-600">Select group</div>
                </div>
              </div>
            )}
            {viewMode === 'canvas' && (
              <div
                className="flex items-center gap-3 p-3 rounded-md bg-violet-50 border border-violet-200 cursor-pointer hover:bg-violet-100 transition-colors"
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/reactflow', 'attribute_condition');
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onClick={() => handleAddNodeFromPalette('attribute_condition')}
                title="Route based on contact attributes with AND/OR groups"
              >
                <div className="w-9 h-9 rounded-md bg-violet-600 flex items-center justify-center shrink-0">
                  <GitBranch size={16} className="text-white" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-violet-800">Custom Attributes</div>
                  <div className="text-xs text-violet-600">Multi-branch with default</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
          {viewMode === 'canvas' ? (
            <ReactFlowProvider>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onInit={setReactFlowInstance}
                onDrop={onDrop}
                onDragOver={onDragOver}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                nodeTypes={nodeTypes}
                fitView
                selectionOnDrag={true}
                panOnDrag={[1, 2]}
                selectionMode="partial"
              >
                <Background variant={BackgroundVariant.Dots} color="#ccc" gap={20} size={1} />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </ReactFlowProvider>
          ) : (
            <div className="h-full overflow-y-auto p-4 bg-slate-50">
              {sortedNodes.length === 0 ? (
                <div className="text-sm text-slate-500">
                  No nodes added yet. Drag blocks from the left to build your workflow.
                </div>
              ) : (
                <ol className="space-y-2">
                  {sortedNodes.map((node) => {
                    const isMessageNode = node.type === 'send_template' || node.type === 'send_message';
                    const isExpanded = expandedNodeId === node.id;
                    if (isMessageNode) {
                      const title =
                        node.type === 'send_template'
                          ? node.data?.template || node.data?.label || 'Untitled Message'
                          : node.data?.label || node.data?.message || 'Untitled Message';
                      const scheduleSummary = getScheduleSummary(node.data || {});
                      return (
                        <li
                          key={node.id}
                          draggable
                          onDragStart={(event) => handleListItemDragStart(event, node.id)}
                          onDragOver={handleListItemDragOver}
                          onDrop={(event) => handleListItemDrop(event, node.id)}
                          onDragEnd={handleListItemDragEnd}
                          onClick={() => {
                            setSelectedNode(node);
                            setExpandedNodeId((prev) => (prev === node.id ? null : node.id));
                          }}
                          className={`rounded-md border px-3 py-2 text-sm bg-white ${selectedNode && selectedNode.id === node.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                            }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 cursor-move">⋮⋮</span>
                              <div className="flex flex-col">
                                <span className="font-medium text-slate-800">{title}</span>
                                <span className="text-[11px] text-slate-500">{scheduleSummary}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                              <button
                                type="button"
                                className="text-slate-500 hover:text-slate-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedNodeId((prev) => (prev === node.id ? null : node.id));
                                  setSelectedNode(node);
                                }}
                              >
                                {isExpanded ? 'Hide' : 'Edit'}
                              </button>
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-700"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setNodes((nds) => nds.filter((n) => n.id !== node.id));
                                  if (selectedNode && selectedNode.id === node.id) {
                                    setSelectedNode(null);
                                  }
                                  if (expandedNodeId === node.id) {
                                    setExpandedNodeId(null);
                                  }
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                          {isExpanded && (
                            <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Message Name</label>
                                <input
                                  className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                  value={node.data?.label || ''}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    updateNodeFields(node.id, { label: value });
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs text-slate-500">Schedule</label>
                                <div
                                  className="flex flex-wrap gap-3 text-xs text-slate-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={(node.data?.scheduleType || 'immediate') === 'immediate'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'immediate',
                                        })
                                      }
                                    />
                                    <span>Immediate</span>
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={node.data?.scheduleType === 'specific_time'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'specific_time',
                                        })
                                      }
                                    />
                                    <span>Specific time</span>
                                  </label>
                                  <label className="flex items-center gap-1">
                                    <input
                                      type="radio"
                                      name={`schedule-${node.id}`}
                                      checked={node.data?.scheduleType === 'delay'}
                                      onChange={() =>
                                        updateNodeFields(node.id, {
                                          scheduleType: 'delay',
                                        })
                                      }
                                    />
                                    <span>After X minutes/hours/days</span>
                                  </label>
                                </div>
                                {node.data?.scheduleType === 'delay' && (
                                  <div
                                    className="flex items-center gap-2 mt-2"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <input
                                      type="number"
                                      className="w-20 border border-slate-300 rounded-md p-2 text-sm"
                                      value={node.data?.delayValue ?? ''}
                                      onChange={(e) =>
                                        updateNodeFields(node.id, {
                                          delayValue: e.target.value ? parseInt(e.target.value, 10) : '',
                                        })
                                      }
                                    />
                                    <select
                                      className="flex-1 border border-slate-300 rounded-md p-2 text-sm"
                                      value={node.data?.delayUnit || 'minutes'}
                                      onChange={(e) =>
                                        updateNodeFields(node.id, {
                                          delayUnit: e.target.value,
                                        })
                                      }
                                    >
                                      <option value="minutes">Minutes</option>
                                      <option value="hours">Hours</option>
                                      <option value="days">Days</option>
                                    </select>
                                  </div>
                                )}
                              </div>
                              {node.type === 'send_message' && (
                                <div className="space-y-1">
                                  <label className="text-xs text-slate-500">Content</label>
                                  <textarea
                                    className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[120px]"
                                    placeholder="Enter message content..."
                                    value={node.data?.message || ''}
                                    onChange={(e) =>
                                      updateNodeFields(node.id, {
                                        message: e.target.value,
                                      })
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </li>
                      );
                    }
                    if (node.type === 'condition') {
                      const title = node.data?.label || 'Condition';
                      const desc = node.data?.condition || 'Configure condition';

                      const branchChildren = {};
                      sortedNodes.forEach((n) => {
                        const data = n.data || {};
                        if (data.branchConditionId === node.id && (data.branchSide === 'yes' || data.branchSide === 'no')) {
                          if (!branchChildren[data.branchSide]) branchChildren[data.branchSide] = [];
                          branchChildren[data.branchSide].push(n);
                        }
                      });

                      const yesChildren = (branchChildren.yes || []).sort((a, b) => {
                        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
                        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
                        return ay - by;
                      });

                      const noChildren = (branchChildren.no || []).sort((a, b) => {
                        const ay = a.position && typeof a.position.y === 'number' ? a.position.y : 0;
                        const by = b.position && typeof b.position.y === 'number' ? b.position.y : 0;
                        return ay - by;
                      });

                      const isYesActive =
                        branchTarget && branchTarget.conditionId === node.id && branchTarget.side === 'yes';
                      const isNoActive =
                        branchTarget && branchTarget.conditionId === node.id && branchTarget.side === 'no';

                      return (
                        <li
                          key={node.id}
                          draggable
                          onDragStart={(event) => handleListItemDragStart(event, node.id)}
                          onDragOver={handleListItemDragOver}
                          onDrop={(event) => handleListItemDrop(event, node.id)}
                          onDragEnd={handleListItemDragEnd}
                          onClick={() => setSelectedNode(node)}
                          className={`rounded-md border px-3 py-2 text-sm bg-white ${selectedNode && selectedNode.id === node.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                            }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-slate-400 cursor-move">⋮⋮</span>
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-800">{title}</span>
                              <span className="text-[11px] text-slate-500">{desc}</span>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 text-[11px] text-slate-600 border rounded overflow-hidden">
                            <button
                              type="button"
                              className={`py-1 text-center font-semibold ${isYesActive ? 'text-white bg-green-500' : 'text-green-600 bg-green-50'
                                }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'yes' });
                              }}
                            >
                              YES
                            </button>
                            <button
                              type="button"
                              className={`py-1 text-center font-semibold border-l border-slate-200 ${isNoActive ? 'text-white bg-red-500' : 'text-red-600 bg-red-50'
                                }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'no' });
                              }}
                            >
                              NO
                            </button>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                            <button
                              type="button"
                              className="py-1 text-center rounded border border-dashed border-green-300 text-green-700 hover:bg-green-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'yes' });
                                setVoiceContext({ mode: 'branch', conditionId: node.id, side: 'yes' });
                                setIsVoiceModalOpen(true);
                              }}
                            >
                              Add YES flow using voice
                            </button>
                            <button
                              type="button"
                              className="py-1 text-center rounded border border-dashed border-red-300 text-red-700 hover:bg-red-50"
                              onClick={(e) => {
                                e.stopPropagation();
                                setBranchTarget({ conditionId: node.id, side: 'no' });
                                setVoiceContext({ mode: 'branch', conditionId: node.id, side: 'no' });
                                setIsVoiceModalOpen(true);
                              }}
                            >
                              Add NO flow using voice
                            </button>
                          </div>
                          {(yesChildren.length > 0 || noChildren.length > 0) && (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                {yesChildren.map((child) => (
                                  <div
                                    key={child.id}
                                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]"
                                  >
                                    <div className="font-medium text-slate-800 truncate">
                                      {child.data?.label ||
                                        child.data?.template ||
                                        child.data?.message ||
                                        'Step'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-1 border-l border-dashed border-slate-200 pl-2">
                                {noChildren.map((child) => (
                                  <div
                                    key={child.id}
                                    className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px]"
                                  >
                                    <div className="font-medium text-slate-800 truncate">
                                      {child.data?.label ||
                                        child.data?.template ||
                                        child.data?.message ||
                                        'Step'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    }
                    return (
                      <li
                        key={node.id}
                        draggable
                        onDragStart={(event) => handleListItemDragStart(event, node.id)}
                        onDragOver={handleListItemDragOver}
                        onDrop={(event) => handleListItemDrop(event, node.id)}
                        onDragEnd={handleListItemDragEnd}
                        onClick={() => setSelectedNode(node)}
                        className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm cursor-move bg-white ${selectedNode && selectedNode.id === node.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                          }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-[11px] uppercase tracking-wide text-slate-400">{node.type}</span>
                          <span className="text-slate-800">
                            {(node.data &&
                              (node.data.label ||
                                node.data.template ||
                                node.data.message ||
                                node.data.condition ||
                                node.data.actionType)) ||
                              'Untitled'}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400">Drag to reorder</span>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar - Config */}
        {selectedNode && (
          <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-800">Configuration</h2>
              <div className="text-xs text-slate-500 mt-1">ID: {selectedNode.id}</div>
              <div className="text-xs text-slate-500">Type: {selectedNode.type}</div>
            </div>

            {selectedNode?.data?.nodeError && (
              <div className="px-4 pt-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-red-700 mb-1">Node Error</div>
                  <div className="text-xs text-red-700 whitespace-pre-wrap break-words">
                    {selectedNode.data.nodeError}
                  </div>
                </div>
              </div>
            )}
            
            {selectedNode?.data?.lastContextPreview && (
              <div className="px-4 pt-4">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <div className="text-xs font-semibold text-slate-700 mb-1">Data In This Step</div>
                  <pre className="text-[10px] text-slate-600 whitespace-pre-wrap break-words leading-relaxed">
                    {JSON.stringify(selectedNode.data.lastContextPreview, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            <div className="p-4 space-y-6">
              {/* Dynamic Config Forms based on Node Type */}
              {selectedNode.type === 'trigger' && (
                <div className="space-y-4">
                  <div className="space-y-2 mt-4">
                    <div className="bg-green-50 text-green-700 p-3 rounded-md text-xs border border-green-100 mb-2">
                      This workflow triggers when an incoming WhatsApp message contains any of the specified keywords.
                    </div>
                    <label className="block text-sm font-medium text-slate-700">Keywords (comma separated)</label>
                    <textarea
                      className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[80px]"
                      placeholder="e.g. cpa us, tax help, support"
                      value={selectedNode.data.keywords || ''}
                      onChange={(e) => {
                        updateNodeData('keywords', e.target.value);
                        updateNodeData('triggerType', 'incoming_whatsapp');
                      }}
                    />
                    <p className="text-[10px] text-slate-500">
                      Leave blank to trigger on *any* incoming WhatsApp message.
                    </p>
                  </div>
                </div>
              )}

              {selectedNode.type === 'campaign_trigger' && (
                <div className="space-y-4">
                  <div className="bg-purple-50 border border-purple-100 text-purple-700 rounded-md p-3 text-xs">
                    This workflow triggers after a campaign message is sent to a contact.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Select Campaign</label>
                    <select
                      className="w-full border border-slate-300 rounded-md p-2 text-sm"
                      value={selectedNode.data.campaignId || ''}
                      onChange={e => {
                        const camp = availableCampaigns.find(c => c.id === e.target.value);
                        updateNodeFields(selectedNode.id, {
                          campaignId: e.target.value,
                          campaignName: camp?.name || '',
                          triggerType: 'campaign_sent',
                        });
                      }}
                    >
                      <option value="">— Select a campaign —</option>
                      {availableCampaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {selectedNode.type === 'incoming_webhook' && (
                <WebhookNodeConfig
                  node={selectedNode}
                  workflowId={initialWorkflow?.id || null}
                  updateNodeFields={updateNodeFields}
                />
              )}

              {selectedNode.type === 'new_contact' && (() => {
                const fieldMapping = selectedNode.data.fieldMapping || {};
                return (
                  <div className="space-y-5">
                    {/* Info banner */}
                    <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <UserCheck size={14} className="text-emerald-600" />
                        <span className="text-xs font-semibold text-emerald-800">New Contact Created Trigger</span>
                      </div>
                      <p className="text-[11px] text-emerald-600 leading-relaxed">
                        This workflow fires automatically whenever a new contact is created.
                        The fields below are pre-mapped and available as <code className="bg-white border border-emerald-200 rounded px-1">{'{{'}<em>variable</em>{'}}'}</code> in all subsequent nodes.
                      </p>
                    </div>

                    {/* Field Mapping */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Field Mapping</label>
                      <p className="text-[10px] text-slate-400 mb-3">
                        Each contact field is mapped to a variable name. Rename any variable — it will be available as <code className="bg-slate-100 px-1 rounded">{'{{'}<em>variable</em>{'}}'}</code> in later steps.
                      </p>
                      <div className="space-y-2">
                        {NEW_CONTACT_FIELDS.map(field => (
                          <div key={field.key} className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-100 border border-slate-200 rounded-md px-2 py-1.5 text-xs font-mono text-slate-600 truncate">
                              {field.label}
                            </div>
                            <span className="text-slate-400 text-xs shrink-0">→</span>
                            <input
                              type="text"
                              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-300"
                              placeholder={field.defaultVar}
                              value={fieldMapping[field.key] || ''}
                              onChange={e => {
                                const next = { ...fieldMapping, [field.key]: e.target.value };
                                updateNodeFields(selectedNode.id, { fieldMapping: next });
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Usage guide */}
                    {Object.keys(fieldMapping).length > 0 && (
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 space-y-1">
                        <div className="text-xs font-semibold text-emerald-800 mb-1.5">How to use in later nodes</div>
                        {NEW_CONTACT_FIELDS.filter(f => fieldMapping[f.key]).map(f => (
                          <div key={f.key} className="flex items-center gap-2 text-[11px]">
                            <code className="bg-white border border-emerald-200 rounded px-1.5 py-0.5 text-emerald-700 font-mono">{`{{${fieldMapping[f.key]}}}`}</code>
                            <span className="text-slate-400">← contact.{f.key.replace('contact_', '')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedNode.type === 'xolox_event' && (() => {
                const d = selectedNode.data;
                const payloadFields = Array.isArray(d.payloadFields) ? d.payloadFields : [];

                const updateField = (idx, key, val) => {
                  const next = payloadFields.map((f, i) => i === idx ? { ...f, [key]: val } : f);
                  updateNodeFields(selectedNode.id, { payloadFields: next });
                };
                const addField = () => {
                  updateNodeFields(selectedNode.id, { payloadFields: [...payloadFields, { field: '', variable: '' }] });
                };
                const removeField = (idx) => {
                  updateNodeFields(selectedNode.id, { payloadFields: payloadFields.filter((_, i) => i !== idx) });
                };

                return (
                  <div className="space-y-5">

                    {/* Banner */}
                    <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Globe size={14} className="text-orange-600" />
                        <span className="text-xs font-semibold text-orange-800">XOLOX CRM Event</span>
                      </div>
                      <p className="text-[11px] text-orange-600 leading-relaxed">
                        Paste the webhook URL from <strong>xolox.io</strong>, define the fields XOLOX expects, map each to a <code className="bg-white border border-orange-200 rounded px-1">{'{{variable}}'}</code> from earlier nodes, then connect <span className="text-green-600 font-semibold">SUCCESS</span> and <span className="text-red-500 font-semibold">FAIL</span> branches.
                      </p>
                    </div>

                    {/* Event name */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Event Name <span className="text-slate-400 text-[10px] font-normal">(label only)</span></label>
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        placeholder="e.g. Lead Create, Contact Update"
                        value={d.eventName || ''}
                        onChange={e => updateNodeFields(selectedNode.id, { eventName: e.target.value })}
                      />
                    </div>

                    {/* Webhook URL */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">XOLOX Webhook URL</label>
                      <input
                        type="url"
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-300"
                        placeholder="https://xolox.io/webhooks/…"
                        value={d.webhookUrl || ''}
                        onChange={e => updateNodeFields(selectedNode.id, { webhookUrl: e.target.value })}
                      />
                    </div>

                    {/* HTTP Method */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">HTTP Method</label>
                      <select
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        value={d.method || 'POST'}
                        onChange={e => updateNodeFields(selectedNode.id, { method: e.target.value })}
                      >
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="PATCH">PATCH</option>
                        <option value="GET">GET</option>
                      </select>
                    </div>

                    {/* Payload Fields */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">Request Payload Fields</label>
                        <button
                          type="button"
                          onClick={addField}
                          className="flex items-center gap-1 text-[11px] text-orange-600 hover:text-orange-800 border border-orange-200 rounded px-2 py-0.5 hover:bg-orange-50 transition-colors"
                        >
                          <Plus size={11} /> Add Field
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400 mb-2">
                        Left = field key XOLOX expects &nbsp;·&nbsp; Right = <code className="bg-slate-100 px-0.5 rounded">{'{{variable}}'}</code> from previous nodes
                      </p>
                      {payloadFields.length === 0 && (
                        <div className="border-2 border-dashed border-slate-200 rounded-lg p-3 text-center text-[11px] text-slate-400">
                          No fields yet — click <strong>Add Field</strong> to define the payload
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {payloadFields.map((f, idx) => (
                          <div key={idx} className={`flex items-center gap-1 min-w-0 rounded p-0.5 transition-colors ${focusedVarIdx === idx ? 'bg-orange-50 ring-1 ring-orange-200' : ''}`}>
                            <input
                              type="text"
                              className="w-[90px] min-w-0 shrink-0 border border-slate-300 rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300"
                              placeholder="key"
                              value={f.field}
                              onChange={e => updateField(idx, 'field', e.target.value)}
                            />
                            <span className="text-slate-400 text-[10px] shrink-0">→</span>
                            <input
                              type="text"
                              className={`flex-1 min-w-0 border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300 transition-colors ${focusedVarIdx === idx ? 'border-orange-400 bg-orange-50' : 'border-slate-300'}`}
                              placeholder="{{variable}}"
                              value={f.variable}
                              onChange={e => updateField(idx, 'variable', e.target.value)}
                              onFocus={() => setFocusedVarIdx(idx)}
                              onBlur={() => { setTimeout(() => setFocusedVarIdx(null), 200); }}
                            />
                            <button
                              type="button"
                              onClick={() => removeField(idx)}
                              className="shrink-0 p-0.5 text-red-400 hover:text-red-600 transition-colors"
                              title="Remove field"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Available variables hint — dynamically computed from upstream nodes */}
                    {(() => {
                      // Walk backward through edges to find all variables exposed by upstream nodes
                      const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges);

                      return (
                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="text-[11px] font-semibold text-slate-600">
                              Variables from upstream nodes
                              <span className="ml-1 text-[10px] font-normal text-slate-400">
                                ({upstreamVars.length} found)
                              </span>
                            </div>
                            {focusedVarIdx !== null && (
                              <span className="text-[10px] text-orange-500 font-medium">
                                → clicking inserts into field #{focusedVarIdx + 1}
                              </span>
                            )}
                          </div>
                          {upstreamVars.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic">
                              No upstream nodes with mapped variables found. Connect a <strong>New Contact Created</strong> or <strong>Incoming Webhook</strong> trigger above this node.
                            </p>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {upstreamVars.map(v => (
                                <code
                                  key={v}
                                  className={`text-[10px] rounded px-1.5 py-0.5 cursor-pointer transition-colors font-mono select-none
                                    ${focusedVarIdx !== null
                                      ? 'bg-orange-50 border border-orange-300 text-orange-700 hover:bg-orange-100'
                                      : 'bg-white border border-slate-200 text-slate-600 hover:border-orange-300 hover:text-orange-700'
                                    }`}
                                  title={focusedVarIdx !== null ? `Insert ${v} into field #${focusedVarIdx + 1}` : 'Focus a variable field first, then click to insert'}
                                  onClick={() => {
                                    if (focusedVarIdx !== null) {
                                      // Insert into the focused right-side variable input
                                      updateField(focusedVarIdx, 'variable', v);
                                    } else {
                                      // No field focused — copy to clipboard as fallback
                                      navigator.clipboard?.writeText(v);
                                    }
                                  }}
                                >{v}</code>
                              ))}
                            </div>
                          )}
                          <p className="text-[9px] text-slate-400 mt-1.5">
                            {focusedVarIdx !== null
                              ? `Click a variable to insert it into the field #${focusedVarIdx + 1} variable input`
                              : 'Click any variable field on the right → then click a chip to insert it there'}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Divider */}
                    <div className="border-t border-slate-100" />

                    {/* Success condition */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Success Condition</label>
                      <p className="text-[10px] text-slate-400 mb-2">Determines which branch (SUCCESS / FAIL) to take after the call</p>
                      <select
                        className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
                        value={d.successCondition || 'status_2xx'}
                        onChange={e => updateNodeFields(selectedNode.id, { successCondition: e.target.value })}
                      >
                        <option value="status_2xx">HTTP 2xx status = SUCCESS</option>
                        <option value="field_true">Response JSON field equals value</option>
                      </select>

                      {d.successCondition === 'field_true' && (
                        <div className="mt-2 space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300"
                              placeholder="response field e.g. success"
                              value={d.successField || ''}
                              onChange={e => updateNodeFields(selectedNode.id, { successField: e.target.value })}
                            />
                            <span className="text-slate-400 text-xs self-center">=</span>
                            <input
                              type="text"
                              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-orange-300"
                              placeholder="true"
                              value={d.successValue || ''}
                              onChange={e => updateNodeFields(selectedNode.id, { successValue: e.target.value })}
                            />
                          </div>
                          <p className="text-[10px] text-slate-400">e.g. field <code className="bg-slate-100 px-0.5 rounded">success</code> = <code className="bg-slate-100 px-0.5 rounded">true</code></p>
                        </div>
                      )}
                    </div>

                    {/* Branch legend */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-green-50 border border-green-100 rounded-lg p-2.5 text-center">
                        <div className="text-[11px] font-bold text-green-700 mb-0.5">✓ SUCCESS branch</div>
                        <div className="text-[10px] text-green-500">XOLOX responded OK</div>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 text-center">
                        <div className="text-[11px] font-bold text-red-600 mb-0.5">✗ FAIL branch</div>
                        <div className="text-[10px] text-red-400">Error or condition not met</div>
                      </div>
                    </div>

                  </div>
                );
              })()}

              {selectedNode.type === 'campaign_condition' && (() => {
                const conditions = selectedNode.data.conditions || [
                  { variable: 'WA message', operator: 'eq', value: 'delivered' }
                ];
                const MAX = 5;

                const updateConditions = (newConds) => {
                  updateNodeFields(selectedNode.id, { conditions: newConds });
                };

                const updateCond = (idx, field, val) => {
                  const next = conditions.map((c, i) => i === idx ? { ...c, [field]: val } : c);
                  updateConditions(next);
                };

                const addCond = () => {
                  if (conditions.length >= MAX) return;
                  updateConditions([...conditions, { variable: 'WA message', operator: 'eq', value: 'delivered' }]);
                };

                const removeCond = (idx) => {
                  if (conditions.length <= 1) return;
                  updateConditions(conditions.filter((_, i) => i !== idx));
                };

                return (
                  <div className="space-y-4">
                    {/* Timing mode toggle */}
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">When to Check</label>
                      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
                        <button
                          type="button"
                          onClick={() => updateNodeData('timingMode', 'after')}
                          className={`flex-1 py-1.5 font-medium transition-colors ${(selectedNode.data.timingMode || 'after') === 'after'
                            ? 'bg-violet-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                          After Duration
                        </button>
                        <button
                          type="button"
                          onClick={() => updateNodeData('timingMode', 'specific')}
                          className={`flex-1 py-1.5 font-medium transition-colors ${selectedNode.data.timingMode === 'specific'
                            ? 'bg-violet-600 text-white'
                            : 'bg-white text-slate-500 hover:bg-slate-50'
                            }`}
                        >
                          Specific Date &amp; Time
                        </button>
                      </div>
                    </div>

                    {/* After Duration */}
                    {(selectedNode.data.timingMode || 'after') === 'after' && (() => {
                      const d = parseInt(selectedNode.data.checkDays) || 0;
                      const h = parseInt(selectedNode.data.checkHours) || 0;
                      const m = parseInt(selectedNode.data.checkMinutes) || 0;
                      const totalMs = (d * 86400 + h * 3600 + m * 60) * 1000;
                      const recheckAt = totalMs > 0 ? new Date(Date.now() + totalMs) : null;
                      return (
                        <div className="space-y-2">
                          <label className="block text-xs text-slate-500">Duration from now</label>
                          <div className="grid grid-cols-3 gap-2">
                            {[['checkDays', 'Days'], ['checkHours', 'Hours'], ['checkMinutes', 'Mins']].map(([key, lbl]) => (
                              <div key={key}>
                                <label className="block text-[10px] text-slate-400 mb-0.5 text-center">{lbl}</label>
                                <input
                                  type="number" min="0"
                                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm text-center"
                                  value={selectedNode.data[key] ?? 0}
                                  onChange={e => updateNodeData(key, Math.max(0, parseInt(e.target.value) || 0))}
                                />
                              </div>
                            ))}
                          </div>
                          {recheckAt ? (
                            <div className="bg-violet-50 border border-violet-100 rounded-md px-3 py-2 text-xs text-violet-700">
                              🔁 Will recheck at: <b>{recheckAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</b>
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 text-center py-1">Enter a duration above to see recheck time</div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Specific date/time */}
                    {selectedNode.data.timingMode === 'specific' && (
                      <div className="space-y-2">
                        <label className="block text-xs text-slate-500">Recheck at this exact date &amp; time</label>
                        <input
                          type="datetime-local"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.specificTime || ''}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={e => updateNodeData('specificTime', e.target.value)}
                        />
                        {selectedNode.data.specificTime && (
                          <div className="bg-violet-50 border border-violet-100 rounded-md px-3 py-2 text-xs text-violet-700">
                            🔁 Will recheck at: <b>{new Date(selectedNode.data.specificTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</b>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Condition Groups */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-slate-700">Conditions</label>
                        <span className="text-xs text-slate-400">{conditions.length}/{MAX}</span>
                      </div>

                      <div className="space-y-3">
                        {conditions.map((cond, idx) => (
                          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Group {idx + 1}</span>
                              {conditions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => removeCond(idx)}
                                  className="text-red-400 hover:text-red-600 text-xs"
                                >
                                  ✕ Remove
                                </button>
                              )}
                            </div>

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Variable</label>
                              <select
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                                value={cond.variable || 'WA message'}
                                onChange={e => updateCond(idx, 'variable', e.target.value)}
                              >
                                <option value="WA message">WA Message</option>
                                <option value="link">Link</option>
                                <option value="Email">Email</option>
                                <option value="SMS">SMS</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Condition</label>
                              <select
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                                value={cond.operator || 'eq'}
                                onChange={e => updateCond(idx, 'operator', e.target.value)}
                              >
                                <option value="eq">Equal to</option>
                                <option value="neq">Not equal to</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs text-slate-500 mb-1">Value</label>
                              <select
                                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-xs"
                                value={cond.value || 'delivered'}
                                onChange={e => updateCond(idx, 'value', e.target.value)}
                              >
                                <option value="sent">Sent</option>
                                <option value="delivered">Delivered</option>
                                <option value="opened">Opened</option>
                                <option value="clicked">Clicked</option>
                                <option value="replied">Replied</option>
                              </select>
                            </div>

                            <div className="text-[10px] text-violet-600 bg-violet-50 border border-violet-100 rounded px-2 py-1 font-mono">
                              {cond.variable} {cond.operator === 'eq' ? '==' : '!='} "{cond.value}"
                            </div>
                          </div>
                        ))}
                      </div>

                      {conditions.length < MAX && (
                        <button
                          type="button"
                          onClick={addCond}
                          className="mt-3 w-full flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded-lg py-2 text-xs text-slate-500 hover:border-violet-400 hover:text-violet-600 transition-colors"
                        >
                          <Plus size={12} /> Add Condition Group
                        </button>
                      )}

                      {conditions.length >= MAX && (
                        <p className="text-[10px] text-slate-400 text-center mt-2">Maximum of {MAX} condition groups reached.</p>
                      )}
                    </div>
                  </div>
                );
              })()}


              {selectedNode.type === 'send_template' && (() => {
                const d = selectedNode.data;
                const tmpl = templates.find(t => t.name === d.template);
                const varKeys = tmpl ? extractTemplatePlaceholders(tmpl.bodyText || '') : [];
                const vars = d.variables || {};
                const headerType = d.headerType || 'none';

                // ── Helpers ────────────────────────────────────────
                const setHeader = (fields) => {
                  const hdr = {
                    headerType: fields.headerType ?? (d.headerType || 'none'),
                    headerUrl: fields.headerUrl ?? (d.headerUrl || ''),
                    headerFileName: fields.headerFileName ?? (d.headerFileName || ''),
                  };
                  const nextComps = tmpl ? buildTemplateComponentsPayload(tmpl, d.variables || {}, hdr) : (d.components || []);
                  updateNodeFields(selectedNode.id, { ...fields, components: nextComps });
                };

                // Compute upstream variables (same BFS as XOLOX panel)
                const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges);

                return (
                  <div className="space-y-4">

                    {/* ① Template picker */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-sm font-medium text-slate-700">Select Template</label>
                        {loadingTemplates && <Loader2 size={12} className="animate-spin text-slate-400" />}
                      </div>
                      <select
                        className="w-full border border-slate-300 rounded-md px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                        value={d.template || ''}
                        onChange={(e) => {
                          const tName = e.target.value;
                          const found = templates.find(t => t.name === tName);
                          let btns = [], content = '', nextVars = {}, components = [];
                          if (found) {
                            content = found.bodyText || '';
                            btns = (found.buttons || []).map(b => b.text).filter(Boolean);
                            extractTemplatePlaceholders(found.bodyText || '').forEach(k => {
                              nextVars[k] = (found.examples && found.examples[k]) || '';
                            });
                            const hdr = {
                              headerType: d.headerType || 'none',
                              headerUrl: d.headerUrl || '',
                              headerFileName: d.headerFileName || '',
                            };
                            components = buildTemplateComponentsPayload(found, nextVars, hdr);
                          }
                          if (!selectedNode) return;
                          setNodes(nds => nds.map(node => {
                            if (node.id !== selectedNode.id) return node;
                            const newData = { ...node.data, template: tName, buttons: btns, content, variables: nextVars, components, languageCode: found ? (found.language || 'en_US') : 'en_US' };
                            setSelectedNode({ ...node, data: newData });
                            return { ...node, data: newData };
                          }));
                        }}
                      >
                        <option value="">-- Select Template --</option>
                        {templates.length > 0
                          ? templates.map(t => <option key={t.id} value={t.name}>{t.name} ({t.language})</option>)
                          : <option disabled>No approved templates found</option>}
                      </select>
                      {tmpl && tmpl.bodyText && (
                        <div className="mt-1.5 text-[11px] bg-green-50 border border-green-100 rounded px-2 py-1.5 text-green-800 leading-relaxed whitespace-pre-wrap">
                          {tmpl.bodyText}
                        </div>
                      )}
                      {tmpl && (
                        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Parameter Format:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.parameterFormat}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Header Format:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.headerFormat}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Language:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.language}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                            <span className="text-slate-500">Category:</span>{' '}
                            <span className="font-semibold text-slate-700">{tmpl.category || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ② Media Header (only when template has a header component) */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center gap-2">
                        <Image size={13} className="text-slate-500" />
                        <span className="text-xs font-semibold text-slate-600">Media Header</span>
                        <span className="ml-auto text-[10px] text-slate-400">optional</span>
                      </div>
                      <div className="p-3 space-y-2">
                        {/* Type selector */}
                        <div className="flex gap-1.5">
                          {[
                            { key: 'none', label: 'None', icon: null },
                            { key: 'image', label: 'Image', icon: Image },
                            { key: 'video', label: 'Video', icon: Video },
                            { key: 'document', label: 'Document', icon: FileIcon },
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => setHeader({ headerType: key, headerUrl: '', headerFileName: '' })}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[10px] font-medium transition-colors ${headerType === key
                                ? 'bg-green-50 border-green-400 text-green-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                              {Icon && <Icon size={13} />}
                              {label}
                            </button>
                          ))}
                        </div>

                        {headerType !== 'none' && (
                          <div className="space-y-2 pt-1">
                            {/* Current preview */}
                            {d.headerUrl && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                                {headerType === 'image' && (
                                  <img src={d.headerUrl} alt="header" className="w-10 h-10 object-cover rounded" onError={e => { e.target.style.display = 'none'; }} />
                                )}
                                {headerType === 'video' && <Video size={20} className="text-slate-400 shrink-0" />}
                                {headerType === 'document' && <FileIcon size={20} className="text-slate-400 shrink-0" />}
                                <span className="text-[11px] text-slate-600 truncate flex-1 min-w-0">{d.headerFileName || d.headerUrl}</span>
                                <button type="button" onClick={() => setHeader({ headerUrl: '', headerFileName: '' })} className="text-red-400 hover:text-red-600 shrink-0">
                                  <X size={13} />
                                </button>
                              </div>
                            )}

                            {/* Actions: Upload or Gallery */}
                            <div className="flex gap-1.5">
                              <label className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-2 text-[11px] text-slate-500 hover:border-green-400 hover:text-green-600 cursor-pointer transition-colors">
                                <Upload size={12} />
                                Upload file
                                <input
                                  type="file"
                                  className="sr-only"
                                  accept={
                                    headerType === 'image' ? 'image/*' :
                                      headerType === 'video' ? 'video/*' :
                                        'application/pdf,.doc,.docx,.xlsx,.pptx'
                                  }
                                  onChange={async (e) => {
                                    const file = e.target.files && e.target.files[0];
                                    if (!file) return;
                                    try {
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      const res = await uploadFlowMedia(formData);
                                      const url = res.url || res.link || res.data?.url || '';
                                      setHeader({ headerUrl: url, headerFileName: file.name });
                                    } catch (err) {
                                      console.error('Upload failed', err);
                                      alert('Upload failed: ' + err.message);
                                    }
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={openGallery}
                                className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-2 text-[11px] text-slate-500 hover:border-green-400 hover:text-green-600 transition-colors"
                              >
                                <Image size={12} />
                                From gallery
                              </button>
                            </div>

                            {/* Manual URL input */}
                            <input
                              type="url"
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-green-300"
                              placeholder="or paste a direct URL…"
                              value={d.headerUrl || ''}
                              onChange={e => setHeader({ headerUrl: e.target.value, headerFileName: '' })}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ③ Template variables with upstream chips */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-sm font-medium text-slate-700">
                          Variables{tmpl ? (tmpl.parameterFormat === 'POSITIONAL' ? ' (POSITIONAL — order matters)' : ' (NAMED)') : ''}
                        </label>
                        {templateFocusedVarKey && (
                          <span className="text-[10px] text-green-600 font-medium">→ inserting into {`{{${templateFocusedVarKey}}}`}</span>
                        )}
                      </div>

                      {!tmpl || varKeys.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">
                          {d.template ? 'This template has no variables.' : 'Select a template above.'}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {varKeys.map(k => (
                            <div key={k} className={`rounded p-1 transition-colors ${templateFocusedVarKey === k ? 'bg-green-50 ring-1 ring-green-200' : ''}`}>
                              <div className="text-[11px] text-slate-500 font-mono mb-0.5">{'{{' + k + '}}'}</div>
                              <input
                                className={`w-full border rounded px-2 py-1.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-green-300 transition-colors ${templateFocusedVarKey === k ? 'border-green-400 bg-green-50' : 'border-slate-300'
                                  }`}
                                placeholder={`Value or {{variable}}`}
                                value={vars[k] || ''}
                                onChange={(e) => {
                                  const nextVars = { ...vars, [k]: e.target.value };
                                  const hdr = {
                                    headerType: d.headerType || 'none',
                                    headerUrl: d.headerUrl || '',
                                    headerFileName: d.headerFileName || '',
                                  };
                                  const nextComps = buildTemplateComponentsPayload(tmpl, nextVars, hdr);
                                  updateNodeFields(selectedNode.id, { variables: nextVars, components: nextComps });
                                }}
                                onFocus={() => setTemplateFocusedVarKey(k)}
                                onBlur={() => setTimeout(() => setTemplateFocusedVarKey(null), 200)}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Upstream variable chips */}
                      <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                        <div className="text-[11px] font-semibold text-slate-600 mb-1">
                          Variables from upstream nodes
                          {templateFocusedVarKey && (
                            <span className="ml-1 text-[10px] font-normal text-green-500">click chip to insert into focused field</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {upstreamVars.map(v => (
                            <code
                              key={v}
                              className={`text-[10px] rounded px-1.5 py-0.5 cursor-pointer font-mono select-none transition-colors ${templateFocusedVarKey
                                ? 'bg-green-50 border border-green-300 text-green-700 hover:bg-green-100'
                                : 'bg-white border border-slate-200 text-slate-500 hover:border-green-300 hover:text-green-700'
                                }`}
                              title={templateFocusedVarKey ? `Insert ${v} into {{${templateFocusedVarKey}}}` : 'Focus a variable input first'}
                              onClick={() => {
                                if (templateFocusedVarKey) {
                                  const nextVars = { ...vars, [templateFocusedVarKey]: v };
                                  const hdr = {
                                    headerType: d.headerType || 'none',
                                    headerUrl: d.headerUrl || '',
                                    headerFileName: d.headerFileName || '',
                                  };
                                  const nextComps = buildTemplateComponentsPayload(tmpl, nextVars, hdr);
                                  updateNodeFields(selectedNode.id, { variables: nextVars, components: nextComps });
                                } else {
                                  navigator.clipboard?.writeText(v);
                                }
                              }}
                            >{v}</code>
                          ))}
                        </div>
                        <p className="text-[9px] text-slate-400 mt-1">
                          {templateFocusedVarKey
                            ? `Click a chip to fill in {{${templateFocusedVarKey}}}`
                            : 'Click a variable input above, then click a chip to fill it'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}



              {selectedNode.type === 'response_message' && (() => {
                const d = selectedNode.data;
                const headerType = d.headerType || 'none';
                const buttons = d.buttons || [];
                const msg = d.message || '';

                // Compute upstream variables (reuse same logic)
                const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges);

                const setField = (key, val) => updateNodeFields(selectedNode.id, { [key]: val });

                return (
                  <div className="space-y-4">
                    {/* ① Media Header */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <div className="bg-teal-50 px-3 py-2 border-b border-teal-100 flex items-center gap-2">
                        <Image size={13} className="text-teal-600" />
                        <span className="text-xs font-semibold text-teal-800">Media Option (Optional)</span>
                      </div>
                      <div className="p-3 space-y-3">
                        {/* Type selector */}
                        <div className="flex gap-1.5">
                          {[
                            { key: 'none', label: 'None', icon: null },
                            { key: 'image', label: 'Image', icon: Image },
                            { key: 'video', label: 'Video', icon: Video },
                            { key: 'document', label: 'Document', icon: FileIcon },
                          ].map(({ key, label, icon: Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => updateNodeFields(selectedNode.id, { headerType: key, headerUrl: '', headerFileName: '' })}
                              className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded border text-[10px] font-medium transition-colors ${headerType === key
                                ? 'bg-teal-50 border-teal-400 text-teal-700'
                                : 'bg-white border-slate-200 text-slate-500 hover:border-teal-300'
                                }`}
                            >
                              {Icon && <Icon size={12} />}
                              {label}
                            </button>
                          ))}
                        </div>

                        {headerType !== 'none' && (
                          <div className="space-y-2">
                            {d.headerUrl && (
                              <div className="flex items-center gap-2 bg-slate-50 rounded px-2 py-1.5 border border-slate-200">
                                <span className="text-[11px] text-slate-600 truncate flex-1 min-w-0">{d.headerFileName || d.headerUrl}</span>
                                <button type="button" onClick={() => updateNodeFields(selectedNode.id, { headerUrl: '', headerFileName: '' })} className="text-red-400 hover:text-red-600">
                                  <X size={12} />
                                </button>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <label className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-1.5 text-[10px] text-slate-500 hover:border-teal-400 hover:text-teal-600 cursor-pointer transition-colors text-center">
                                <Upload size={12} /> Upload
                                <input type="file" className="sr-only" onChange={async (e) => {
                                  const file = e.target.files?.[0]; if (!file) return;
                                  const formData = new FormData(); formData.append('file', file);
                                  const res = await uploadFlowMedia(formData);
                                  updateNodeFields(selectedNode.id, { headerUrl: res.url || res.data?.url || '', headerFileName: file.name });
                                }} />
                              </label>
                              <button onClick={openGallery} className="flex-1 flex items-center justify-center gap-1.5 border border-dashed border-slate-300 rounded px-2 py-1.5 text-[10px] text-slate-500 hover:border-teal-400 hover:text-teal-600 transition-colors text-center">
                                <Image size={12} /> Gallery
                              </button>
                            </div>
                            <input
                              className="w-full border border-slate-300 rounded px-2 py-1.5 text-[10px] font-mono focus:ring-1 focus:ring-teal-400 focus:outline-none"
                              placeholder="Paste public URL or {{variable}}..."
                              value={d.headerUrl || ''}
                              onChange={e => setField('headerUrl', e.target.value)}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ② Message Text */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">Message to send</label>
                      <textarea
                        className="w-full border border-slate-300 rounded-md p-2.5 text-sm min-h-[100px] focus:ring-2 focus:ring-teal-300 focus:outline-none"
                        placeholder="Type your message here... Use {{variable}} to map data."
                        value={msg}
                        onChange={(e) => setField('message', e.target.value)}
                        onFocus={() => setFocusedVarIdx('msg_text')}
                        onBlur={() => setTimeout(() => setFocusedVarIdx(null), 200)}
                      />

                      {/* Variable chips for message text */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {upstreamVars.map(v => (
                          <span
                            key={v}
                            onClick={() => {
                              if (focusedVarIdx === 'msg_text') {
                                setField('message', msg + v);
                              } else {
                                navigator.clipboard.writeText(v);
                              }
                            }}
                            className="bg-white border border-slate-200 text-slate-500 text-[9px] px-1.5 py-0.5 rounded cursor-pointer hover:border-teal-400 hover:text-teal-600 transition-colors font-mono"
                          >
                            {v}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* ③ Quick Replies (Buttons) */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-slate-700">Quick Replies</label>
                        <span className="text-[10px] text-slate-400">{buttons.length} options</span>
                      </div>
                      <div className="space-y-2">
                        {buttons.map((btn, idx) => (
                          <div key={idx} className="flex gap-1.5 items-center">
                            <input
                              className="flex-1 border border-slate-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-teal-400 outline-none"
                              value={btn}
                              placeholder={`Option ${idx + 1}`}
                              onChange={(e) => {
                                const next = [...buttons];
                                next[idx] = e.target.value;
                                setField('buttons', next);
                              }}
                            />
                            <button onClick={() => {
                              const next = buttons.filter((_, i) => i !== idx);
                              setField('buttons', next);
                            }} className="text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => setField('buttons', [...buttons, ''])}
                          className="w-full border border-dashed border-slate-300 rounded py-1.5 text-[11px] text-slate-400 hover:border-teal-400 hover:text-teal-600 transition-all flex items-center justify-center gap-1"
                        >
                          <Plus size={12} /> Add Option
                        </button>
                      </div>
                    </div>

                    {/* ④ Response Settings */}
                    <div className="pt-3 border-t border-slate-100 space-y-4">
                      {/* Save reply variable */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-slate-600 uppercase tracking-tight">Save reply in variable</label>
                        <div className="relative">
                          <input
                            className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs font-mono focus:ring-1 focus:ring-teal-400 outline-none pl-7"
                            placeholder="e.g. user_choice"
                            value={d.saveVariable || ''}
                            onChange={(e) => setField('saveVariable', e.target.value)}
                          />
                          <Code size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
                        </div>
                        <p className="text-[10px] text-slate-400 italic">This will store the text of the button user clicks.</p>
                      </div>

                      {/* Skip Toggle */}
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg p-3 border border-slate-100">
                        <div className="min-w-0 pr-2">
                          <div className="text-xs font-semibold text-slate-700">Skip User Reply</div>
                          <div className="text-[10px] text-slate-500 leading-tight">If ON, workflow continues immediately without waiting for user interaction.</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={!!d.skipReply}
                            onChange={(e) => setField('skipReply', e.target.checked)}
                          />
                          <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                );
              })()}


              {selectedNode.type === 'feedback' && (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-yellow-600 flex items-center justify-center text-white shadow-sm">
                      <Star size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-yellow-800 uppercase tracking-tight">Feedback Collection</span>
                      <h3 className="text-sm font-bold text-slate-800">Customer CSAT Tracking</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Feedback Question</label>
                      <textarea
                        className="w-full text-sm p-3 border border-slate-300 rounded-lg h-24 focus:ring-2 focus:ring-yellow-500/20 focus:outline-none"
                        value={selectedNode.data.question || ''}
                        onChange={(e) => updateNodeData('question', e.target.value)}
                        placeholder="e.g. Your feedback matters! Please rate this chat on scale of 1-5"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Button Display Style</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { key: 'numbers', label: 'Numbers', icon: '🔢' },
                          { key: 'emojis', label: 'Emojis', icon: '😄' },
                          { key: 'stars', label: 'Stars', icon: '⭐' },
                        ].map((style) => (
                          <button
                            key={style.key}
                            type="button"
                            onClick={() => updateNodeData('buttonStyle', style.key)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${(selectedNode.data.buttonStyle || 'numbers') === style.key
                              ? 'border-yellow-500 bg-yellow-50 shadow-sm'
                              : 'bg-white border-slate-100 text-slate-600 hover:border-yellow-200'
                              }`}
                          >
                            <span className="text-xl mb-1">{style.icon}</span>
                            <span className="text-[10px] font-bold">{style.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mt-6 group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 bg-white rounded-lg border border-slate-200 text-indigo-500 transition-colors group-hover:border-indigo-200">
                          <RefreshCw size={14} className="animate-spin-slow" />
                        </div>
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Analytics Integration</h4>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-relaxed italic">
                        Responses are automatically captured and calculated as <b>CSAT = (Promoters / Total) × 100</b>. View live metrics in your dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {(selectedNode.type === 'payment_request' || selectedNode.type === 'razorpay_link') && (
                <div className="space-y-6">
                  <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-indigo-800 uppercase tracking-tight">
                        {selectedNode.type === 'razorpay_link' ? 'Razorpay Link' : 'Payment Request'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">Generate & Send</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Request Type</label>
                        <select
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none bg-white"
                          value={selectedNode.data.requestType || 'course'}
                          onChange={(e) => updateNodeData('requestType', e.target.value)}
                        >
                          <option value="course">Course Payment</option>
                          <option value="webinar">Webinar Enrollment</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Amount (₹)</label>
                        <input
                          type="number"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
                          value={selectedNode.data.amount || ''}
                          onChange={(e) => updateNodeData('amount', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {selectedNode.data.requestType === 'webinar' ? (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Webinar Name</label>
                        <input
                          type="text"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                          value={selectedNode.data.webinarName || ''}
                          onChange={(e) => updateNodeData('webinarName', e.target.value)}
                          placeholder="Enter webinar title..."
                        />
                      </div>
                    ) : (
                      <>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Selected Course</label>
                          <select
                            className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white"
                            value={selectedNode.data.course || 'CPA US'}
                            onChange={(e) => {
                              updateNodeData('course', e.target.value);
                              updateNodeData('papers', []);
                            }}
                          >
                            <option value="CPA US">CPA US (Certified Public Accountant)</option>
                            <option value="CMA US">CMA US (Certified Management Accountant)</option>
                            <option value="ACCA">ACCA (Global Accountancy)</option>
                            <option value="EA">EA (Enrolled Agent)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Select Papers Included</label>
                          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-[300px] overflow-y-auto no-scrollbar">
                            {(() => {
                              const course = selectedNode.data.course || 'CPA US';
                              const papers = COURSE_PAPERS[course] || [];

                              if (course === 'ACCA') {
                                return papers.map(lvl => (
                                  <div key={lvl.level} className="mb-4 last:mb-0">
                                    <div className="text-[9px] font-black text-indigo-500 uppercase mb-2 tracking-tighter border-b border-indigo-100 pb-1">
                                      {lvl.level}
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {lvl.papers.map(p => (
                                        <label key={p.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 cursor-pointer transition-all shadow-sm">
                                          <input
                                            type="checkbox"
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                            checked={(selectedNode.data.papers || []).includes(p.id)}
                                            onChange={(e) => {
                                              const current = selectedNode.data.papers || [];
                                              const next = e.target.checked
                                                ? [...current, p.id]
                                                : current.filter(item => item !== p.id);
                                              updateNodeData('papers', next);
                                            }}
                                          />
                                          <div className="min-w-0">
                                            <div className="text-[10px] font-bold text-slate-800 leading-none mb-0.5">{p.id}</div>
                                            <div className="text-[8px] text-slate-500 truncate">{p.name}</div>
                                          </div>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              }

                              // Default for CPA, CMA, EA
                              return (
                                <div className="grid grid-cols-2 gap-2">
                                  {papers.map(p => (
                                    <label key={p.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-100 hover:border-indigo-200 cursor-pointer transition-all shadow-sm">
                                      <input
                                        type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                        checked={(selectedNode.data.papers || []).includes(p.id)}
                                        onChange={(e) => {
                                          const current = selectedNode.data.papers || [];
                                          const next = e.target.checked
                                            ? [...current, p.id]
                                            : current.filter(item => item !== p.id);
                                          updateNodeData('papers', next);
                                        }}
                                      />
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-bold text-slate-800 leading-none mb-0.5">{p.id}</div>
                                        <div className="text-[8px] text-slate-500 truncate">{p.name}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Package Name</label>
                            <input
                              type="text"
                              className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                              value={selectedNode.data.packageName || ''}
                              onChange={(e) => updateNodeData('packageName', e.target.value)}
                              placeholder="e.g. Platinum Plus"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Validity Terms</label>
                            <input
                              type="text"
                              className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                              value={selectedNode.data.validityTerms || ''}
                              onChange={(e) => updateNodeData('validityTerms', e.target.value)}
                              placeholder="e.g. 18 Months"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Summary / Remarks</label>
                      <textarea
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg h-16 resize-none"
                        value={selectedNode.data.paymentSummary || ''}
                        onChange={(e) => updateNodeData('paymentSummary', e.target.value)}
                        placeholder="e.g. Advance payment for full course enrollment..."
                      />
                    </div>

                    <div className="space-y-4 pt-4 border-t border-slate-100">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded w-fit">Message Customization</h4>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Interactive Header</label>
                        <input
                          type="text"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                          value={selectedNode.data.headerText || '💳 Secure Payment Request'}
                          onChange={(e) => updateNodeData('headerText', e.target.value)}
                          placeholder="Checkout Now..."
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Button Label</label>
                          <input
                            type="text"
                            className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                            value={selectedNode.data.buttonText || 'Pay Now'}
                            onChange={(e) => updateNodeData('buttonText', e.target.value)}
                            placeholder="e.g. Pay Now"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Footer Note</label>
                          <input
                            type="text"
                            className="w-full text-sm p-2 border border-slate-300 rounded-lg"
                            value={selectedNode.data.footerText || 'Official Razorpay link'}
                            onChange={(e) => updateNodeData('footerText', e.target.value)}
                            placeholder="e.g. Valid for 24h"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl mt-4 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500"></div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">WhatsApp Preview</span>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                        </div>
                      </div>

                      <div className="bg-[#e5ddd5] rounded-lg p-3 shadow-inner relative max-w-[240px] ml-1">
                        <div className="text-[11px] font-bold text-slate-800 border-b border-white/50 pb-1.5 mb-2">
                          {selectedNode.data.headerText || '💳 Secure Payment Request'}
                        </div>
                        <div className="text-[10px] text-slate-600 whitespace-pre-line leading-relaxed pb-2">
                          {(selectedNode.data.requestType === 'course')
                            ? `💳 *Payment Request*\n*Course:* ${selectedNode.data.course || 'Select...'}\n*Amount:* ₹${selectedNode.data.amount || '0'}`
                            : `💳 *Payment Request*\n*Webinar:* ${selectedNode.data.webinarName || 'Enter...'}\n*Amount:* ₹${selectedNode.data.amount || '0'}`
                          }
                          {selectedNode.data.paymentSummary && `\n\n*Note:* ${selectedNode.data.paymentSummary}`}
                        </div>
                        <div className="text-[8px] text-slate-400 mt-1 uppercase italic tracking-tighter">
                          {selectedNode.data.footerText || 'Official Razorpay link'}
                        </div>

                        <div className="mt-3 bg-white hover:bg-slate-50 rounded-md py-2 flex items-center justify-center gap-2 text-[#00a884] font-bold text-[11px] shadow-sm transition-colors cursor-pointer border border-slate-100">
                          <Link size={12} />
                          {selectedNode.data.buttonText || 'Pay Now'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 space-y-3">
                      <Button
                        variant="secondary"
                        className="w-full bg-slate-800 text-white border border-slate-700 hover:bg-slate-900 flex items-center justify-center gap-2 group transition-all shadow-lg py-2.5"
                        onClick={async () => {
                          const amt = selectedNode.data.amount;
                          if (!amt || isNaN(amt)) return alert('Please enter a valid amount');

                          try {
                            const result = await createPaymentLink({
                              amount: parseFloat(amt),
                              description: (selectedNode.data.requestType === 'course') ? `Course: ${selectedNode.data.course}` : `Webinar: ${selectedNode.data.webinarName}`,
                              contact: '9123456789',
                              email: 'test@example.com',
                              notes: { source: 'preview', node_id: selectedNode.id }
                            });

                            if (result && result.short_url) {
                              updateNodeData('generatedLink', result.short_url);
                              navigator.clipboard.writeText(result.short_url);
                            }
                          } catch (err) {
                            alert(`Error: ${err.message}`);
                          }
                        }}
                      >
                        <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-500" />
                        Generate Live Test Link
                      </Button>

                      {selectedNode.data.generatedLink && (
                        <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                          <label className="text-[10px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                            <Check size={10} /> Live Checkout URL
                          </label>
                          <div className="flex gap-1">
                            <input
                              readOnly
                              type="text"
                              className="flex-1 text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 p-2 rounded-lg font-mono focus:outline-none"
                              value={selectedNode.data.generatedLink}
                            />
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(selectedNode.data.generatedLink);
                                alert('URL Copied!');
                              }}
                              className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 border border-emerald-200"
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                          <p className="text-[9px] text-slate-400">Generated successfully. Copied to clipboard.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {(selectedNode.type === 'payment_reminder' || selectedNode.type === 'razorpay_status') && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-sm">
                      <BellRing size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-tight">
                        {selectedNode.type === 'razorpay_status' ? 'Razorpay Status' : 'Payment Reminder'}
                      </span>
                      <h3 className="text-sm font-bold text-slate-800">Smart Follow-up</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                      <div className="flex items-start gap-2">
                        <Clock size={14} className="text-blue-600 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-normal font-medium">
                          Wait for the selected time, then branch based on payment completion.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Wait Duration</label>
                        <input
                          type="number"
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                          value={selectedNode.data.duration || '24'}
                          onChange={(e) => updateNodeData('duration', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Unit</label>
                        <select
                          className="w-full text-sm p-2 border border-slate-300 rounded-lg bg-white"
                          value={selectedNode.data.unit || 'hours'}
                          onChange={(e) => updateNodeData('unit', e.target.value)}
                        >
                          <option value="minutes">Minutes</option>
                          <option value="hours">Hours</option>
                          <option value="days">Days</option>
                        </select>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Automation Branches</h4>
                      <div className="space-y-2">
                        <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
                            <span className="text-xs font-bold text-emerald-800">PAID</span>
                          </div>
                          <span className="text-[9px] text-emerald-600 font-medium">Exit ID: paid</span>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg border border-red-100 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500 shadow-sm" />
                            <span className="text-xs font-bold text-red-800">UNPAID</span>
                          </div>
                          <span className="text-[9px] text-red-600 font-medium">Exit ID: unpaid</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'exotel_call' && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-sm">
                      <Phone size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-tight">Exotel VoIP</span>
                      <h3 className="text-sm font-bold text-slate-800">Initiate Outbound Call</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-medium leading-normal">
                        This node places an outbound call via Exotel. Use <code className="bg-blue-100 px-1 rounded">{'{{contact.phone}}'}</code> to call the current contact. Exotel must be connected in Settings → Integrations.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">To Number (Customer)</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                        value={selectedNode.data.toNumber || '{{contact.phone}}'}
                        onChange={e => updateNodeData('toNumber', e.target.value)}
                        placeholder="{{contact.phone}} or +91XXXXXXXXXX"
                      />
                      <p className="text-[10px] text-slate-400">Supports variables like {'{{contact.phone}}'}.</p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Caller ID (ExoPhone)</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                        value={selectedNode.data.callerId || ''}
                        onChange={e => updateNodeData('callerId', e.target.value)}
                        placeholder="Leave blank to use default from Settings"
                      />
                      <p className="text-[10px] text-slate-400">The ExoPhone virtual number shown to the customer. Leave blank to use the default configured in Integrations.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="exotel_record"
                        checked={!!selectedNode.data.record}
                        onChange={e => updateNodeData('record', e.target.checked)}
                        className="w-4 h-4 accent-orange-500"
                      />
                      <label htmlFor="exotel_record" className="text-sm text-slate-700 font-medium">Record this call</label>
                    </div>

                    {/* Branch info */}
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Branches</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-xs font-bold text-green-800">ANSWERED</span>
                          </div>
                          <span className="text-[9px] text-green-600 font-medium">Handle: answered</span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            <span className="text-xs font-bold text-red-800">FAILED / BUSY</span>
                          </div>
                          <span className="text-[9px] text-red-600 font-medium">Handle: failed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'twilio_sms' && (
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white shadow-sm">
                      <MessageSquare size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-red-800 uppercase tracking-tight">Twilio</span>
                      <h3 className="text-sm font-bold text-slate-800">Send SMS</h3>
                    </div>
                  </div>
                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-medium leading-normal">
                        Sends an SMS via Twilio to the specified number. Use <code className="bg-blue-100 px-1 rounded">{'{{contact.phone}}'}</code> for the current contact. Twilio must be connected in Settings → Integrations.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">To Number</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                        value={selectedNode.data.toNumber || '{{contact.phone}}'}
                        onChange={e => updateNodeData('toNumber', e.target.value)}
                        placeholder="{{contact.phone}} or +91XXXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">SMS Message</label>
                      <textarea
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none resize-none"
                        rows={4}
                        value={selectedNode.data.message || ''}
                        onChange={e => updateNodeData('message', e.target.value)}
                        placeholder="Hello {{contact.name}}, your order is confirmed!"
                      />
                      <p className="text-[10px] text-slate-400">Supports variables like {'{{contact.name}}'}.</p>
                    </div>
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Branches</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs font-bold text-green-800">SENT</span></div>
                          <span className="text-[9px] text-green-600 font-medium">Handle: sent</span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-xs font-bold text-red-800">FAILED</span></div>
                          <span className="text-[9px] text-red-600 font-medium">Handle: failed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'twilio_call' && (
                <div className="space-y-6">
                  <div className="p-4 bg-red-50 rounded-lg border border-red-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center text-white shadow-sm">
                      <Phone size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-red-800 uppercase tracking-tight">Twilio</span>
                      <h3 className="text-sm font-bold text-slate-800">Outbound Voice Call</h3>
                    </div>
                  </div>
                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-700 font-medium leading-normal">
                        Places an outbound call via Twilio. Use <code className="bg-blue-100 px-1 rounded">{'{{contact.phone}}'}</code> to call the current contact. Twilio must be connected in Settings → Integrations.
                      </p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">To Number</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                        value={selectedNode.data.toNumber || '{{contact.phone}}'}
                        onChange={e => updateNodeData('toNumber', e.target.value)}
                        placeholder="{{contact.phone}} or +91XXXXXXXXXX"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">From Number (optional)</label>
                      <input
                        className="w-full text-sm p-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                        value={selectedNode.data.fromNumber || ''}
                        onChange={e => updateNodeData('fromNumber', e.target.value)}
                        placeholder="Leave blank to use default from Settings"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="twilio_record"
                        checked={!!selectedNode.data.record}
                        onChange={e => updateNodeData('record', e.target.checked)}
                        className="w-4 h-4 accent-red-500"
                      />
                      <label htmlFor="twilio_record" className="text-sm text-slate-700 font-medium">Record this call</label>
                    </div>
                    <div className="space-y-2 mt-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Branches</label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-green-50 border border-green-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs font-bold text-green-800">ANSWERED</span></div>
                          <span className="text-[9px] text-green-600 font-medium">Handle: answered</span>
                        </div>
                        <div className="p-3 bg-red-50 border border-red-100 rounded-xl">
                          <div className="flex items-center gap-1.5 mb-1"><div className="w-2 h-2 rounded-full bg-red-500" /><span className="text-xs font-bold text-red-800">FAILED / BUSY</span></div>
                          <span className="text-[9px] text-red-600 font-medium">Handle: failed</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'notification' && (
                <div className="space-y-6">
                  <div className="p-4 bg-orange-50 rounded-lg border border-orange-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center text-white shadow-sm">
                      <Bell size={20} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-orange-800 uppercase tracking-tight">Internal Alert</span>
                      <h3 className="text-sm font-bold text-slate-800">Team Notification</h3>
                    </div>
                  </div>

                  <div className="space-y-4 px-1 pb-10">
                    <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 mb-2">
                      <div className="flex items-start gap-2">
                        <Megaphone size={14} className="text-blue-600 mt-0.5" />
                        <p className="text-[10px] text-blue-700 leading-normal font-medium">
                          This sends an instant alert to all active agents via the dashboard.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Alert Message</label>
                      <textarea
                        className="w-full text-sm p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:outline-none min-h-[120px]"
                        value={selectedNode.data.message || 'Alert team!'}
                        onChange={(e) => updateNodeData('message', e.target.value)}
                        placeholder="e.g. User reached payment step"
                      />
                    </div>
                  </div>
                </div>
              )}

              {selectedNode.type === 'delay' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Time Delay</label>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`flex-1 border rounded-md p-2 text-sm ${((selectedNode.data.delayMode || (selectedNode.data.targetAt ? 'specific' : 'relative')) === 'relative') ? 'border-orange-400 bg-orange-50' : 'border-slate-300 bg-white'}`}
                        onClick={() => updateNodeFields(selectedNode.id, { delayMode: 'relative', targetAt: null })}
                      >
                        After duration
                      </button>
                      <button
                        type="button"
                        className={`flex-1 border rounded-md p-2 text-sm ${((selectedNode.data.delayMode || (selectedNode.data.targetAt ? 'specific' : 'relative')) === 'specific') ? 'border-orange-400 bg-orange-50' : 'border-slate-300 bg-white'}`}
                        onClick={() => updateNodeFields(selectedNode.id, { delayMode: 'specific' })}
                      >
                        Specific date/time
                      </button>
                    </div>

                    {((selectedNode.data.delayMode || (selectedNode.data.targetAt ? 'specific' : 'relative')) === 'relative') ? (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Days</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={Number.isFinite(Number(selectedNode.data.days)) ? Number(selectedNode.data.days) : 0}
                            onChange={(e) => updateNodeFields(selectedNode.id, { days: parseInt(e.target.value || '0', 10) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Hours</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={Number.isFinite(Number(selectedNode.data.hours)) ? Number(selectedNode.data.hours) : 0}
                            onChange={(e) => updateNodeFields(selectedNode.id, { hours: parseInt(e.target.value || '0', 10) })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Minutes</label>
                          <input
                            type="number"
                            min="0"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={Number.isFinite(Number(selectedNode.data.minutes)) ? Number(selectedNode.data.minutes) : 0}
                            onChange={(e) => updateNodeFields(selectedNode.id, { minutes: parseInt(e.target.value || '0', 10) })}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Run at</label>
                        <input
                          type="datetime-local"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={(() => {
                            const iso = selectedNode.data.targetAt;
                            if (!iso) return '';
                            const d = new Date(iso);
                            if (isNaN(d.getTime())) return '';
                            const pad = (n) => String(n).padStart(2, '0');
                            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
                          })()}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) {
                              updateNodeFields(selectedNode.id, { targetAt: null });
                              return;
                            }
                            const iso = new Date(v).toISOString();
                            updateNodeFields(selectedNode.id, { targetAt: iso });
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Condition Type</label>
                  <select
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={selectedNode.data.conditionType || 'user_replied'}
                    onChange={(e) => updateNodeData('conditionType', e.target.value)}
                  >
                    <option value="user_replied">User Replied</option>
                    <option value="has_tag">User Has Tag</option>
                    <option value="variable_match">Variable Match</option>
                  </select>

                  {selectedNode.data.conditionType === 'has_tag' && (
                    <input
                      placeholder="Tag Name"
                      className="w-full border border-slate-300 rounded-md p-2 text-sm"
                      value={selectedNode.data.tagName || ''}
                      onChange={(e) => updateNodeData('tagName', e.target.value)}
                    />
                  )}

                  {selectedNode.data.conditionType === 'variable_match' && (
                    <div className="space-y-2">
                      <input
                        placeholder="Variable Name"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.variableName || ''}
                        onChange={(e) => updateNodeData('variableName', e.target.value)}
                      />
                      <input
                        placeholder="Value to Match"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.variableValue || ''}
                        onChange={(e) => updateNodeData('variableValue', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              {selectedNode.type === 'send_message' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Message Text</label>
                  <textarea
                    className="w-full border border-slate-300 rounded-md p-2 text-sm min-h-[100px]"
                    placeholder="Enter message text..."
                    value={selectedNode.data.message || ''}
                    onChange={(e) => updateNodeData('message', e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Note: Can only be sent within 24 hours of the user's last message.
                  </p>
                </div>
              )}

              {selectedNode.type === 'custom_code' && (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">JavaScript Code</label>
                  <textarea
                    className="w-full border border-slate-900 bg-slate-900 text-slate-50 rounded-md p-2 text-sm font-mono min-h-[200px]"
                    placeholder="// e.g. console.log('Processing request...')"
                    value={selectedNode.data.code || ''}
                    onChange={(e) => updateNodeData('code', e.target.value)}
                  />
                  <p className="text-xs text-slate-500">
                    Code runs in a restricted environment. Use `console.log` for debugging.
                  </p>
                </div>
              )}

              {selectedNode.type === 'attribute_condition' && (
                <div className="space-y-4">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
                    <div className="text-xs text-slate-600">Default route executes when none of the below match.</div>
                  </div>
                  {(() => {
                    const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges);
                    const allVars = getAllDefinedVariables(nodes);
                    const upstreamKeys = Array.from(
                      new Set(
                        upstreamVars
                          .map((v) => String(v).replace(/[{}]/g, '').trim())
                          .filter(Boolean)
                      )
                    );
                    const allKeys = Array.from(
                      new Set(
                        allVars
                          .map((v) => String(v).replace(/[{}]/g, '').trim())
                          .filter(Boolean)
                      )
                    );
                    const availableKeys = Array.from(new Set([...upstreamKeys, ...allKeys]));

                    return (
                      <div className="space-y-6">
                        {(Array.isArray(selectedNode.data.groups) ? selectedNode.data.groups : []).map((group, gi) => {
                          const clauses = Array.isArray(group.clauses) ? group.clauses : [];
                          return (
                            <div key={group.id || gi} className="border border-slate-200 rounded-md p-3">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-xs font-semibold text-slate-700">Condition Node {gi + 1}</div>
                                <button
                                  type="button"
                                  className="text-xs text-red-600"
                                  onClick={() => {
                                    const next = (selectedNode.data.groups || []).filter((_, idx) => idx !== gi);
                                    updateNodeFields(selectedNode.id, { groups: next });
                                  }}
                                >
                                  Delete
                                </button>
                              </div>
                              <div className="space-y-3">
                                {clauses.map((cl, ci) => (
                                  <div key={`${gi}-${ci}`} className="space-y-2">
                                    <div className="grid grid-cols-3 gap-2">
                                      <select
                                        className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                                        value={cl.key || ''}
                                        onChange={(e) => {
                                          const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                          groups[gi].clauses[ci].key = e.target.value;
                                          updateNodeFields(selectedNode.id, { groups });
                                        }}
                                      >
                                        {availableKeys.length === 0 ? (
                                          <option value="">No variables available</option>
                                        ) : (
                                          <option value="">Select attribute</option>
                                        )}
                                        {availableKeys.map((k) => (
                                          <option key={k} value={k}>
                                            {k}
                                          </option>
                                        ))}
                                        {cl.key && !availableKeys.includes(cl.key) && (
                                          <option value={cl.key}>{cl.key}</option>
                                        )}
                                      </select>
                                  <select
                                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                    value={cl.op || 'eq'}
                                    onChange={(e) => {
                                      const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                      groups[gi].clauses[ci].op = e.target.value;
                                      updateNodeFields(selectedNode.id, { groups });
                                    }}
                                  >
                                    <option value="eq">equal to (==)</option>
                                    <option value="neq">not equal to (!=)</option>
                                    <option value="gt">greater than (&gt;)</option>
                                    <option value="lt">less than (&lt;)</option>
                                    <option value="contains">contains</option>
                                    <option value="not_contains">not contains</option>
                                    <option value="starts_with">starts with</option>
                                    <option value="ends_with">ends with</option>
                                  </select>
                                  <input
                                    placeholder="Value"
                                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                    value={cl.value || ''}
                                    onChange={(e) => {
                                      const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                      groups[gi].clauses[ci].value = e.target.value;
                                      updateNodeFields(selectedNode.id, { groups });
                                    }}
                                  />
                                    </div>
                                    {ci < clauses.length - 1 && (
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          className={`px-3 py-1 text-xs rounded ${cl.join === 'AND' ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                                          onClick={() => {
                                            const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                            groups[gi].clauses[ci].join = 'AND';
                                            updateNodeFields(selectedNode.id, { groups });
                                          }}
                                        >
                                          AND
                                        </button>
                                        <span className="text-[10px] text-slate-500">OR</span>
                                        <button
                                          type="button"
                                          className={`px-3 py-1 text-xs rounded ${cl.join === 'OR' ? 'bg-violet-600 text-white' : 'bg-slate-200 text-slate-700'}`}
                                          onClick={() => {
                                            const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                            groups[gi].clauses[ci].join = 'OR';
                                            updateNodeFields(selectedNode.id, { groups });
                                          }}
                                        >
                                          OR
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ))}
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="px-3 py-1 text-xs border border-slate-300 rounded"
                                    onClick={() => {
                                      const groups = JSON.parse(JSON.stringify(selectedNode.data.groups || []));
                                      groups[gi].clauses.push({ key: '', op: 'eq', value: '', join: 'AND' });
                                      updateNodeFields(selectedNode.id, { groups });
                                    }}
                                  >
                                    Add Condition
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div>
                          <button
                            type="button"
                            className="px-3 py-2 text-xs border border-slate-300 rounded"
                            onClick={() => {
                              const groups = Array.isArray(selectedNode.data.groups) ? [...selectedNode.data.groups] : [];
                              groups.push({ id: `g${groups.length + 1}`, clauses: [{ key: '', op: 'eq', value: '', join: 'AND' }] });
                              updateNodeFields(selectedNode.id, { groups });
                            }}
                          >
                            Add Condition Node
                          </button>
                        </div>
                        <div className="text-[10px] text-slate-500">Create edges from this node: one for each Condition Node output and one Default.</div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedNode.type === 'action' && (
                <div className="space-y-3">
                  {/* Hide redundant dropdown if actionType is already specific */}
                  {['assign_agent', 'update_chat_status', 'add_to_label', 'send_email', 'send_sms_otp', 'start_workflow', 'update_lead_stage'].includes(selectedNode.data.actionType) ? (
                    <div className="space-y-1 pb-2 border-b border-slate-100">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide">Action Type</label>
                      <div className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                        {selectedNode.data.actionType === 'assign_agent' && <UserCheck size={16} className="text-orange-500" />}
                        {selectedNode.data.actionType === 'update_chat_status' && <MessageCircle size={16} className="text-cyan-500" />}
                        {selectedNode.data.actionType === 'add_to_label' && <Tag size={16} className="text-emerald-600" />}
                        {selectedNode.data.actionType === 'send_email' && <Mail size={16} className="text-blue-600" />}
                        {selectedNode.data.actionType === 'send_sms_otp' && <MessageSquare size={16} className="text-fuchsia-600" />}
                        {selectedNode.data.actionType === 'start_workflow' && <WorkflowIcon size={16} className="text-indigo-600" />}
                        {selectedNode.data.actionType === 'update_lead_stage' && <ListChecks size={16} className="text-slate-700" />}
                        {selectedNode.data.actionType === 'assign_agent'
                          ? 'Assign Agent'
                          : selectedNode.data.actionType === 'update_chat_status'
                            ? 'Update Chat Status'
                            : selectedNode.data.actionType === 'add_to_label'
                              ? 'Add To Label'
                              : selectedNode.data.actionType === 'send_email'
                                ? 'Send Email'
                                : selectedNode.data.actionType === 'send_sms_otp'
                                  ? 'Send SMS OTP'
                                  : selectedNode.data.actionType === 'update_lead_stage'
                                    ? 'Update Lead Stage'
                                    : 'Start Workflow'}
                      </div>
                    </div>
                  ) : (
                    <>
                      <label className="block text-sm font-medium text-slate-700">Action</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionType || 'add_tag'}
                        onChange={(e) => {
                          const type = e.target.value;
                          const base = {
                            actionType: type,
                            actionValue: '',
                            variableName: '',
                            variableValue: '',
                            targetWorkflowName: '',
                            emailTemplateId: '',
                            emailTemplateName: '',
                            variableMapping: {},
                            toVarKey: 'email',
                          };
                          if (type === 'update_chat_status') base.actionValue = 'open';
                          updateNodeFields(selectedNode.id, base);
                        }}
                      >
                        <option value="add_tag">Add to Label</option>
                        <option value="remove_tag">Remove Label</option>
                        <option value="assign_agent">Assign Agent</option>
                        <option value="set_variable">Update Attribute</option>
                        <option value="start_workflow">Start Workflow</option>
                        <option value="add_to_label">Add To Label</option>
                        <option value="send_email">Send Email</option>
                        <option value="send_sms_otp">Send SMS OTP</option>
                        <option value="update_chat_status">Update Chat Status</option>
                        <option value="update_lead_stage">Update Lead Stage</option>
                      </select>
                    </>
                  )}

                  {selectedNode.data.actionType === 'assign_agent' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                         <label className="text-xs text-slate-500">Assignment Mode</label>
                         <select 
                           className="w-full border border-slate-300 rounded-md p-2 text-sm"
                           value={selectedNode.data.assignMode || (selectedNode.data.actionValue?.includes('{') ? 'round_robin' : 'direct')}
                           onChange={(e) => {
                             const mode = e.target.value;
                             // Update local state for UI toggle
                             const newData = { ...selectedNode.data, assignMode: mode };
                             
                             if (mode === 'direct') {
                               newData.actionValue = '';
                             } else {
                               newData.actionValue = JSON.stringify({ course: '', language: '' });
                             }
                             
                             // We need to update the node in the parent state
                             // Since updateNodeData only updates one field, we might need a helper or just rely on react flow state
                             // But here updateNodeData is a local helper in this component.
                             // Let's check updateNodeData implementation.
                             // It calls setNodes...
                             // We can call it for assignMode first.
                             updateNodeFields(selectedNode.id, newData);
                           }}
                         >
                           <option value="direct">Direct Email</option>
                           <option value="round_robin">Round Robin (Conditions)</option>
                         </select>
                      </div>

                      {(selectedNode.data.assignMode === 'round_robin' || (selectedNode.data.actionValue && selectedNode.data.actionValue.includes('{'))) ? (
                        <div className="space-y-2 border-l-2 border-slate-200 pl-2">
                           {(() => {
                              let cond = {};
                              try { cond = JSON.parse(selectedNode.data.actionValue || '{}'); } catch(e){}
                              
                              const updateCond = (key, val) => {
                                 const newCond = { ...cond, [key]: val };
                                 updateNodeData('actionValue', JSON.stringify(newCond));
                              };

                              return (
                                <>
                                  <div className="space-y-1">
                                    <label className="text-xs text-slate-500">Course</label>
                                    <input
                                      placeholder="e.g. CPA"
                                      className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                      value={cond.course || ''}
                                      onChange={(e) => updateCond('course', e.target.value)}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <label className="text-xs text-slate-500">Language</label>
                                    <input
                                      placeholder="e.g. English"
                                      className="w-full border border-slate-300 rounded-md p-2 text-sm"
                                      value={cond.language || ''}
                                      onChange={(e) => updateCond('language', e.target.value)}
                                    />
                                  </div>
                                  <p className="text-[10px] text-slate-500">
                                    Assigns to available agent via Round Robin logic (Least Recently Assigned).
                                  </p>
                                </>
                              );
                           })()}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <label className="text-xs text-slate-500">Agent Email</label>
                          <input
                            placeholder="agent@example.com"
                            className="w-full border border-slate-300 rounded-md p-2 text-sm"
                            value={selectedNode.data.actionValue || ''}
                            onChange={(e) => updateNodeData('actionValue', e.target.value)}
                          />
                        </div>
                      )}
                    </div>
                  ) : selectedNode.data.actionType === 'set_variable' ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Variable Name</label>
                        <input
                          placeholder="e.g. user_type"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.variableName || ''}
                          onChange={(e) => updateNodeData('variableName', e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Value</label>
                        <input
                          placeholder="e.g. premium"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.variableValue || ''}
                          onChange={(e) => updateNodeData('variableValue', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : selectedNode.data.actionType === 'start_workflow' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Workflow to start</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const wf = availableWorkflows.find(
                            (w) => String(w.id) === String(value)
                          );
                          updateNodeFields(selectedNode.id, {
                            actionValue: value,
                            targetWorkflowName: wf ? wf.name : '',
                          });
                        }}
                      >
                        <option value="">Select workflow...</option>
                        {availableWorkflows.map((wf) => (
                          <option key={wf.id} value={wf.id}>
                            {wf.name}
                          </option>
                        ))}
                      </select>
                      {loadingWorkflows && (
                        <p className="text-[10px] text-slate-400">Loading workflows...</p>
                      )}
                    </div>
                  ) : selectedNode.data.actionType === 'add_to_label' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Select Label</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => updateNodeData('actionValue', e.target.value)}
                      >
                        <option value="">Select label...</option>
                        {availableLabels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                      {loadingLabels && (
                        <p className="text-[10px] text-slate-400">Loading labels...</p>
                      )}
                    </div>
                  ) : selectedNode.data.actionType === 'send_email' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Email Template</label>
                        <select
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.emailTemplateId || selectedNode.data.actionValue || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            const tmpl = emailTemplates.find((t) => String(t.id) === String(value));
                            updateNodeFields(selectedNode.id, {
                              emailTemplateId: value,
                              actionValue: value,
                              emailTemplateName: tmpl ? tmpl.name : '',
                              variableMapping: {},
                            });
                          }}
                        >
                          <option value="">Select template...</option>
                          {emailTemplates.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        {loadingEmailTemplates && (
                          <p className="text-[10px] text-slate-400">Loading email templates...</p>
                        )}
                      </div>

                      {(() => {
                        const upstreamVars = getUpstreamVariables(selectedNode.id, nodes, edges);
                        const allVars = getAllDefinedVariables(nodes);
                        const toKeys = Array.from(
                          new Set(
                            [...upstreamVars, ...allVars]
                              .map((v) => String(v).replace(/[{}]/g, '').trim())
                              .filter(Boolean)
                          )
                        );
                        const selectedTemplateId = selectedNode.data.emailTemplateId || selectedNode.data.actionValue || '';
                        const tmpl = emailTemplates.find((t) => String(t.id) === String(selectedTemplateId));
                        const vars = Array.isArray(tmpl?.variables) ? tmpl.variables : [];
                        const mapping = selectedNode.data.variableMapping || {};

                        return (
                          <>
                            <div className="space-y-1">
                              <label className="text-xs text-slate-500">To Email Variable</label>
                              <select
                                className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                                value={selectedNode.data.toVarKey || 'email'}
                                onChange={(e) => updateNodeData('toVarKey', e.target.value)}
                              >
                                {toKeys.map((k) => (
                                  <option key={k} value={k}>
                                    {k}
                                  </option>
                                ))}
                                {!toKeys.includes(selectedNode.data.toVarKey || 'email') && (
                                  <option value={selectedNode.data.toVarKey || 'email'}>
                                    {selectedNode.data.toVarKey || 'email'}
                                  </option>
                                )}
                              </select>
                              {toKeys.length === 0 && (
                                <p className="text-[10px] text-slate-400">No variables found in this workflow.</p>
                              )}
                            </div>

                            {vars.length > 0 && (
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-700">Template Variables</div>
                                <div className="space-y-2">
                                  {vars.map((v) => (
                                    <div key={v} className="grid grid-cols-2 gap-2 items-center">
                                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2 py-2 font-mono truncate">
                                        {v}
                                      </div>
                                      <select
                                        className="w-full border border-slate-300 rounded-md p-2 text-sm bg-white"
                                        value={mapping[v] || ''}
                                        onChange={(e) => {
                                          const next = { ...(mapping || {}) };
                                          const val = e.target.value;
                                          if (!val) delete next[v];
                                          else next[v] = val;
                                          updateNodeData('variableMapping', next);
                                        }}
                                      >
                                        <option value="">Select value...</option>
                                        {toKeys.map((k) => (
                                          <option key={k} value={k}>
                                            {k}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {selectedTemplateId && vars.length === 0 && (
                              <p className="text-[10px] text-slate-400">This template has no variables.</p>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : selectedNode.data.actionType === 'send_sms_otp' ? (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">OTP Digits</label>
                        <select
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.otpDigits || 6}
                          onChange={(e) => updateNodeData('otpDigits', parseInt(e.target.value, 10))}
                        >
                          <option value={4}>4</option>
                          <option value={5}>5</option>
                          <option value={6}>6</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-slate-500">Save OTP as Variable</label>
                        <input
                          placeholder="e.g. otp"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          value={selectedNode.data.saveVariable || 'otp'}
                          onChange={(e) => updateNodeData('saveVariable', e.target.value)}
                        />
                      </div>
                    </div>
                  ) : selectedNode.data.actionType === 'update_lead_stage' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Lead Stage</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          const st = availableLeadStages.find((s) => String(s.id) === String(value));
                          updateNodeFields(selectedNode.id, {
                            actionValue: value,
                            leadStageName: st ? st.name : '',
                          });
                        }}
                      >
                        <option value="">Select stage...</option>
                        {availableLeadStages.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-500">Updates this conversation's lead stage.</p>
                    </div>
                  ) : selectedNode.data.actionType === 'update_chat_status' ? (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">New Status</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || 'open'}
                        onChange={(e) => updateNodeData('actionValue', e.target.value)}
                      >
                        <option value="open">Open</option>
                        <option value="closed">Closed</option>
                        <option value="snoozed">Snoozed</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Label Name</label>
                      <input
                        placeholder="e.g. VIP"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={selectedNode.data.actionValue || ''}
                        onChange={(e) => updateNodeData('actionValue', e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="mt-auto p-4 border-t border-slate-100">
              <Button variant="outline" className="w-full text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => {
                setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
                setSelectedNode(null);
              }}>
                Delete Node
              </Button>
            </div>
          </div>
        )}

        {/* ── Gallery Picker Modal ────────────────────────────────────── */}
        <GallerySelectModal
          isOpen={showGalleryModal}
          onClose={() => setShowGalleryModal(false)}
          onSelect={(url) => {
            // Identify if it's image or video from url
            const isVideo = /\.(mp4|mov|webm)$/i.test(url);
            const isImage = /\.(png|jpg|jpeg|gif|webp)$/i.test(url);
            updateNodeFields(selectedNode?.id, {
              headerUrl: url,
              headerFileName: url.split('/').pop(),
              headerType: isVideo ? 'video' : isImage ? 'image' : 'document'
            });
            setShowGalleryModal(false);
          }}
          resourceType={selectedNode?.data?.headerType === 'video' ? 'video' : selectedNode?.data?.headerType === 'document' ? 'raw' : 'image'}
        />
      </div>
    </div>
  );
}

const DraggableBlock = ({ type, actionType, label, icon: Icon, color, onAdd, disabledDrag }) => {
  const onDragStart = (event, nodeType, actType) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (actType) {
      event.dataTransfer.setData('application/actiontype', actType);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={`flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg ${disabledDrag ? 'cursor-pointer' : 'cursor-grab'
        } hover:border-blue-400 hover:shadow-sm transition-all`}
      onDragStart={disabledDrag ? undefined : (event) => onDragStart(event, type, actionType)}
      draggable={!disabledDrag}
      onClick={() => {
        if (onAdd) onAdd(type, actionType);
      }}
    >
      <div className={`p-2 rounded-md ${color} text-white`}>
        <Icon size={16} />
      </div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
    </div>
  );
};
