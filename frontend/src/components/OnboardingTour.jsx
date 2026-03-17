'use strict';
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, Sparkles, CheckCircle, Info, ArrowLeftRight
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

const STEPS = [
  // Dashboard Steps
  {
    id: 'welcome',
    page: 'dashboard',
    title: 'Coach Master Welcome',
    description: 'Welcome! I am your Coach Master. Let me show you exactly how to master this platform. We will start with your Dashboard.',
    targetId: 'nav-dashboard',
    position: 'right'
  },
  {
    id: 'kpi-conversations',
    page: 'dashboard',
    title: 'Conversation Metrics',
    description: 'Track your total, open, and closed conversations here. This gives you a bird\'s eye view of your current workload.',
    targetId: 'tour-kpi-conversations',
    position: 'bottom'
  },
  {
    id: 'kpi-messages',
    page: 'dashboard',
    title: 'Message Volume',
    description: 'Monitor inbound and outbound message traffic over the last 14 days. Watch your engagement grow!',
    targetId: 'tour-kpi-messages',
    position: 'bottom'
  },
  {
    id: 'kpi-contacts',
    page: 'dashboard',
    title: 'Total Contacts',
    description: 'The total number of unique customers you\'ve interacted with. New contacts in the last 7 days are highlighted.',
    targetId: 'tour-kpi-contacts',
    position: 'bottom'
  },
  {
    id: 'kpi-csat',
    page: 'dashboard',
    title: 'Customer Satisfaction',
    description: 'Your real-time CSAT score. High scores mean happy customers!',
    targetId: 'tour-kpi-csat',
    position: 'bottom'
  },
  {
    id: 'volume-chart',
    page: 'dashboard',
    title: 'Activity Trends',
    description: 'This chart shows your message peaks and troughs. Use it to identify your busiest hours.',
    targetId: 'tour-volume-chart',
    position: 'top'
  },
  {
    id: 'channels-chart',
    page: 'dashboard',
    title: 'Channel Split',
    description: 'See which platform your customers prefer. We support WhatsApp and Instagram integration.',
    targetId: 'tour-channels-chart',
    position: 'top'
  },
  {
    id: 'automations-card',
    page: 'dashboard',
    title: 'Automation Health',
    description: 'Quick summary of your active workflows, rules, and AI assets.',
    targetId: 'tour-automations-card',
    position: 'top'
  },
  {
    id: 'campaigns-card',
    page: 'dashboard',
    title: 'Campaign Status',
    description: 'Monitor your marketing reach. Track scheduled, running, and completed campaigns.',
    targetId: 'tour-campaigns-card',
    position: 'top'
  },
  {
    id: 'payments-card',
    page: 'dashboard',
    title: 'Revenue Tracking',
    description: 'Keep an eye on collected and pending payments from your automated checkout flows.',
    targetId: 'tour-payments-card',
    position: 'top'
  },
  {
    id: 'recent-conversations',
    page: 'dashboard',
    title: 'Latest Activity',
    description: 'The most recent interactions across all channels. Tap anyone to jump into the chat.',
    targetId: 'tour-recent-conversations',
    position: 'top'
  },
  {
    id: 'agent-workload',
    page: 'dashboard',
    title: 'Team Performance',
    description: 'See which agents are currently handling the most load and their response activity.',
    targetId: 'tour-agent-workload',
    position: 'top'
  },
  // Transition to Inbox
  {
    id: 'nav-inbox-step',
    page: 'dashboard',
    title: 'Moving to Inbox',
    description: 'Now, let\'s look at where the magic happens: The Inbox. Click Next to switch pages.',
    targetId: 'nav-inbox',
    position: 'right',
    onNext: (setPage) => setPage('inbox')
  },
  {
    id: 'inbox-filter',
    page: 'inbox',
    title: 'Smart Filters',
    description: 'Filter your inbox by Status, Unassigned, or Pinned messages to stay organized.',
    targetId: 'tour-inbox-filter-all',
    position: 'bottom'
  },
  {
    id: 'inbox-list',
    page: 'inbox',
    title: 'Conversation List',
    description: 'All your active chats appear here. Check for unread badges and channel icons.',
    targetId: 'tour-inbox-list',
    position: 'right'
  },
  {
    id: 'chat-input',
    page: 'inbox',
    title: 'Instant Messaging',
    description: 'Type your message here. You can attach files, use templates, or send emojis.',
    targetId: 'tour-chat-input-area',
    position: 'top'
  },
  {
    id: 'chat-send',
    page: 'inbox',
    title: 'Speedy Replies',
    description: 'Send your message instantly. It\'s lightning fast!',
    targetId: 'tour-chat-send-btn',
    position: 'left'
  },
  // Sidebar items
  {
    id: 'nav-campaigns-step',
    page: 'inbox',
    title: 'Marketing Hub',
    description: 'Go here to create bulk message campaigns and schedule them for later.',
    targetId: 'nav-campaigns',
    position: 'right'
  },
  {
    id: 'nav-templates-step',
    page: 'inbox',
    title: 'Template Manager',
    description: 'Manage your official Meta templates. Create, star, and test them here.',
    targetId: 'nav-templates',
    position: 'right'
  },
  {
    id: 'nav-settings-step',
    page: 'inbox',
    title: 'Crucial Configuration',
    description: 'IMPORTANT: Use this page to connect your actual WhatsApp numbers before you start sending messages!',
    targetId: 'nav-settings',
    position: 'right'
  },
  {
    id: 'finish',
    page: 'inbox',
    title: 'Mission Accomplished!',
    description: 'You\'ve completed the full master tour. You are now ready to automate your business like a pro!',
    targetId: 'nav-dashboard',
    position: 'right'
  }
];

