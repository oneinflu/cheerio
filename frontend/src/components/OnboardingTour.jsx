'use strict';
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { 
  ChevronRight, Sparkles, CheckCircle, ChevronLeft, X
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

const STEPS = [
  // Dashboard Steps
  {
    id: 'welcome',
    page: 'dashboard',
    title: 'Coach Master: Welcome!',
    description: 'I will guide you through every metric here. Let\'s ensure your business is fully optimized.',
    targetId: 'nav-dashboard',
    position: 'right'
  },
  {
    id: 'kpi-conversations',
    page: 'dashboard',
    title: 'Track Conversations',
    description: 'See exactly how many chats are Open, Snoozed, or Closed. Never lose track of a customer.',
    targetId: 'tour-kpi-conversations',
    position: 'bottom'
  },
  {
    id: 'kpi-messages',
    page: 'dashboard',
    title: 'Message Volume',
    description: 'Monitor your engagement over 14 days. Watch your inbound/outbound trends live.',
    targetId: 'tour-kpi-messages',
    position: 'bottom'
  },
  {
    id: 'kpi-contacts',
    page: 'dashboard',
    title: 'Customer Growth',
    description: 'Your contact database is your biggest asset. Track how many new users joined recently.',
    targetId: 'tour-kpi-contacts',
    position: 'bottom'
  },
  {
    id: 'kpi-csat',
    page: 'dashboard',
    title: 'Customer Happiness',
    description: 'Your real-time Satisfaction score. Aim for 5 stars to keep your brand elite!',
    targetId: 'tour-kpi-csat',
    position: 'bottom'
  },
  {
    id: 'volume-chart',
    page: 'dashboard',
    title: 'Interactive Trends',
    description: 'Hover over this graph to see hourly performance and identifying peak support times.',
    targetId: 'tour-volume-chart',
    position: 'top'
  },
  {
    id: 'recent-conversations',
    page: 'dashboard',
    title: 'Real-time Feed',
    description: 'Your newest conversations. Click any row to jump straight into the chat.',
    targetId: 'tour-recent-conversations',
    position: 'top'
  },
  // Unified Inbox
  {
    id: 'nav-inbox-step',
    page: 'dashboard',
    title: 'Unified Inbox',
    description: 'Now, let\'s see where you actually talk to customers. Switching to the Inbox...',
    targetId: 'nav-inbox',
    position: 'right',
    onNext: (setPage) => setPage('inbox')
  },
  {
    id: 'inbox-filter',
    page: 'inbox',
    title: 'Inbox Filters',
    description: 'Use these chips to instantly find Unassigned leads or check your Pinned priority chats.',
    targetId: 'tour-inbox-filter-all',
    position: 'bottom'
  },
  {
    id: 'chat-input',
    page: 'inbox',
    title: 'Message Center',
    description: 'Send text, media, or official templates from here. Lightning fast official Meta APIs!',
    targetId: 'tour-chat-input-area',
    position: 'top'
  },
  // Templates & Workflows
  {
    id: 'nav-templates-step',
    page: 'inbox',
    title: 'Templates Hub',
    description: 'Manage your official WhatsApp templates. Create, star, and test your broadcasting messages here.',
    targetId: 'nav-templates',
    position: 'right'
  },
  {
    id: 'nav-workflows-step',
    page: 'inbox',
    title: 'Automation Workflows',
    description: 'Build powerful drag-and-drop automations that handle support and sales even while you sleep.',
    targetId: 'nav-workflows',
    position: 'right'
  },
  {
    id: 'nav-flows-step',
    page: 'inbox',
    title: 'WhatsApp Flows',
    description: 'Build interactive forms and custom UI components that run directly inside WhatsApp.',
    targetId: 'nav-flows',
    position: 'right'
  },
  {
    id: 'nav-settings-step',
    page: 'inbox',
    title: 'Crucial: Settings',
    description: 'PRO TIP: Head here first to connect your WhatsApp numbers and configure your team permissions.',
    targetId: 'nav-settings',
    position: 'right'
  },
  {
    id: 'finish',
    page: 'inbox',
    title: 'Mastery Achieved!',
    description: 'You\'ve completed the full master tour. Start scaling your business with automation today!',
    targetId: 'nav-dashboard',
    position: 'right'
  }
];

export default function OnboardingTour({ onComplete, activePage, setActivePage }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef(null);
  const step = STEPS[currentStep];

  useEffect(() => {
    if (step.page !== activePage) {
      setActivePage(step.page);
    }
  }, [step.page, activePage, setActivePage]);

  const calculatePosition = () => {
    const el = document.getElementById(step.targetId);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    const newCoords = {
      top: rect.top + scrollY,
      left: rect.left + scrollX,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom + scrollY,
      right: rect.right + scrollX
    };
    setCoords(newCoords);

    // Scroll into view if needed
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });

    // Calculate Tooltip position correctly
    if (tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const margin = 20;
      let top = 0;
      let left = 0;

      if (step.position === 'right') {
        top = newCoords.top + newCoords.height / 2 - tooltipRect.height / 2;
        left = newCoords.right + margin;
      } else if (step.position === 'bottom') {
        top = newCoords.bottom + margin;
        left = newCoords.left + newCoords.width / 2 - tooltipRect.width / 2;
      } else if (step.position === 'left') {
        top = newCoords.top + newCoords.height / 2 - tooltipRect.height / 2;
        left = newCoords.left - tooltipRect.width - margin;
      } else if (step.position === 'top') {
        top = newCoords.top - tooltipRect.height - margin;
        left = newCoords.left + newCoords.width / 2 - tooltipRect.width / 2;
      }

      // Bound checks (Keep on screen)
      const padding = 15;
      top = Math.max(padding, Math.min(top, window.innerHeight - tooltipRect.height - padding));
      left = Math.max(padding, Math.min(left, window.innerWidth - tooltipRect.width - padding));

      setTooltipPos({ top, left });
    }
  };

  useLayoutEffect(() => {
    const timer = setTimeout(calculatePosition, 600); // Higher delay for page transitions
    window.addEventListener('resize', calculatePosition);
    window.addEventListener('scroll', calculatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', calculatePosition);
      window.removeEventListener('scroll', calculatePosition);
    };
  }, [currentStep, activePage, step.targetId]);

  const handleNext = () => {
    if (currentStep === STEPS.length - 1) {
      onComplete();
    } else {
      if (step.onNext) step.onNext(setActivePage);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1);
  };

  return (
    <div className="fixed inset-0 z-[99999] pointer-events-none">
      {/* Dynamic Overlay using SVG for the Perfect Spotlight (clear, no blur behind) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect 
               x={coords.left - 10} 
               y={coords.top - 10} 
               width={coords.width + 20} 
               height={coords.height + 20} 
               rx="16" 
               fill="black" 
               className="transition-all duration-500 ease-out"
            />
          </mask>
        </defs>
        <rect 
          x="0" 
          y="0" 
          width="100%" 
          height="100%" 
          fill="rgba(15, 23, 42, 0.75)" 
          className="backdrop-blur-[1px]"
          mask="url(#spotlight-mask)" 
        />
      </svg>

      {/* Spotlight Border / Pulse */}
      <div 
        className="absolute transition-all duration-500 ease-out rounded-[20px] pointer-events-none z-[100000]"
        style={{
          top: coords.top - 10,
          left: coords.left - 10,
          width: coords.width + 20,
          height: coords.height + 20,
          border: '3px solid white',
          boxShadow: '0 0 0 4px rgba(59, 130, 246, 0.5), 0 0 20px rgba(59, 130, 246, 0.3)'
        }}
      >
        <div className="absolute inset-0 animate-pulse border-4 border-blue-400/20 rounded-[16px]" />
      </div>

      {/* Premium Tooltip Card */}
      <div 
        ref={tooltipRef}
        className="absolute z-[100001] w-[350px] bg-white rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] p-8 pointer-events-auto transition-all duration-500 ease-out animate-in fade-in zoom-in-95"
        style={{
          top: tooltipPos.top,
          left: tooltipPos.left,
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-xl shadow-slate-200">
               <Sparkles size={24} />
             </div>
             <div>
               <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-0.5">Step {currentStep + 1} of {STEPS.length}</div>
               <h3 className="font-extrabold text-slate-900 text-lg leading-tight uppercase tracking-tight">Coach Master</h3>
             </div>
          </div>
          <button onClick={() => onComplete()} className="text-slate-300 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="space-y-4 mb-8">
          <h4 className="font-bold text-slate-800 text-base">{step.title}</h4>
          <p className="text-slate-500 text-sm leading-relaxed">
            {step.description}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentStep > 0 && (
             <Button 
               variant="ghost"
               onClick={handleBack}
               className="h-12 w-12 rounded-2xl border border-slate-100 p-0 text-slate-400 hover:text-slate-900"
             >
               <ChevronLeft size={20} />
             </Button>
          )}
          <Button 
            onClick={handleNext}
            className="flex-1 bg-slate-900 hover:bg-black text-white rounded-2xl h-12 font-bold shadow-xl shadow-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            {currentStep === STEPS.length - 1 ? 'Finish Tour' : 'Next Step'}
            {currentStep !== STEPS.length - 1 && <ChevronRight size={18} className="ml-2" />}
            {currentStep === STEPS.length - 1 && <CheckCircle size={18} className="ml-2" />}
          </Button>
        </div>

        {/* Pointer Triangle */}
        <div 
          className={cn(
            "absolute w-4 h-4 bg-white rotate-45 z-[-1]",
            step.position === 'right' && "-left-2 top-1/2 -translate-y-1/2",
            step.position === 'bottom' && "-top-2 left-1/2 -translate-x-1/2",
            step.position === 'top' && "-bottom-2 left-1/2 -translate-x-1/2",
            step.position === 'left' && "-right-2 top-1/2 -translate-y-1/2"
          )}
        />
      </div>
    </div>
  );
}
