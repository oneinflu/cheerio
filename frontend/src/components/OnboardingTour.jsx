'use strict';
import React, { useState } from 'react';
import { 
  LayoutDashboard, MessageSquare, Megaphone, Settings, 
  Workflow, Shield, Zap, Bot, Star, ChevronRight, X, Sparkles, CheckCircle
} from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to WABA Master',
    description: 'Hello! I am your Coach Master. I will help you get started with the most powerful WhatsApp Business automation tool.',
    icon: Sparkles,
    color: 'text-blue-500',
    bg: 'bg-blue-50'
  },
  {
    id: 'dashboard',
    title: 'Real-time Dashboard',
    description: 'Track your performance, see message volume, and monitor customer satisfaction at a glance.',
    icon: LayoutDashboard,
    color: 'text-indigo-500',
    bg: 'bg-indigo-50'
  },
  {
    id: 'inbox',
    title: 'Smart Unified Inbox',
    description: 'Manage all your conversations in one place. Respond to customers instantly and never miss a lead.',
    icon: MessageSquare,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50'
  },
  {
    id: 'campaigns',
    title: 'Scale with Campaigns',
    description: 'Send bulk updates and promotions to your customers using official WhatsApp templates safely.',
    icon: Megaphone,
    color: 'text-orange-500',
    bg: 'bg-orange-50'
  },
  {
    id: 'workflows',
    title: 'Powerful Automation',
    description: 'Build complex automation workflows using our drag-and-drop builder to handle recurring tasks.',
    icon: Zap,
    color: 'text-yellow-500',
    bg: 'bg-yellow-50'
  },
  {
    id: 'ai-agent',
    title: 'AI Smart Agent',
    description: 'Train an AI agent on your business knowledge to handle support queries automatically 24/7.',
    icon: Bot,
    color: 'text-purple-500',
    bg: 'bg-purple-50'
  },
  {
    id: 'settings',
    title: 'Account Settings',
    description: 'Crucial: Connect your WhatsApp Business API numbers and configure your team here first!',
    icon: Settings,
    color: 'text-slate-600',
    bg: 'bg-slate-100'
  },
  {
    id: 'finish',
    title: 'You are ready!',
    description: 'That is it! You are now ready to master your business communications. Click "I Understood Everything" to begin.',
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-50'
  }
];

export default function OnboardingTour({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const step = STEPS[currentStep];
  const isLast = currentStep === STEPS.length - 1;

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col relative animate-in zoom-in-95 duration-500 slide-in-from-bottom-10">
        
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-slate-100 flex">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "h-full transition-all duration-500 ease-out",
                i <= currentStep ? "bg-blue-600" : "bg-transparent"
              )} 
              style={{ width: `${100 / STEPS.length}%` }}
            />
          ))}
        </div>

        <button 
          onClick={handleSkip}
          className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all z-10"
        >
          <X size={20} />
        </button>

        <div className="p-10 pt-12 flex flex-col items-center text-center">
          {/* Icon Stage */}
          <div className={cn(
            "w-24 h-24 rounded-3xl flex items-center justify-center mb-8 transform transition-all duration-500 rotate-3",
            step.bg,
            step.color
          )}>
            <step.icon size={48} strokeWidth={1.5} />
          </div>

          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">
            {step.title}
          </h2>
          
          <p className="text-lg text-slate-600 leading-relaxed mb-10 max-w-sm">
            {step.description}
          </p>

          <div className="w-full space-y-3">
            <Button 
              onClick={handleNext}
              className="w-full h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow-lg shadow-blue-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {isLast ? 'I Understood Everything' : 'Tell Me More'}
              {!isLast && <ChevronRight size={20} className="ml-2" />}
            </Button>
            
            {!isLast && (
              <Button 
                variant="ghost" 
                onClick={handleSkip}
                className="w-full h-12 text-slate-400 hover:text-slate-600 rounded-2xl"
              >
                Skip Tour
              </Button>
            )}
          </div>
        </div>

        {/* Footer Dots */}
        <div className="px-10 pb-8 flex justify-center space-x-2">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300",
                i === currentStep ? "bg-blue-600 w-6" : "bg-slate-200"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