export default function OnboardingTour({ onComplete, activePage, setActivePage }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const step = STEPS[currentStep];

  useEffect(() => {
    // Ensure we are on the right page for the step
    if (step.page !== activePage) {
      setActivePage(step.page);
    }
  }, [step.page, activePage, setActivePage]);

  useEffect(() => {
    const updatePosition = () => {
      const el = document.getElementById(step.targetId);
      if (el) {
        const rect = el.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    updatePosition();
    // Re-check periodically in case of lazy loading or layout shifts
    const timer = setTimeout(updatePosition, 300);
    window.addEventListener('resize', updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
    };
  }, [currentStep, step.targetId, activePage]);

  const handleNext = () => {
    if (currentStep === STEPS.length - 1) {
      onComplete();
    } else {
      if (step.onNext) {
        step.onNext(setActivePage);
      }
      setCurrentStep(prev => prev + 1);
    }
  };

  const getTooltipStyle = () => {
    const space = 12;
    if (step.position === 'right') {
      return { top: coords.top + coords.height / 2, left: coords.left + coords.width + space, transform: 'translateY(-50%)' };
    }
    if (step.position === 'bottom') {
      return { top: coords.top + coords.height + space, left: coords.left + coords.width / 2, transform: 'translateX(-50%)' };
    }
    if (step.position === 'top') {
      return { top: coords.top - space, left: coords.left + coords.width / 2, transform: 'translate(-50%, -100%)' };
    }
    if (step.position === 'left') {
      return { top: coords.top + coords.height / 2, left: coords.left - space, transform: 'translate(-100%, -50%)' };
    }
    return { top: coords.top, left: coords.left };
  };

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none">
      {/* Dimmed Overlay with a hole (Spotlight) */}
      <div 
        className="absolute inset-0 bg-slate-900/60 transition-all duration-500 pointer-events-auto"
        style={{
          maskImage: `radial-gradient(circle at ${coords.left + coords.width / 2}px ${coords.top + coords.height / 2}px, transparent ${Math.max(coords.width, coords.height) / 1.5}px, black ${Math.max(coords.width, coords.height) / 1.5 + 40}px)`
        }}
      />

      {/* Actual Spotlight Border */}
      <div 
        className="absolute transition-all duration-500 ease-in-out rounded-2xl border-4 border-blue-500 shadow-[0_0_0_9999px_rgba(15,23,42,0.6)] z-10"
        style={{
          top: coords.top - 8,
          left: coords.left - 8,
          width: coords.width + 16,
          height: coords.height + 16
        }}
      />

      {/* Tooltip Content */}
      <div 
        className="absolute z-20 w-80 bg-white rounded-2xl shadow-2xl p-6 pointer-events-auto animate-in fade-in zoom-in-95 duration-300 border border-slate-100"
        style={getTooltipStyle()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-lg leading-tight mb-1">{step.title}</h3>
            <div className="text-xs text-slate-400 font-medium">Step {currentStep + 1} of {STEPS.length}</div>
          </div>
        </div>
        
        <p className="text-slate-600 text-sm leading-relaxed mb-6">
          {step.description}
        </p>

        <div className="flex items-center gap-3">
          <Button 
            onClick={handleNext}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-11"
          >
            {currentStep === STEPS.length - 1 ? 'I Understood Everything' : 'Next Step'}
            {currentStep !== STEPS.length - 1 && <ChevronRight size={18} className="ml-2" />}
            {currentStep === STEPS.length - 1 && <CheckCircle size={18} className="ml-2" />}
          </Button>
        </div>

        {/* Arrow Pointer */}
        <div 
          className={cn(
            "absolute w-4 h-4 bg-white border-slate-100 rotate-45",
            step.position === 'right' && "-left-2 top-1/2 -translate-y-1/2 border-l border-b",
            step.position === 'bottom' && "-top-2 left-1/2 -translate-x-1/2 border-l border-t",
            step.position === 'top' && "-bottom-2 left-1/2 -translate-x-1/2 border-r border-b",
            step.position === 'left' && "-right-2 top-1/2 -translate-y-1/2 border-r border-t"
          )}
        />
      </div>
    </div>
  );
}
