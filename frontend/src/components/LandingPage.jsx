'use strict';
import React from 'react';
import { Button } from './ui/Button';
import { Globe, ChevronDown, MessageSquare, ArrowRight, Play, Star, Users, CheckCircle2 } from 'lucide-react';

export default function LandingPage({ onLoginClick }) {
    return (
        <div className="min-h-screen bg-white font-sans text-slate-900 overflow-x-hidden">
            {/* Top Announcement Banner */}
            <div className="w-full bg-[#FFF9E6] py-2 px-4 flex justify-center items-center text-sm border-b border-amber-100">
                <p className="flex items-center gap-2 font-medium">
                    <span className="text-lg">🚀</span> Greeto AI is here - The Conversational Intelligence Layer for Modern Businesses
                    <a href="#" className="underline font-bold ml-1 hover:text-amber-700 transition-colors">Explore</a>
                </p>
            </div>

            {/* Top Auxiliary Navigation */}
            <div className="w-full bg-slate-900 py-2 px-6 lg:px-24 flex justify-end items-center text-xs text-slate-400 gap-6">
                <a href="#" className="hover:text-white transition-colors">Help Center</a>
                <a href="#" className="hover:text-white transition-colors">Partners</a>
                <a href="#" className="hover:text-white transition-colors">Enterprise</a>
                <button
                    onClick={onLoginClick}
                    className="text-white font-medium hover:text-blue-400 transition-colors"
                >
                    Log in
                </button>
                <button className="flex items-center gap-1 hover:text-white transition-colors">
                    <Globe size={14} />
                    <ChevronDown size={12} />
                </button>
            </div>

            {/* Main Header Navigation */}
            <header className="w-full py-4 px-6 lg:px-24 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-50 border-b border-slate-100">
                <div className="flex items-center gap-12">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 bg-[#00E676] rounded-lg flex items-center justify-center font-bold text-lg shadow-[2px_2px_0px_#000]">G</div>
                        <span className="font-black text-2xl tracking-tighter">Greeto</span>
                    </div>

                    <nav className="hidden lg:flex items-center gap-8 text-[15px] font-semibold">
                        <button className="flex items-center gap-1 hover:text-[#00E676] transition-colors">Solutions <ChevronDown size={14} /></button>
                        <button className="flex items-center gap-1 hover:text-[#00E676] transition-colors">Product <ChevronDown size={14} /></button>
                        <button className="flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors">● astra</button>
                        <button className="flex items-center gap-1 hover:text-[#00E676] transition-colors">Resources <ChevronDown size={14} /></button>
                        <button className="hover:text-[#00E676] transition-colors">Pricing</button>
                    </nav>
                </div>

                <div className="flex items-center gap-4">
                    <Button variant="outline" className="hidden border-2 border-slate-900 rounded-lg font-bold px-6 py-2 hover:bg-slate-50 transition-all sm:inline-flex">
                        Book a Demo
                    </Button>
                    <Button className="bg-[#00E676] hover:bg-[#00c864] text-slate-900 border-2 border-slate-900 rounded-lg font-bold px-6 py-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_rgba(0,0,0,1)] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all">
                        Try for Free
                    </Button>
                </div>
            </header>

            {/* Hero Section */}
            <main className="relative pt-20 pb-32 px-6 lg:px-24 text-center max-w-7xl mx-auto overflow-hidden">
                {/* Decorative elements */}
                <div className="absolute top-40 left-0 w-64 h-64 bg-[#00E676]/5 rounded-full blur-3xl -z-10" />
                <div className="absolute top-20 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -z-10" />

                <h1 className="text-5xl lg:text-[88px] font-black leading-[1.05] tracking-tight mb-8">
                    The #1 <span className="inline-block relative">
                        <span className="relative z-10 px-4 py-1">conversational</span>
                        <div className="absolute inset-0 bg-[#00E676] -rotate-1 skew-x-[-2deg] border-2 border-slate-900 shadow-[4px_4px_0px_#000]" />
                    </span><br />
                    <span className="inline-block relative mt-2">
                        <span className="relative z-10 px-4 py-1">growth</span>
                        <div className="absolute inset-0 bg-[#00E676] -rotate-1 skew-x-[-2deg] border-2 border-slate-900 shadow-[4px_4px_0px_#000]" />
                    </span> platform
                </h1>

                <p className="max-w-3xl mx-auto text-xl text-slate-600 mb-12 leading-relaxed font-medium">
                    From the first marketing touchpoint through the sales cycle to ongoing customer success,
                    Greeto drives faster ROI with an easy-to-use, scalable AI-native platform.
                </p>

                {/* Social Proof */}
                <div className="flex flex-wrap justify-center items-center gap-4 mb-12">
                    <div className="bg-slate-50 border border-slate-200 rounded-full px-6 py-2.5 flex items-center gap-2">
                        <span className="text-slate-700 font-semibold text-sm">Trusted by 16,000+ customers worldwide</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded-full px-6 py-2.5 flex items-center gap-2">
                        <div className="flex -space-x-0.5">
                            {[1, 2, 3, 4, 5].map(i => (
                                <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                            ))}
                        </div>
                        <span className="text-slate-700 font-semibold text-sm">4.8/5 on G2</span>
                    </div>
                </div>

                {/* Hero CTAs */}
                <div className="flex flex-col sm:flex-row justify-center items-center gap-6 mb-24">
                    <Button variant="outline" className="w-full sm:w-auto min-w-[200px] h-14 border-2 border-slate-900 rounded-xl font-black text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                        Book a Demo
                    </Button>
                    <Button className="w-full sm:w-auto min-w-[200px] h-14 bg-[#00E676] hover:bg-[#00c864] text-slate-900 border-2 border-slate-900 rounded-xl font-black text-lg shadow-[6px_6px_0px_rgba(0,0,0,1)] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[8px_8px_0px_rgba(0,0,0,1)] active:translate-x-[0px] active:translate-y-[0px] active:shadow-[2px_2px_0px_rgba(0,0,0,1)] transition-all flex items-center justify-center gap-2">
                        Try for Free <ArrowRight size={20} />
                    </Button>
                </div>

                {/* Tab Navigation */}
                <div className="flex justify-center border-b border-slate-100 max-w-2xl mx-auto mb-16">
                    {['Marketing', 'Sales', 'Support'].map((tab, idx) => (
                        <button
                            key={tab}
                            className={`px-12 py-4 font-bold text-lg transition-all border-b-4 ${idx === 0 ? 'border-[#00E676] text-slate-900' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Floating elements / Chat bubble */}
                <div className="fixed bottom-8 right-8 z-[100]">
                    <div className="relative group">
                        <div className="absolute -top-12 right-0 bg-white border-2 border-slate-900 rounded-full py-2 px-4 whitespace-nowrap text-sm font-bold shadow-[4px_4px_0px_rgba(0,0,0,1)] flex items-center gap-2">
                            Chat With Us <span className="text-xs text-slate-400 font-normal">●</span>
                        </div>
                        <button className="bg-[#00E676] w-16 h-16 rounded-full border-2 border-slate-900 shadow-[6px_6px_0px_rgba(0,0,0,1)] flex items-center justify-center hover:scale-105 transition-transform active:scale-95">
                            <MessageSquare size={32} className="text-slate-900" />
                        </button>
                    </div>
                </div>
            </main>

            {/* Trust Badges / Marquee Placeholder */}
            <section className="bg-slate-50 py-16 border-t border-slate-200">
                <div className="px-6 lg:px-24">
                    <p className="text-center text-slate-500 font-bold uppercase tracking-widest text-xs mb-10">
                        Empowering teams at world-class companies
                    </p>
                    <div className="flex flex-wrap justify-center items-center gap-12 lg:gap-24 opacity-50 grayscale">
                        {/* Using text logos to avoid missing images */}
                        <div className="font-black text-2xl tracking-tighter italic">AIRBNB</div>
                        <div className="font-black text-2xl tracking-tighter">shopify</div>
                        <div className="font-black text-2xl tracking-tighter underline underline-offset-4">COCACOLA</div>
                        <div className="font-black text-2xl tracking-tighter">NETFLIX</div>
                        <div className="font-black text-2xl tracking-tighter border-2 border-slate-900 px-2 py-1">NIKE</div>
                    </div>
                </div>
            </section>

            {/* Simple CTA Footer */}
            <footer className="bg-slate-900 text-white py-24 px-6 lg:px-24">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl lg:text-5xl font-black mb-8">Ready to grow your customer relationships?</h2>
                    <p className="text-xl text-slate-400 mb-12">Join 16,000+ businesses scaling with Meta Command.</p>
                    <Button className="bg-[#00E676] hover:bg-[#00c864] text-slate-900 border-2 border-transparent hover:border-white rounded-xl font-black text-xl px-12 py-8 transition-all">
                        Get Started Now — It's Free
                    </Button>
                </div>
            </footer>
        </div>
    );
}
