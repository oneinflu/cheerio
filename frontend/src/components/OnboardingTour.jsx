'use strict';
import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronRight, Sparkles, CheckCircle, Info, ArrowLeftRight, ChevronLeft
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

const STEPS = [
  // Dashboard Steps
  {
    id: 'welcome',
    page: 'dashboard',
    title: 'Coach Master: Dashboard',
    description: 'Welcome! I will guide you through every metric here. Let\'s start with your navigation.',
    targetId: 'nav-dashboard',
    position: 'right'
  },
  {
    id: 'kpi-conversations',
    page: 'dashboard',
    title: 'Conversations KPI',
    description: 'This card tracks all your chats. You can see Open, Snoozed, and Closed counts at a glance. Essential for tracking workload!',
    targetId: 'tour-kpi-conversations',
    position: 'bottom'
  },
  {
    id: 'kpi-messages',
    page: 'dashboard',
    title: 'Message Volume',
    description: 'Shows total messages in the last 14 days. Click into it to see Inbound vs Outbound breakdown.',
    targetId: 'tour-kpi-messages',
    position: 'bottom'
  },
  {
    id: 'kpi-contacts',
    page: 'dashboard',
    title: 'Contact Growth',
    description: 'Monitor your customer base. This shows total unique contacts and how many joined in the last 7 days.',
    targetId: 'tour-kpi-contacts',
    position: 'bottom'
  },
  {
    id: 'kpi-csat',
    page: 'dashboard',
    title: 'Customer Satisfaction',
    description: 'Real-time CSAT score. Keep this high! It reflects how happy your customers are with your service.',
    targetId: 'tour-kpi-csat',
    position: 'bottom'
  },
  {
    id: 'volume-chart',
    page: 'dashboard',
    title: 'Activity Trends',
    description: 'A visual heat-map of your message traffic. Identify your busiest hours to staff your team better.',
    targetId: 'tour-volume-chart',
    position: 'top'
  },
  {
    id: 'channels-chart',
    page: 'dashboard',
    title: 'Channel Analytics',
    description: 'See where your traffic comes from—WhatsApp or Instagram. Helps you focus your marketing efforts.',
    targetId: 'tour-channels-chart',
    position: 'top'
  },
  {
    id: 'automations-card',
    page: 'dashboard',
    title: 'Automation Engine',
    description: 'Summary of your active workflows and AI assets. This is the brain of your automated business.',
    targetId: 'tour-automations-card',
    position: 'top'
  },
  {
    id: 'campaigns-card',
    page: 'dashboard',
    title: 'Campaign Manager',
    description: 'Running marketing campaigns? Track their progress and completion status right here.',
    targetId: 'tour-campaigns-card',
    position: 'top'
  },
  {
    id: 'payments-card',
    page: 'dashboard',
    title: 'Payment Summary',
    description: 'Track your revenue! See pending vs collected amounts from your checkout bots.',
    targetId: 'tour-payments-card',
    position: 'top'
  },
  {
    id: 'recent-conversations',
    page: 'dashboard',
    title: 'Live Stream',
    description: 'The very latest messages hitting your system. You can jump directly into any chat from here.',
    targetId: 'tour-recent-conversations',
    position: 'top'
  },
  {
    id: 'agent-workload',
    page: 'dashboard',
    title: 'Agent Performance',
    description: 'See which team members are most active and who might be overloaded.',
    targetId: 'tour-agent-workload',
    position: 'top'
  },
  // Transition to Inbox
  {
    id: 'nav-inbox-step',
    page: 'dashboard',
    title: 'Heading to the Inbox',
    description: 'Great! Now let\'s see where you actually talk to customers. Moving to the Unified Inbox...',
    targetId: 'nav-inbox',
    position: 'right',
    onNext: (setPage) => setPage('inbox')
  },
  {
    id: 'inbox-filter',
    page: 'inbox',
    title: 'Smart Sorting',
    description: 'Use these filters to instantly find Unassigned leads, Pinned priority chats, or Closed cases.',
    targetId: 'tour-inbox-filter-all',
    position: 'bottom'
  },
  {
    id: 'inbox-list',
    page: 'inbox',
    title: 'Your Conversations',
    description: 'All incoming messages land here. Look for unread counts and channel icons to stay on top of things.',
    targetId: 'tour-inbox-list',
    position: 'right'
  },
  {
    id: 'chat-input',
    page: 'inbox',
    title: 'The Command Center',
    description: 'Compose your replies here. Use the paperclip for media or the Star for quick templates.',
    targetId: 'tour-chat-input-area',
    position: 'top'
  },
  {
    id: 'chat-send',
    page: 'inbox',
    title: 'Instant Send',
    description: 'Click this to deliver your message instantly. Official Meta APIs ensure high delivery rates!',
    targetId: 'tour-chat-send-btn',
    position: 'left'
  },
  {
    id: 'nav-settings-step',
    page: 'inbox',
    title: 'Final Step: Settings',
    description: 'Before you leave: Go to Settings to connect your official WhatsApp numbers. Don\'t forget!',
    targetId: 'nav-settings',
    position: 'right'
  },
  {
    id: 'finish',
    page: 'inbox',
    title: 'Mastery Achieved!',
    description: 'You are now an expert in WABA Master. Your journey to 10x your business starts now!',
    targetId: 'nav-dashboard',
    position: 'right'
  }
];

export default function OnboardingTour({ onComplete, activePage, setActivePage }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, height: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const step = STEPS[currentStep];

  // Force page change if step requires it
  useEffect(() => {
    if (step.page !== activePage) {
      setActivePage(step.page);
    }
  }, [step.page]);

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
        setIsVisible(true);
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        setIsVisible(false);
      }
    };

    updatePosition();
    const timer = setTimeout(updatePosition, 500); // Wait for page transitions
    window.addEventListener('resize', updatePosition);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updatePosition);
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
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const getTooltipStyle = () => {
    const space = 20;
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

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[10000] pointer-events-none font-sans overflow-hidden">
      {/* Premium Backdrop Overlay */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-all duration-700 pointer-events-auto"
        style={{
          boxShadow: `inset 0 0 0 9999px rgba(15, 23, 42, 0.7)`
        }}
      />

      {/* Spotlight Effect - Pulsing */}
      <div 
        className="absolute transition-all duration-500 ease-out rounded-2xl border-2 border-white/50 shadow-[0_0_0_9999px_rgba(15,23,42,0.65)] z-10 pointer-events-none"
        style={{
          top: coords.top - 12,
          left: coords.left - 12,
          width: coords.width + 24,
          height: coords.height + 24,
        }}
      >
         <div className="absolute inset-0 animate-pulse border-4 border-blue-500/50 rounded-2xl" />
      </div>

      {/* Floating Insight Card */}
      <div 
        className="absolute z-20 w-[340px] bg-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-7 pointer-events-auto animate-in fade-in slide-in-from-bottom-5 duration-500 ease-out border border-white/20"
        style={getTooltipStyle()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-200">
               <Sparkles size={20} />
             </div>
             <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-md">
               Coach Step {currentStep + 1}
             </span>
          </div>
          <div className="flex gap-1">
             {STEPS.map((_, i) => (
                <div key={i} className={cn("w-1 h-1 rounded-full", i === currentStep ? "bg-blue-600 w-3" : "bg-slate-200")} />
             ))}
          </div>
        </div>
        
        <h3 className="font-extrabold text-slate-900 text-xl leading-tight mb-3">
          {step.title}
        </h3>
        
        <p className="text-slate-500 text-[15px] leading-relaxed mb-8">
          {step.description}
        </p>

        <div className="flex items-center gap-3 mt-auto">
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
            className="flex-1 bg-slate-900 hover:bg-black text-white rounded-2xl h-12 font-bold shadow-xl shadow-slate-200 transition-all active:scale-[0.98]"
          >
            {currentStep === STEPS.length - 1 ? 'Finish Mastery' : 'Next Step'}
            {currentStep !== STEPS.length - 1 && <ChevronRight size={18} className="ml-2" />}
            {currentStep === STEPS.length - 1 && <CheckCircle size={18} className="ml-2" />}
          </Button>
        </div>

        {/* Dynamic Pointer Arrow */}
        <div 
          className={cn(
            "absolute w-5 h-5 bg-white rotate-45 z-[-1]",
            step.position === 'right' && "-left-2.5 top-1/2 -translate-y-1/2",
            step.position === 'bottom' && "-top-2.5 left-1/2 -translate-x-1/2",
            step.position === 'top' && "-bottom-2.5 left-1/2 -translate-x-1/2",
            step.position === 'left' && "-right-2.5 top-1/2 -translate-y-1/2"
          )}
        />
      </div>
    </div>
  );
}
